import { TransactionClient } from '../interfaces/database-client.interface';

export interface EventLog {
  eventKey: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  processedAt?: Date;
  runId?: string;
  createdAt: Date;
}

export interface EventLogRepository {
  create(
    event: Omit<EventLog, 'createdAt'>,
    client?: TransactionClient,
  ): Promise<EventLog>;
  findByEventKey(
    eventKey: string,
    client?: TransactionClient,
  ): Promise<EventLog | null>;
  markAsProcessed(
    eventKey: string,
    runId?: string,
    client?: TransactionClient,
  ): Promise<void>;
}

