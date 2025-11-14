import { PendingDatasetRepository } from "@/domain/ports/pending-dataset.repository";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { MetricRun } from "@/domain/entities/metric-run.entity";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";
import { TimeWindowValidatorService } from "@/domain/services/time-window-validator.service";

/**
 * Servicio de aplicación para gestionar runs pendientes
 */
export class PendingRunService {
  constructor(
    private readonly pendingDatasetRepository: PendingDatasetRepository,
    private readonly metricRunRepository: MetricRunRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Actualiza runs pendientes para un dataset cuando llega una nueva actualización
   *
   * @param datasetId - ID del dataset actualizado
   * @param updateId - ID de la actualización recibida
   * @param updateCreatedAt - Fecha de creación de la actualización
   * @param client - Cliente de transacción opcional
   * @returns Array de runs que fueron actualizados y están listos para ejecutarse
   */
  async updatePendingRunsForDataset(
    datasetId: string,
    updateId: string,
    updateCreatedAt: Date,
    client?: TransactionClient,
  ): Promise<MetricRun[]> {
    const pendingDatasets = await this.pendingDatasetRepository.findByDatasetId(
      datasetId,
      client,
    );

    const readyRuns: MetricRun[] = [];

    for (const pending of pendingDatasets) {
      if (
        !this.isUpdateValidForPending(
          pending,
          updateCreatedAt,
          updateId,
          datasetId,
        )
      ) {
        continue;
      }

      await this.markPendingDatasetAsReceived(
        pending.runId,
        datasetId,
        updateId,
        client,
      );

      const isRunReady = await this.isRunReady(pending.runId, client);
      if (isRunReady) {
        const run = await this.metricRunRepository.findById(
          pending.runId,
          client,
        );
        if (run) {
          readyRuns.push(run);
        }
      }
    }

    return readyRuns;
  }

  /**
   * Valida si una actualización es válida para un pending dataset
   */
  private isUpdateValidForPending(
    pending: { runId: string; requiredDays: number },
    updateCreatedAt: Date,
    updateId: string,
    datasetId: string,
  ): boolean {
    const update = {
      id: updateId,
      datasetId: "",
      versionManifestPath: "",
      projectionsPath: "",
      eventKey: "",
      createdAt: updateCreatedAt,
    };

    const isValid = TimeWindowValidatorService.isUpdateValid(
      update,
      pending.requiredDays,
    );

    if (!isValid) {
      this.logger.info({
        event: LOG_EVENTS.ON_DEPENDENCY_PENDING,
        msg: "Update is too old for pending run, skipping",
        data: {
          runId: pending.runId,
          datasetId,
          updateId,
          requiredDays: pending.requiredDays,
        },
      });
      return false;
    }

    return isValid;
  }

  /**
   * Marca un pending dataset como recibido
   */
  private async markPendingDatasetAsReceived(
    runId: string,
    datasetId: string,
    updateId: string,
    client?: TransactionClient,
  ): Promise<void> {
    await this.pendingDatasetRepository.update(
      runId,
      datasetId,
      {
        received: true,
        receivedUpdateId: updateId,
        receivedAt: new Date(),
      },
      client,
    );

    this.logger.info({
      event: LOG_EVENTS.ON_DEPENDENCY_RESOLVED,
      msg: "Pending dataset marked as received",
      data: {
        runId,
        datasetId,
        updateId,
      },
    });
  }

  /**
   * Verifica si un run pendiente está listo para ejecutarse
   *
   * @param runId - ID del run a verificar
   * @param client - Cliente de transacción opcional
   * @returns true si todas las dependencias están listas, false en caso contrario
   */
  async isRunReady(
    runId: string,
    client?: TransactionClient,
  ): Promise<boolean> {
    const pendingCount =
      await this.pendingDatasetRepository.countPendingByRunId(runId, client);
    return pendingCount === 0;
  }
}
