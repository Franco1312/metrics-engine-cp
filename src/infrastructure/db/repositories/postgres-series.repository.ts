import { SeriesRepository } from "@/domain/ports/series.repository";
import { Series } from "@/domain/entities/series.entity";
import {
  TransactionClient,
  DatabaseClient,
  QueryClient,
} from "@/domain/interfaces/database-client.interface";

export class PostgresSeriesRepository implements SeriesRepository {
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async findByCode(
    code: string,
    client?: TransactionClient,
  ): Promise<Series | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      code: string;
      name: string | null;
      description: string | null;
      unit: string | null;
      frequency: string | null;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM series WHERE code = $1", [code]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapToDomain(result.rows[0]);
  }

  async findByCodes(
    codes: string[],
    client?: TransactionClient,
  ): Promise<Series[]> {
    if (codes.length === 0) {
      return [];
    }

    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      code: string;
      name: string | null;
      description: string | null;
      unit: string | null;
      frequency: string | null;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM series WHERE code = ANY($1)", [codes]);

    return result.rows.map((row) => this.mapToDomain(row));
  }

  async findAll(client?: TransactionClient): Promise<Series[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      code: string;
      name: string | null;
      description: string | null;
      unit: string | null;
      frequency: string | null;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM series ORDER BY code");

    return result.rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: {
    code: string;
    name: string | null;
    description: string | null;
    unit: string | null;
    frequency: string | null;
    created_at: Date;
    updated_at: Date;
  }): Series {
    return {
      code: row.code,
      name: row.name ?? undefined,
      description: row.description ?? undefined,
      unit: row.unit ?? undefined,
      frequency: row.frequency ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
