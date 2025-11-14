interface PendingDatasetRowData {
  run_id?: string;
  dataset_id?: string;
  required_days?: number;
  received_update_id?: string | null;
  received?: boolean;
  received_at?: Date | null;
  created_at?: Date;
}

export class PendingDatasetRowBuilder {
  private data: PendingDatasetRowData = {
    run_id: 'run-123',
    dataset_id: 'dataset-123',
    required_days: 7,
    received_update_id: null,
    received: false,
    received_at: null,
    created_at: new Date('2024-01-01T00:00:00Z'),
  };

  withRunId(runId: string): this {
    this.data.run_id = runId;
    return this;
  }

  withDatasetId(datasetId: string): this {
    this.data.dataset_id = datasetId;
    return this;
  }

  withRequiredDays(days: number): this {
    this.data.required_days = days;
    return this;
  }

  withReceivedUpdateId(updateId: string | null): this {
    this.data.received_update_id = updateId;
    return this;
  }

  withReceived(received: boolean): this {
    this.data.received = received;
    return this;
  }

  withReceivedAt(date: Date | null): this {
    this.data.received_at = date;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.created_at = date;
    return this;
  }

  asReceived(updateId: string, receivedAt: Date): this {
    this.data.received = true;
    this.data.received_update_id = updateId;
    this.data.received_at = receivedAt;
    return this;
  }

  build() {
    return {
      run_id: this.data.run_id!,
      dataset_id: this.data.dataset_id!,
      required_days: this.data.required_days!,
      received_update_id: this.data.received_update_id ?? null,
      received: this.data.received!,
      received_at: this.data.received_at ?? null,
      created_at: this.data.created_at!,
    };
  }
}

