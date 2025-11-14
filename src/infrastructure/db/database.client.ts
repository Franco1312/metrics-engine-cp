import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import { LOG_EVENTS } from "@/domain/constants/log-events";

class TransactionClientImpl implements TransactionClient {
  constructor(private readonly client: PoolClient) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(text, params);
  }

  release(): void {
    // No hacer nada, el release se maneja en el método transaction
  }
}

export class PostgresDatabaseClient implements DatabaseClient {
  private pool: Pool;
  private readonly logger: Logger;

  constructor(config: AppConfig, logger: Logger = defaultLogger) {
    this.logger = logger;
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20, // Máximo de conexiones en el pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("connect", () => {
      this.logger.info({
        event: LOG_EVENTS.DB_CONNECTION_ESTABLISHED,
        msg: "Database connection established",
      });
    });

    this.pool.on("error", (err) => {
      this.logger.error({
        event: LOG_EVENTS.DB_CONNECTION_ERROR,
        msg: "Unexpected database error",
        err,
      });
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(
    callback: (client: TransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    const transactionClient = new TransactionClientImpl(client);

    try {
      await client.query("BEGIN");
      this.logger.info({
        event: LOG_EVENTS.DB_TRANSACTION_STARTED,
        msg: "Transaction started",
      });

      const result = await callback(transactionClient);

      await client.query("COMMIT");
      this.logger.info({
        event: LOG_EVENTS.DB_TRANSACTION_COMMITTED,
        msg: "Transaction committed",
      });

      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.info({
        event: LOG_EVENTS.DB_TRANSACTION_ROLLED_BACK,
        msg: "Transaction rolled back",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const DATABASE_CLIENT_TOKEN = "DATABASE_CLIENT";
