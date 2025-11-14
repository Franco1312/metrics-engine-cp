export interface PendingDataset {
  runId: string;
  datasetId: string;
  requiredDays: number;
  receivedUpdateId?: string;
  received: boolean;
  receivedAt?: Date;
  createdAt: Date;
}

