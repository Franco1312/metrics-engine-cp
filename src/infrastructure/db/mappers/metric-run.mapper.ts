import { MetricRun } from "@/domain/entities/metric-run.entity";
import { MetricRunStatus } from "@/domain/constants/metric-status";

interface MetricRunRow {
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
}

export class MetricRunMapper {
  static toDomain(row: MetricRunRow): MetricRun {
    return {
      id: row.id,
      metricId: row.metric_id,
      metricCode: row.metric_code,
      status: row.status as MetricRunStatus,
      requestedAt: row.requested_at,
      startedAt: row.started_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      lastHeartbeatAt: row.last_heartbeat_at ?? undefined,
      error: row.error ?? undefined,
      versionTs: row.version_ts ?? undefined,
      manifestPath: row.manifest_path ?? undefined,
      rowCount: row.row_count ?? undefined,
    };
  }

  static toDomainList(rows: MetricRunRow[]): MetricRun[] {
    return rows.map((row) => this.toDomain(row));
  }

  static toRow(
    run: Omit<MetricRun, "id" | "requestedAt">,
  ): Omit<MetricRunRow, "id" | "requested_at"> {
    return {
      metric_id: run.metricId,
      metric_code: run.metricCode,
      status: run.status,
      started_at: run.startedAt ?? null,
      finished_at: run.finishedAt ?? null,
      last_heartbeat_at: run.lastHeartbeatAt ?? null,
      error: run.error ?? null,
      version_ts: run.versionTs ?? null,
      manifest_path: run.manifestPath ?? null,
      row_count: run.rowCount ?? null,
    };
  }
}
