import { PendingDataset } from "@/domain/entities/pending-dataset.entity";

interface PendingDatasetRow {
  run_id: string;
  dataset_id: string;
  required_days: number;
  received_update_id: string | null;
  received: boolean;
  received_at: Date | null;
  created_at: Date;
}

export class PendingDatasetMapper {
  static toDomain(row: PendingDatasetRow): PendingDataset {
    return {
      runId: row.run_id,
      datasetId: row.dataset_id,
      requiredDays: row.required_days,
      receivedUpdateId: row.received_update_id ?? undefined,
      received: row.received,
      receivedAt: row.received_at ?? undefined,
      createdAt: row.created_at,
    };
  }

  static toDomainList(rows: PendingDatasetRow[]): PendingDataset[] {
    return rows.map((row) => this.toDomain(row));
  }

  static toRow(
    pending: Omit<PendingDataset, "createdAt">,
  ): Omit<PendingDatasetRow, "created_at"> {
    return {
      run_id: pending.runId,
      dataset_id: pending.datasetId,
      required_days: pending.requiredDays,
      received_update_id: pending.receivedUpdateId ?? null,
      received: pending.received,
      received_at: pending.receivedAt ?? null,
    };
  }
}
