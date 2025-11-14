import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";

interface DatasetUpdateRow {
  id: string;
  dataset_id: string;
  version_manifest_path: string;
  projections_path: string;
  bucket: string | null;
  event_key: string;
  created_at: Date;
}

export class DatasetUpdateMapper {
  static toDomain(row: DatasetUpdateRow): DatasetUpdate {
    return {
      id: row.id,
      datasetId: row.dataset_id,
      versionManifestPath: row.version_manifest_path,
      projectionsPath: row.projections_path,
      bucket: row.bucket ?? undefined,
      eventKey: row.event_key,
      createdAt: row.created_at,
    };
  }

  static toDomainList(rows: DatasetUpdateRow[]): DatasetUpdate[] {
    return rows.map((row) => this.toDomain(row));
  }

  static toRow(
    update: Omit<DatasetUpdate, "id" | "createdAt">,
  ): Omit<DatasetUpdateRow, "id" | "created_at"> {
    return {
      dataset_id: update.datasetId,
      version_manifest_path: update.versionManifestPath,
      projections_path: update.projectionsPath,
      bucket: update.bucket ?? null,
      event_key: update.eventKey,
    };
  }
}
