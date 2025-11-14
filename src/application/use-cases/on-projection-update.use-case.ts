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

/**
 * Use case para procesar eventos de actualización de proyecciones
 */
export class OnProjectionUpdateUseCase {
  constructor(
    private readonly datasetUpdateService: DatasetUpdateService,
    private readonly metricDependencyResolverService: MetricDependencyResolverService,
    private readonly metricRunOrchestratorService: MetricRunOrchestratorService,
    private readonly pendingRunService: PendingRunService,
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
   *
   * @param event - El evento de actualización de proyección
   * @param client - Cliente de transacción
   * @returns Array de runs creados o emitidos
   */
  private async processProjectionUpdate(
    event: ProjectionUpdateEvent,
    client: TransactionClient,
  ): Promise<MetricRun[]> {
    this.logger.info({
      event: LOG_EVENTS.ON_PROJECTION_UPDATE_STARTED,
      msg: "Processing projection update event",
      data: {
        datasetId: event.dataset_id,
        bucket: event.bucket,
      },
    });

    // 1. Persistir la actualización del dataset
    const datasetUpdate = await this.datasetUpdateService.persistUpdate(
      event,
      client,
    );

    // 2. Encontrar métricas que dependen de este dataset
    const dependentMetrics =
      await this.metricDependencyResolverService.findMetricsForDataset(
        event.dataset_id,
        client,
      );

    if (dependentMetrics.length === 0) {
      this.logger.info({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE_COMPLETED,
        msg: "No dependent metrics found for dataset",
        data: {
          datasetId: event.dataset_id,
        },
      });
      return [];
    }

    // 3. Para cada métrica dependiente, crear o actualizar runs
    const createdRuns: MetricRun[] = [];

    for (const metric of dependentMetrics) {
      const requiredDatasetIds =
        await this.metricDependencyResolverService.resolveRequiredDatasets(
          metric.id,
          client,
        );

      const run = await this.metricRunOrchestratorService.createRunForMetric(
        metric,
        event.dataset_id,
        datasetUpdate,
        requiredDatasetIds,
        client,
      );

      createdRuns.push(run);
    }

    // 4. Actualizar runs pendientes y emitir los que estén listos
    const readyRuns = await this.pendingRunService.updatePendingRunsForDataset(
      event.dataset_id,
      datasetUpdate.id,
      datasetUpdate.createdAt,
      client,
    );

    // 5. Emitir runs que estén listos pero aún no emitidos
    for (const run of readyRuns) {
      if (run.status === METRIC_RUN_STATUS.PENDING_DEPENDENCIES) {
        await this.metricRunOrchestratorService.emitPendingRun(run.id, client);
      }
    }

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

    return [...createdRuns, ...readyRuns];
  }
}
