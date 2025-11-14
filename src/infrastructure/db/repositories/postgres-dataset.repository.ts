import { DatasetRepository } from '@/domain/ports/dataset.repository';
import { Dataset } from '@/domain/entities/dataset.entity';
import { TransactionClient, DatabaseClient, QueryClient } from '@/domain/interfaces/database-client.interface';

export class PostgresDatasetRepository implements DatasetRepository {
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async findById(
    id: string,
    client?: TransactionClient,
  ): Promise<Dataset | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      name: string | null;
      description: string | null;
      bucket: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM datasets WHERE id = $1', [id]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapToDomain(result.rows[0]);
  }

  async findAll(client?: TransactionClient): Promise<Dataset[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      name: string | null;
      description: string | null;
      bucket: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM datasets ORDER BY id');

    return result.rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: {
    id: string;
    name: string | null;
    description: string | null;
    bucket: string | null;
    created_at: Date;
    updated_at: Date;
  }): Dataset {
    return {
      id: row.id,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
      bucket: row.bucket ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

