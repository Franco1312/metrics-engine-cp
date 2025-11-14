export interface DatasetUpdate {
  id: string;
  datasetId: string;
  versionManifestPath: string;
  projectionsPath: string;
  bucket?: string;
  eventKey: string;
  createdAt: Date;
}
