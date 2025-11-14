interface DatasetUpdateRowData {
  id?: string;
  dataset_id?: string;
  version_manifest_path?: string;
  projections_path?: string;
  bucket?: string | null;
  event_key?: string;
  created_at?: Date;
}

export class DatasetUpdateRowBuilder {
  private data: DatasetUpdateRowData = {
    id: 'update-123',
    dataset_id: 'dataset-123',
    version_manifest_path: 'datasets/dataset-123/versions/v20240101/manifest.json',
    projections_path: 'datasets/dataset-123/projections/',
    bucket: 'test-bucket',
    event_key: 'dataset-123:v20240101',
    created_at: new Date('2024-01-01T00:00:00Z'),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withDatasetId(datasetId: string): this {
    this.data.dataset_id = datasetId;
    return this;
  }

  withVersionManifestPath(path: string): this {
    this.data.version_manifest_path = path;
    return this;
  }

  withProjectionsPath(path: string): this {
    this.data.projections_path = path;
    return this;
  }

  withBucket(bucket: string | null): this {
    this.data.bucket = bucket;
    return this;
  }

  withEventKey(eventKey: string): this {
    this.data.event_key = eventKey;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.created_at = date;
    return this;
  }

  withNullBucket(): this {
    this.data.bucket = null;
    return this;
  }

  build() {
    return {
      id: this.data.id!,
      dataset_id: this.data.dataset_id!,
      version_manifest_path: this.data.version_manifest_path!,
      projections_path: this.data.projections_path!,
      bucket: this.data.bucket ?? null,
      event_key: this.data.event_key!,
      created_at: this.data.created_at!,
    };
  }
}

