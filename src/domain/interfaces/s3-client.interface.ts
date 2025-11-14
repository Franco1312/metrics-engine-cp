/**
 * Interfaz para operaciones con S3
 * Por ahora solo se define la interfaz, se implementará si es necesario
 */
export interface S3Client {
  /**
   * Lee un archivo desde S3
   */
  getObject(bucket: string, key: string): Promise<Buffer>;

  /**
   * Verifica si un objeto existe en S3
   */
  objectExists(bucket: string, key: string): Promise<boolean>;
}
