import { Dataset } from "@/domain/entities/dataset.entity";

interface DatasetData {
  id?: string;
  name?: string;
  description?: string;
  bucket?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DatasetBuilder {
  private data: DatasetData = {
    id: "dataset-123",
    name: "Test Dataset",
    description: "Test description",
    bucket: "test-bucket",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withBucket(bucket: string): this {
    this.data.bucket = bucket;
    return this;
  }

  build(): Dataset {
    return {
      id: this.data.id!,
      name: this.data.name,
      description: this.data.description,
      bucket: this.data.bucket,
      createdAt: this.data.createdAt!,
      updatedAt: this.data.updatedAt!,
    };
  }
}
