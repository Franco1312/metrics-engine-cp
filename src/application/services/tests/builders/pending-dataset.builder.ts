import { PendingDataset } from "@/domain/entities/pending-dataset.entity";

interface PendingDatasetData {
  runId?: string;
  datasetId?: string;
  requiredDays?: number;
  receivedUpdateId?: string;
  received?: boolean;
  receivedAt?: Date;
  createdAt?: Date;
}

export class PendingDatasetBuilder {
  private data: PendingDatasetData = {
    runId: "run-123",
    datasetId: "dataset-123",
    requiredDays: 7,
    received: false,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  };

  withRunId(runId: string): this {
    this.data.runId = runId;
    return this;
  }

  withDatasetId(datasetId: string): this {
    this.data.datasetId = datasetId;
    return this;
  }

  withRequiredDays(days: number): this {
    this.data.requiredDays = days;
    return this;
  }

  withReceivedUpdateId(updateId: string): this {
    this.data.receivedUpdateId = updateId;
    return this;
  }

  withReceived(received: boolean): this {
    this.data.received = received;
    return this;
  }

  withReceivedAt(date: Date): this {
    this.data.receivedAt = date;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  asReceived(updateId: string, receivedAt: Date): this {
    this.data.received = true;
    this.data.receivedUpdateId = updateId;
    this.data.receivedAt = receivedAt;
    return this;
  }

  build(): PendingDataset {
    return {
      runId: this.data.runId!,
      datasetId: this.data.datasetId!,
      requiredDays: this.data.requiredDays!,
      receivedUpdateId: this.data.receivedUpdateId,
      received: this.data.received!,
      receivedAt: this.data.receivedAt,
      createdAt: this.data.createdAt!,
    };
  }
}
