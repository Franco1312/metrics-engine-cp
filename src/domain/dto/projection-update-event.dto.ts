/**
 * Evento recibido cuando un dataset es actualizado
 */
export interface ProjectionUpdateEvent {
  event: 'projection_update';
  dataset_id: string;
  bucket: string;
  version_manifest_path: string;
  projections_path: string;
}

