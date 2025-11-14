import { ProjectionUpdateEvent } from "@/domain/dto/projection-update-event.dto";

interface ProjectionUpdateEventData {
  dataset_id?: string;
  bucket?: string;
  version_manifest_path?: string;
  projections_path?: string;
}

export class ProjectionUpdateEventBuilder {
  private data: ProjectionUpdateEventData = {
    dataset_id: "dataset-123",
    bucket: "test-bucket",
    version_manifest_path:
      "datasets/dataset-123/versions/v20240101/manifest.json",
    projections_path: "datasets/dataset-123/projections/",
  };

  withDatasetId(datasetId: string): this {
    this.data.dataset_id = datasetId;
    return this;
  }

  withBucket(bucket: string): this {
    this.data.bucket = bucket;
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

  build(): ProjectionUpdateEvent {
    return {
      event: "projection_update",
      dataset_id: this.data.dataset_id!,
      bucket: this.data.bucket!,
      version_manifest_path: this.data.version_manifest_path!,
      projections_path: this.data.projections_path!,
    };
  }
}
