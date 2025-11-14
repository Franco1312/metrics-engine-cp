import { DatasetUpdateRepository } from '@/domain/ports/dataset-update.repository';
import { DatasetUpdate } from '@/domain/entities/dataset-update.entity';
import { TransactionClient, DatabaseClient, QueryClient } from '@/domain/interfaces/database-client.interface';
import { DatasetUpdateMapper } from '@/infrastructure/db/mappers/dataset-update.mapper';

export class PostgresDatasetUpdateRepository
  implements DatasetUpdateRepository
{
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async create(
    update: Omit<DatasetUpdate, 'id' | 'createdAt'>,
    client?: TransactionClient,
  ): Promise<DatasetUpdate> {
    const dbClient = this.getClient(client);
    const row = DatasetUpdateMapper.toRow(update);

    const result = await dbClient.query<{
      id: string;
      dataset_id: string;
      version_manifest_path: string;
      projections_path: string;
      bucket: string | null;
      event_key: string;
      created_at: Date;
    }>(
      `INSERT INTO dataset_updates 
       (dataset_id, version_manifest_path, projections_path, bucket, event_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        row.dataset_id,
        row.version_manifest_path,
        row.projections_path,
        row.bucket,
        row.event_key,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Failed to create dataset update');
    }
    return DatasetUpdateMapper.toDomain(result.rows[0]);
  }

  async findById(
    id: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      dataset_id: string;
      version_manifest_path: string;
      projections_path: string;
      bucket: string | null;
      event_key: string;
      created_at: Date;
    }>('SELECT * FROM dataset_updates WHERE id = $1', [id]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return DatasetUpdateMapper.toDomain(result.rows[0]);
  }

  async findByEventKey(
    eventKey: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      dataset_id: string;
      version_manifest_path: string;
      projections_path: string;
      bucket: string | null;
      event_key: string;
      created_at: Date;
    }>('SELECT * FROM dataset_updates WHERE event_key = $1', [eventKey]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return DatasetUpdateMapper.toDomain(result.rows[0]);
  }

  async findByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      dataset_id: string;
      version_manifest_path: string;
      projections_path: string;
      bucket: string | null;
      event_key: string;
      created_at: Date;
    }>(
      'SELECT * FROM dataset_updates WHERE dataset_id = $1 ORDER BY created_at DESC',
      [datasetId],
    );

    return DatasetUpdateMapper.toDomainList(result.rows);
  }

  async findLatestByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<DatasetUpdate | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      dataset_id: string;
      version_manifest_path: string;
      projections_path: string;
      bucket: string | null;
      event_key: string;
      created_at: Date;
    }>(
      `SELECT * FROM dataset_updates 
       WHERE dataset_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [datasetId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return DatasetUpdateMapper.toDomain(result.rows[0]);
  }
}

