import {
  EventLogRepository,
  EventLog,
} from "@/domain/ports/event-log.repository";
import {
  TransactionClient,
  DatabaseClient,
  QueryClient,
} from "@/domain/interfaces/database-client.interface";

export class PostgresEventLogRepository implements EventLogRepository {
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async create(
    event: Omit<EventLog, "createdAt">,
    client?: TransactionClient,
  ): Promise<EventLog> {
    const dbClient = this.getClient(client);

    // Try to insert, but if event_key already exists, return existing
    const result = await dbClient.query<{
      event_key: string;
      event_type: string;
      event_payload: unknown;
      processed_at: Date | null;
      run_id: string | null;
      created_at: Date;
    }>(
      `INSERT INTO event_log (event_key, event_type, event_payload, processed_at, run_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_key) DO NOTHING
       RETURNING *`,
      [
        event.eventKey,
        event.eventType,
        JSON.stringify(event.eventPayload),
        event.processedAt ?? null,
        event.runId ?? null,
      ],
    );

    if (result.rows.length === 0) {
      // Already exists, return existing
      const existing = await this.findByEventKey(event.eventKey, client);
      if (!existing) {
        throw new Error(
          `Failed to create or find event log with key ${event.eventKey}`,
        );
      }
      return existing;
    }

    if (!result.rows[0]) {
      throw new Error(`Failed to create event log with key ${event.eventKey}`);
    }
    return this.mapToDomain(result.rows[0]);
  }

  async findByEventKey(
    eventKey: string,
    client?: TransactionClient,
  ): Promise<EventLog | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      event_key: string;
      event_type: string;
      event_payload: unknown;
      processed_at: Date | null;
      run_id: string | null;
      created_at: Date;
    }>("SELECT * FROM event_log WHERE event_key = $1", [eventKey]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapToDomain(result.rows[0]);
  }

  async markAsProcessed(
    eventKey: string,
    runId?: string,
    client?: TransactionClient,
  ): Promise<void> {
    const dbClient = this.getClient(client);
    await dbClient.query(
      `UPDATE event_log 
       SET processed_at = NOW(), run_id = COALESCE($2, run_id)
       WHERE event_key = $1`,
      [eventKey, runId ?? null],
    );
  }

  private mapToDomain(row: {
    event_key: string;
    event_type: string;
    event_payload: unknown;
    processed_at: Date | null;
    run_id: string | null;
    created_at: Date;
  }): EventLog {
    return {
      eventKey: row.event_key,
      eventType: row.event_type,
      eventPayload:
        typeof row.event_payload === "string"
          ? JSON.parse(row.event_payload)
          : (row.event_payload as Record<string, unknown>),
      processedAt: row.processed_at ?? undefined,
      runId: row.run_id ?? undefined,
      createdAt: row.created_at,
    };
  }
}
