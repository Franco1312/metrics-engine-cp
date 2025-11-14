import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";

export interface DatasetUpdateRepository {
  create(
    update: Omit<DatasetUpdate, "id" | "createdAt">,
    client?: TransactionClient,
  ): Promise<DatasetUpdate>;
  findById(
    id: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null>;
  findByEventKey(
    eventKey: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null>;
  findByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate[]>;
  findLatestByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null>;
}
