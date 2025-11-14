import { MetricRunCompletedEvent } from "@/domain/dto/metric-run-completed-event.dto";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { DatabaseClient } from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

/**
 * Use case para procesar eventos de finalización de ejecución de métricas
 */
export class OnMetricRunCompletedUseCase {
  constructor(
    private readonly metricRunRepository: MetricRunRepository,
    private readonly databaseClient: DatabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Procesa un evento de finalización de ejecución de métrica
   *
   * @param event - El evento de finalización
   */
  async execute(event: MetricRunCompletedEvent): Promise<void> {
    return this.databaseClient.transaction(async (client) => {
      const run = await this.metricRunRepository.findById(event.runId, client);

      if (!run) {
        this.logger.error({
          event: LOG_EVENTS.ON_RUN_COMPLETED,
          msg: "Run not found",
          data: { runId: event.runId },
          err: new Error(`Run not found: ${event.runId}`),
        });
        return;
      }

      const status =
        event.status === "SUCCESS"
          ? METRIC_RUN_STATUS.SUCCEEDED
          : METRIC_RUN_STATUS.FAILED;

      const finishedAt = new Date();

      await this.metricRunRepository.update(
        event.runId,
        {
          status,
          finishedAt,
          versionTs: event.versionTs,
          manifestPath: event.outputManifest,
          rowCount: event.rowCount,
          error: event.error,
        },
        client,
      );

      const logEvent =
        event.status === "SUCCESS"
          ? LOG_EVENTS.ON_RUN_COMPLETED
          : LOG_EVENTS.ON_RUN_FAILED;

      this.logger.info({
        event: logEvent,
        msg: `Metric run ${event.status.toLowerCase()}`,
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
          status: event.status,
          finishedAt: finishedAt.toISOString(),
          versionTs: event.versionTs,
          outputManifest: event.outputManifest,
          rowCount: event.rowCount,
          error: event.error,
        },
      });
    });
  }
}
