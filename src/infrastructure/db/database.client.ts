import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { config } from "dotenv";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import { LOG_EVENTS } from "@/domain/constants/log-events";

// Cargar variables de entorno al importar el módulo
config();

class TransactionClientImpl implements TransactionClient {
  constructor(private readonly client: PoolClient) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.client.query<T>(text, params);
  }

  release(): void {
    // El release se maneja en el método transaction
  }
}

export class PostgresDatabaseClient implements DatabaseClient {
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(appConfig: AppConfig, logger: Logger = defaultLogger) {
    this.logger = logger;
    this.pool = this.createPool(appConfig);
    this.setupPoolEventHandlers();
  }

  private createPool(appConfig: AppConfig): Pool {
    const connectionConfig: any = {
      host: process.env.DB_HOST || appConfig.database.host,
      port: parseInt(
        process.env.DB_PORT || String(appConfig.database.port),
        10,
      ),
      database: process.env.DB_NAME || appConfig.database.name,
      user: process.env.DB_USER || appConfig.database.user,
      password: process.env.DB_PASSWORD || appConfig.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: {
        rejectUnauthorized: false, // RDS uses AWS-managed certificates
      },
    };

    return new Pool(connectionConfig);
  }

  private setupPoolEventHandlers(): void {
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
