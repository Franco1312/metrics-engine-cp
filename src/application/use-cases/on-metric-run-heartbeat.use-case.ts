import { MetricRunHeartbeatEvent } from "@/domain/dto/metric-run-heartbeat-event.dto";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { DatabaseClient } from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";

/**
 * Use case para procesar eventos de heartbeat de ejecución de métricas
 */
export class OnMetricRunHeartbeatUseCase {
  constructor(
    private readonly metricRunRepository: MetricRunRepository,
    private readonly databaseClient: DatabaseClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Procesa un evento de heartbeat de ejecución de métrica
   *
   * @param event - El evento de heartbeat
   */
  async execute(event: MetricRunHeartbeatEvent): Promise<void> {
    return this.databaseClient.transaction(async (client) => {
      const run = await this.metricRunRepository.findById(event.runId, client);

      if (!run) {
        this.logger.error({
          event: LOG_EVENTS.ON_RUN_HEARTBEAT,
          msg: "Run not found",
          data: { runId: event.runId },
          err: new Error(`Run not found: ${event.runId}`),
        });
        return;
      }

      const heartbeatAt = new Date(event.ts);

      await this.metricRunRepository.update(
        event.runId,
        {
          lastHeartbeatAt: heartbeatAt,
        },
        client,
      );

      this.logger.info({
        event: LOG_EVENTS.ON_RUN_HEARTBEAT,
        msg: "Metric run heartbeat received",
        data: {
          runId: event.runId,
          metricCode: run.metricCode,
          heartbeatAt: heartbeatAt.toISOString(),
          progress: event.progress,
        },
      });
    });
  }
}
