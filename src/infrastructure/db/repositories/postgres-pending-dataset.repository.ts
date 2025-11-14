import { PendingDatasetRepository } from '@/domain/ports/pending-dataset.repository';
import { PendingDataset } from '@/domain/entities/pending-dataset.entity';
import { TransactionClient, DatabaseClient, QueryClient } from '@/domain/interfaces/database-client.interface';
import { PendingDatasetMapper } from '@/infrastructure/db/mappers/pending-dataset.mapper';

export class PostgresPendingDatasetRepository
  implements PendingDatasetRepository
{
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async create(
    pending: Omit<PendingDataset, 'createdAt'>,
    client?: TransactionClient,
  ): Promise<PendingDataset> {
    const dbClient = this.getClient(client);
    const row = PendingDatasetMapper.toRow(pending);

    const result = await dbClient.query<{
      run_id: string;
      dataset_id: string;
      required_days: number;
      received_update_id: string | null;
      received: boolean;
      received_at: Date | null;
      created_at: Date;
    }>(
      `INSERT INTO metric_run_pending_datasets 
       (run_id, dataset_id, required_days, received_update_id, received, received_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        row.run_id,
        row.dataset_id,
        row.required_days,
        row.received_update_id,
        row.received,
        row.received_at,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Failed to create pending dataset');
    }
    return PendingDatasetMapper.toDomain(result.rows[0]);
  }

  async findByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      run_id: string;
      dataset_id: string;
      required_days: number;
      received_update_id: string | null;
      received: boolean;
      received_at: Date | null;
      created_at: Date;
    }>(
      'SELECT * FROM metric_run_pending_datasets WHERE run_id = $1',
      [runId],
    );

    return PendingDatasetMapper.toDomainList(result.rows);
  }

  async findByDatasetId(
    datasetId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      run_id: string;
      dataset_id: string;
      required_days: number;
      received_update_id: string | null;
      received: boolean;
      received_at: Date | null;
      created_at: Date;
    }>(
      `SELECT * FROM metric_run_pending_datasets 
       WHERE dataset_id = $1 AND received = FALSE`,
      [datasetId],
    );

    return PendingDatasetMapper.toDomainList(result.rows);
  }

  async findPendingByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<PendingDataset[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      run_id: string;
      dataset_id: string;
      required_days: number;
      received_update_id: string | null;
      received: boolean;
      received_at: Date | null;
      created_at: Date;
    }>(
      `SELECT * FROM metric_run_pending_datasets 
       WHERE run_id = $1 AND received = FALSE`,
      [runId],
    );

    return PendingDatasetMapper.toDomainList(result.rows);
  }

  async update(
    runId: string,
    datasetId: string,
    updates: Partial<
      Omit<PendingDataset, 'runId' | 'datasetId' | 'createdAt'>
    >,
    client?: TransactionClient,
  ): Promise<PendingDataset> {
    const dbClient = this.getClient(client);
    const setParts: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.requiredDays !== undefined) {
      setParts.push(`required_days = $${paramIndex++}`);
      values.push(updates.requiredDays);
    }
    if (updates.receivedUpdateId !== undefined) {
      setParts.push(`received_update_id = $${paramIndex++}`);
      values.push(updates.receivedUpdateId);
    }
    if (updates.received !== undefined) {
      setParts.push(`received = $${paramIndex++}`);
      values.push(updates.received);
    }
    if (updates.receivedAt !== undefined) {
      setParts.push(`received_at = $${paramIndex++}`);
      values.push(updates.receivedAt);
    }

    if (setParts.length === 0) {
      // No updates, return existing
      const existing = await this.findByRunId(runId, client);
      const found = existing.find((p) => p.datasetId === datasetId);
      if (!found) {
        throw new Error(
          `PendingDataset with runId ${runId} and datasetId ${datasetId} not found`,
        );
      }
      return found;
    }

    values.push(runId, datasetId);
    const query = `UPDATE metric_run_pending_datasets 
                   SET ${setParts.join(', ')} 
                   WHERE run_id = $${paramIndex} AND dataset_id = $${paramIndex + 1} 
                   RETURNING *`;

    const result = await dbClient.query<{
      run_id: string;
      dataset_id: string;
      required_days: number;
      received_update_id: string | null;
      received: boolean;
      received_at: Date | null;
      created_at: Date;
    }>(query, values);

    if (!result.rows[0]) {
      throw new Error(
        `PendingDataset with runId ${runId} and datasetId ${datasetId} not found`,
      );
    }
    return PendingDatasetMapper.toDomain(result.rows[0]);
  }

  async delete(
    runId: string,
    datasetId: string,
    client?: TransactionClient,
  ): Promise<void> {
    const dbClient = this.getClient(client);
    await dbClient.query(
      'DELETE FROM metric_run_pending_datasets WHERE run_id = $1 AND dataset_id = $2',
      [runId, datasetId],
    );
  }

  async countPendingByRunId(
    runId: string,
    client?: TransactionClient,
  ): Promise<number> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM metric_run_pending_datasets 
       WHERE run_id = $1 AND received = FALSE`,
      [runId],
    );

    if (!result.rows[0]) {
      return 0;
    }
    return parseInt(result.rows[0].count, 10);
  }
}

