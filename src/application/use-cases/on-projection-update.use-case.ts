import { ProjectionUpdateEvent } from "@/domain/dto/projection-update-event.dto";
import { DatasetUpdateService } from "@/application/services/dataset-update.service";
import { MetricDependencyResolverService } from "@/application/services/metric-dependency-resolver.service";
import { MetricRunOrchestratorService } from "@/application/services/metric-run-orchestrator.service";
import { PendingRunService } from "@/application/services/pending-run.service";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";
import { MetricRun } from "@/domain/entities/metric-run.entity";
import { Metric } from "@/domain/entities/metric.entity";
import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";
import { EventLogRepository } from "@/domain/ports/event-log.repository";

/**
 * Use case para procesar eventos de actualización de proyecciones
 */
export class OnProjectionUpdateUseCase {
  constructor(
    private readonly datasetUpdateService: DatasetUpdateService,
    private readonly metricDependencyResolverService: MetricDependencyResolverService,
    private readonly metricRunOrchestratorService: MetricRunOrchestratorService,
    private readonly pendingRunService: PendingRunService,
    private readonly eventLogRepository: EventLogRepository,
    private readonly databaseClient: DatabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Procesa un evento de actualización de proyección
   *
   * @param event - El evento de actualización de proyección
   * @returns Array de runs creados o emitidos
   */
  async execute(event: ProjectionUpdateEvent): Promise<MetricRun[]> {
    return this.databaseClient.transaction(async (client) => {
      return this.processProjectionUpdate(event, client);
    });
  }

  /**
   * Procesa la lógica de actualización de proyección dentro de una transacción
   */
  private async processProjectionUpdate(
    event: ProjectionUpdateEvent,
    client: TransactionClient,
  ): Promise<MetricRun[]> {
    const eventKey = this.buildEventKey(event);

    if (await this.isAlreadyProcessed(eventKey, client)) {
      return [];
    }

    await this.registerEvent(event, eventKey, client);

    const datasetUpdate = await this.datasetUpdateService.persistUpdate(
      event,
      client,
    );

    const dependentMetrics =
      await this.metricDependencyResolverService.findMetricsForDataset(
        event.dataset_id,
        client,
      );

    if (dependentMetrics.length === 0) {
      await this.completeEventProcessing(eventKey, client);
      this.logEventCompletion(event, datasetUpdate, [], [], []);
      return [];
    }

    const createdRuns = await this.createRunsForMetrics(
      dependentMetrics,
      event.dataset_id,
      datasetUpdate,
      client,
    );

    const readyRuns = await this.pendingRunService.updatePendingRunsForDataset(
      event.dataset_id,
      datasetUpdate.id,
      datasetUpdate.createdAt,
      client,
    );

    await this.emitReadyRuns(readyRuns, client);

    await this.completeEventProcessing(eventKey, client);

    this.logEventCompletion(
      event,
      datasetUpdate,
      dependentMetrics,
      createdRuns,
      readyRuns,
    );

    return [...createdRuns, ...readyRuns];
  }

  private buildEventKey(event: ProjectionUpdateEvent): string {
    return `${event.dataset_id}:${event.version_manifest_path}`;
  }

  private async isAlreadyProcessed(
    eventKey: string,
    client: TransactionClient,
  ): Promise<boolean> {
    const existingEventLog = await this.eventLogRepository.findByEventKey(
      eventKey,
      client,
    );

    if (existingEventLog?.processedAt) {
      this.logger.info({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE,
        msg: "Projection update event already processed, skipping",
        data: {
          eventKey,
          processedAt: existingEventLog.processedAt,
        },
      });
      return true;
    }

    return false;
  }

  private async registerEvent(
    event: ProjectionUpdateEvent,
    eventKey: string,
    client: TransactionClient,
  ): Promise<void> {
    await this.eventLogRepository.create(
      {
        eventKey,
        eventType: "projection_update",
        eventPayload: event as unknown as Record<string, unknown>,
        processedAt: undefined,
        runId: undefined,
      },
      client,
    );

    this.logger.info({
      event: LOG_EVENTS.ON_PROJECTION_UPDATE_STARTED,
      msg: "Processing projection update event",
      data: {
        datasetId: event.dataset_id,
        bucket: event.bucket,
        eventKey,
      },
    });
  }

  private async createRunsForMetrics(
    metrics: Metric[],
    currentDatasetId: string,
    datasetUpdate: DatasetUpdate,
    client: TransactionClient,
  ): Promise<MetricRun[]> {
    const runs: MetricRun[] = [];

    for (const metric of metrics) {
      const requiredDatasetIds =
        await this.metricDependencyResolverService.resolveRequiredDatasets(
          metric.id,
          client,
        );

      const run = await this.metricRunOrchestratorService.createRunForMetric(
        metric,
        currentDatasetId,
        datasetUpdate,
        requiredDatasetIds,
        client,
      );

      runs.push(run);
    }

    return runs;
  }

  private async emitReadyRuns(
    runs: MetricRun[],
    client: TransactionClient,
  ): Promise<void> {
    for (const run of runs) {
      if (run.status === METRIC_RUN_STATUS.PENDING_DEPENDENCIES) {
        await this.metricRunOrchestratorService.emitPendingRun(run.id, client);
      }
    }
  }

  private async completeEventProcessing(
    eventKey: string,
    client: TransactionClient,
  ): Promise<void> {
    await this.eventLogRepository.markAsProcessed(eventKey, undefined, client);
  }

  private logEventCompletion(
    event: ProjectionUpdateEvent,
    datasetUpdate: DatasetUpdate,
    dependentMetrics: Metric[],
    createdRuns: MetricRun[],
    readyRuns: MetricRun[],
  ): void {
    this.logger.info({
      event: LOG_EVENTS.ON_PROJECTION_UPDATE_COMPLETED,
      msg: "Projection update processed successfully",
      data: {
        datasetId: event.dataset_id,
        updateId: datasetUpdate.id,
        dependentMetricsCount: dependentMetrics.length,
        createdRunsCount: createdRuns.length,
        readyRunsCount: readyRuns.length,
      },
    });
  }
}
