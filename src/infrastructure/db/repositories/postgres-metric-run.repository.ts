import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { MetricRun } from "@/domain/entities/metric-run.entity";
import { MetricRunStatus } from "@/domain/constants/metric-status";
import {
  TransactionClient,
  DatabaseClient,
  QueryClient,
} from "@/domain/interfaces/database-client.interface";
import { MetricRunMapper } from "@/infrastructure/db/mappers/metric-run.mapper";

export class PostgresMetricRunRepository implements MetricRunRepository {
  constructor(private readonly dbClient: DatabaseClient) {}

  private getClient(client?: TransactionClient): QueryClient {
    return client ?? this.dbClient;
  }

  async create(
    run: Omit<MetricRun, "id" | "requestedAt">,
    client?: TransactionClient,
  ): Promise<MetricRun> {
    const dbClient = this.getClient(client);
    const row = MetricRunMapper.toRow(run);

    const result = await dbClient.query<{
      id: string;
      metric_id: string;
      metric_code: string;
      status: string;
      requested_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_heartbeat_at: Date | null;
      error: string | null;
      version_ts: string | null;
      manifest_path: string | null;
      row_count: number | null;
    }>(
      `INSERT INTO metric_runs 
       (metric_id, metric_code, status, started_at, finished_at, 
        last_heartbeat_at, error, version_ts, manifest_path, row_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        row.metric_id,
        row.metric_code,
        row.status,
        row.started_at,
        row.finished_at,
        row.last_heartbeat_at,
        row.error,
        row.version_ts,
        row.manifest_path,
        row.row_count,
      ],
    );

    if (!result.rows[0]) {
      throw new Error("Failed to create metric run");
    }
    return MetricRunMapper.toDomain(result.rows[0]);
  }

  async findById(
    id: string,
    client?: TransactionClient,
  ): Promise<MetricRun | null> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      metric_id: string;
      metric_code: string;
      status: string;
      requested_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_heartbeat_at: Date | null;
      error: string | null;
      version_ts: string | null;
      manifest_path: string | null;
      row_count: number | null;
    }>("SELECT * FROM metric_runs WHERE id = $1", [id]);

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return MetricRunMapper.toDomain(result.rows[0]);
  }

  async findByMetricId(
    metricId: string,
    client?: TransactionClient,
  ): Promise<MetricRun[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      metric_id: string;
      metric_code: string;
      status: string;
      requested_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_heartbeat_at: Date | null;
      error: string | null;
      version_ts: string | null;
      manifest_path: string | null;
      row_count: number | null;
    }>(
      "SELECT * FROM metric_runs WHERE metric_id = $1 ORDER BY requested_at DESC",
      [metricId],
    );

    return MetricRunMapper.toDomainList(result.rows);
  }

  async findByStatus(
    status: MetricRunStatus,
    client?: TransactionClient,
  ): Promise<MetricRun[]> {
    const dbClient = this.getClient(client);
    const result = await dbClient.query<{
      id: string;
      metric_id: string;
      metric_code: string;
      status: string;
      requested_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_heartbeat_at: Date | null;
      error: string | null;
      version_ts: string | null;
      manifest_path: string | null;
      row_count: number | null;
    }>(
      "SELECT * FROM metric_runs WHERE status = $1 ORDER BY requested_at DESC",
      [status],
    );

    return MetricRunMapper.toDomainList(result.rows);
  }

  async update(
    id: string,
    updates: Partial<Omit<MetricRun, "id" | "requestedAt">>,
    client?: TransactionClient,
  ): Promise<MetricRun> {
    const dbClient = this.getClient(client);
    const setParts: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.metricId !== undefined) {
      setParts.push(`metric_id = $${paramIndex++}`);
      values.push(updates.metricId);
    }
    if (updates.metricCode !== undefined) {
      setParts.push(`metric_code = $${paramIndex++}`);
      values.push(updates.metricCode);
    }
    if (updates.status !== undefined) {
      setParts.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.startedAt !== undefined) {
      setParts.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }
    if (updates.finishedAt !== undefined) {
      setParts.push(`finished_at = $${paramIndex++}`);
      values.push(updates.finishedAt);
    }
    if (updates.lastHeartbeatAt !== undefined) {
      setParts.push(`last_heartbeat_at = $${paramIndex++}`);
      values.push(updates.lastHeartbeatAt);
    }
    if (updates.error !== undefined) {
      setParts.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }
    if (updates.versionTs !== undefined) {
      setParts.push(`version_ts = $${paramIndex++}`);
      values.push(updates.versionTs);
    }
    if (updates.manifestPath !== undefined) {
      setParts.push(`manifest_path = $${paramIndex++}`);
      values.push(updates.manifestPath);
    }
    if (updates.rowCount !== undefined) {
      setParts.push(`row_count = $${paramIndex++}`);
      values.push(updates.rowCount);
    }

    if (setParts.length === 0) {
      // No updates, return existing
      const existing = await this.findById(id, client);
      if (!existing) {
        throw new Error(`MetricRun with id ${id} not found`);
      }
      return existing;
    }

    values.push(id);
    const query = `UPDATE metric_runs SET ${setParts.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const result = await dbClient.query<{
      id: string;
      metric_id: string;
      metric_code: string;
      status: string;
      requested_at: Date;
      started_at: Date | null;
      finished_at: Date | null;
      last_heartbeat_at: Date | null;
      error: string | null;
      version_ts: string | null;
      manifest_path: string | null;
      row_count: number | null;
    }>(query, values);

    if (!result.rows[0]) {
      throw new Error(`Failed to update metric run with id ${id}`);
    }
    return MetricRunMapper.toDomain(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: MetricRunStatus,
    client?: TransactionClient,
  ): Promise<MetricRun> {
    return this.update(id, { status }, client);
  }

  async linkDatasetUpdates(
    runId: string,
    datasetUpdateIds: string[],
    client?: TransactionClient,
  ): Promise<void> {
    const dbClient = this.getClient(client);

    for (const updateId of datasetUpdateIds) {
      await dbClient.query(
        `INSERT INTO run_dataset_updates (run_id, dataset_update_id)
         VALUES ($1, $2)
         ON CONFLICT (run_id, dataset_update_id) DO NOTHING`,
        [runId, updateId],
      );
    }
  }
}
