import { PendingDataset } from "@/domain/entities/pending-dataset.entity";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";

export interface PendingDatasetRepository {
  create(
    pending: Omit<PendingDataset, "createdAt">,
    client?: TransactionClient,
  ): Promise<PendingDataset>;
  findByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]>;
  findByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]>;
  findPendingByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]>;
  update(
    runId: string,
    datasetId: string,
    updates: Partial<Omit<PendingDataset, "runId" | "datasetId" | "createdAt">>,
    client?: TransactionClient,
  ): Promise<PendingDataset>;
  delete(
    runId: string,
    datasetId: string,
    client?: TransactionClient,
  ): Promise<void>;
  countPendingByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<number>;
}
