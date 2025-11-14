import { ProjectionUpdateEvent } from "@/domain/dto/projection-update-event.dto";
import { DatasetUpdateRepository } from "@/domain/ports/dataset-update.repository";
import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";

/**
 * Servicio de aplicación para gestionar actualizaciones de datasets
 */
export class DatasetUpdateService {
  constructor(
    private readonly datasetUpdateRepository: DatasetUpdateRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Persiste una actualización de dataset desde un evento
   *
   * @param event - El evento de actualización de proyección
   * @param client - Cliente de transacción opcional
   * @returns La actualización persistida
   */
  async persistUpdate(
    event: ProjectionUpdateEvent,
    client?: TransactionClient,
  ): Promise<DatasetUpdate> {
    const eventKey = `${event.dataset_id}:${event.version_manifest_path}`;

    // Verificar si ya existe
    const existing = await this.datasetUpdateRepository.findByEventKey(
      eventKey,
      client,
    );

    if (existing) {
      this.logger.info({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE,
        msg: "Dataset update already exists, skipping",
        data: {
          datasetId: event.dataset_id,
          eventKey,
          updateId: existing.id,
        },
      });
      return existing;
    }

    const update = await this.datasetUpdateRepository.create(
      {
        datasetId: event.dataset_id,
        versionManifestPath: event.version_manifest_path,
        projectionsPath: event.projections_path,
        bucket: event.bucket,
        eventKey,
      },
      client,
    );

    this.logger.info({
      event: LOG_EVENTS.ON_PROJECTION_UPDATE,
      msg: "Dataset update persisted successfully",
      data: {
        datasetId: event.dataset_id,
        updateId: update.id,
        eventKey,
      },
    });

    return update;
  }
}
