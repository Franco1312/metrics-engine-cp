import { MetricRunStartedEvent } from "@/domain/dto/metric-run-started-event.dto";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { DatabaseClient } from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

/**
 * Use case para procesar eventos de inicio de ejecución de métricas
 */
export class OnMetricRunStartedUseCase {
  constructor(
    private readonly metricRunRepository: MetricRunRepository,
    private readonly databaseClient: DatabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Procesa un evento de inicio de ejecución de métrica
   *
   * @param event - El evento de inicio de ejecución
   */
  async execute(event: MetricRunStartedEvent): Promise<void> {
    return this.databaseClient.transaction(async (client) => {
      const run = await this.metricRunRepository.findById(event.runId, client);

      if (!run) {
        this.logger.error({
          event: LOG_EVENTS.ON_RUN_STARTED,
          msg: "Run not found",
          data: { runId: event.runId },
          err: new Error(`Run not found: ${event.runId}`),
        });
        return;
      }

      const startedAt = event.startedAt
        ? new Date(event.startedAt)
        : new Date();

      await this.metricRunRepository.update(
        event.runId,
        {
          status: METRIC_RUN_STATUS.RUNNING,
          startedAt,
        },
        client,
      );

      this.logger.info({
        event: LOG_EVENTS.ON_RUN_STARTED,
        msg: "Metric run started",
        data: {
          runId: event.runId,
          metricCode: run.metricCode,
          startedAt: startedAt.toISOString(),
        },
      });
    });
  }
}
