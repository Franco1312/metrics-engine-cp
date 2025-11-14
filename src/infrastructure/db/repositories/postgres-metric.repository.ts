import { MetricRepository } from '@/domain/ports/metric.repository';
import { Metric } from '@/domain/entities/metric.entity';
import { TransactionClient, DatabaseClient, QueryClient } from '@/domain/interfaces/database-client.interface';
import { MetricMapper } from '@/infrastructure/db/mappers/metric.mapper';

export class PostgresMetricRepository implements MetricRepository {
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async findById(
    id: string,
    client?: TransactionClient,
  ): Promise<Metric | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      code: string;
      expression_type: string;
      expression_json: unknown;
      frequency: string | null;
      unit: string | null;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM metrics WHERE id = $1', [id]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return MetricMapper.toDomain(result.rows[0]);
  }

  async findByCode(
    code: string,
    client?: TransactionClient,
  ): Promise<Metric | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      code: string;
      expression_type: string;
      expression_json: unknown;
      frequency: string | null;
      unit: string | null;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM metrics WHERE code = $1', [code]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return MetricMapper.toDomain(result.rows[0]);
  }

  async findAll(client?: TransactionClient): Promise<Metric[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      code: string;
      expression_type: string;
      expression_json: unknown;
      frequency: string | null;
      unit: string | null;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM metrics ORDER BY created_at DESC');

    return MetricMapper.toDomainList(result.rows);
  }
}

