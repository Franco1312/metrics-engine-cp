import { DatasetUpdate } from '@/domain/entities/dataset-update.entity';

interface DatasetUpdateData {
  id?: string;
  datasetId?: string;
  versionManifestPath?: string;
  projectionsPath?: string;
  bucket?: string;
  eventKey?: string;
  createdAt?: Date;
}

export class DatasetUpdateBuilder {
  private data: DatasetUpdateData = {
    id: 'update-123',
    datasetId: 'dataset-123',
    versionManifestPath: 'datasets/dataset-123/versions/v20240101/manifest.json',
    projectionsPath: 'datasets/dataset-123/projections/',
    bucket: 'test-bucket',
    eventKey: 'dataset-123:v20240101',
    createdAt: new Date('2024-01-15T00:00:00Z'),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withDatasetId(datasetId: string): this {
    this.data.datasetId = datasetId;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  withDaysAgo(days: number): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    this.data.createdAt = date;
    return this;
  }

  build(): DatasetUpdate {
    return {
      id: this.data.id!,
      datasetId: this.data.datasetId!,
      versionManifestPath: this.data.versionManifestPath!,
      projectionsPath: this.data.projectionsPath!,
      bucket: this.data.bucket,
      eventKey: this.data.eventKey!,
      createdAt: this.data.createdAt!,
    };
  }
}

