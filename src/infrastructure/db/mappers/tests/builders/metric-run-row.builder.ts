import { METRIC_RUN_STATUS } from '@/domain/constants/metric-status';

interface MetricRunRowData {
  id?: string;
  metric_id?: string;
  metric_code?: string;
  status?: string;
  requested_at?: Date;
  started_at?: Date | null;
  finished_at?: Date | null;
  last_heartbeat_at?: Date | null;
  error?: string | null;
  version_ts?: string | null;
  manifest_path?: string | null;
  row_count?: number | null;
}

export class MetricRunRowBuilder {
  private data: MetricRunRowData = {
    id: 'run-123',
    metric_id: 'metric-123',
    metric_code: 'test_metric',
    status: METRIC_RUN_STATUS.QUEUED,
    requested_at: new Date('2024-01-01T00:00:00Z'),
    started_at: null,
    finished_at: null,
    last_heartbeat_at: null,
    error: null,
    version_ts: null,
    manifest_path: null,
    row_count: null,
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withMetricId(metricId: string): this {
    this.data.metric_id = metricId;
    return this;
  }

  withMetricCode(code: string): this {
    this.data.metric_code = code;
    return this;
  }

  withStatus(status: string): this {
    this.data.status = status;
    return this;
  }

  withRequestedAt(date: Date): this {
    this.data.requested_at = date;
    return this;
  }

  withStartedAt(date: Date | null): this {
    this.data.started_at = date;
    return this;
  }

  withFinishedAt(date: Date | null): this {
    this.data.finished_at = date;
    return this;
  }

  withLastHeartbeatAt(date: Date | null): this {
    this.data.last_heartbeat_at = date;
    return this;
  }

  withError(error: string | null): this {
    this.data.error = error;
    return this;
  }

  withVersionTs(versionTs: string | null): this {
    this.data.version_ts = versionTs;
    return this;
  }

  withManifestPath(path: string | null): this {
    this.data.manifest_path = path;
    return this;
  }

  withRowCount(count: number | null): this {
    this.data.row_count = count;
    return this;
  }

  asRunning(): this {
    this.data.status = METRIC_RUN_STATUS.RUNNING;
    this.data.started_at = new Date('2024-01-01T01:00:00Z');
    this.data.last_heartbeat_at = new Date('2024-01-01T01:30:00Z');
    return this;
  }

  asSucceeded(): this {
    this.data.status = METRIC_RUN_STATUS.SUCCEEDED;
    this.data.finished_at = new Date('2024-01-01T02:00:00Z');
    this.data.version_ts = '2024-01-01T02:00:00Z';
    this.data.manifest_path = 's3://bucket/metrics/test_metric/manifest.json';
    this.data.row_count = 100;
    return this;
  }

  asFailed(): this {
    this.data.status = METRIC_RUN_STATUS.FAILED;
    this.data.finished_at = new Date('2024-01-01T02:00:00Z');
    this.data.error = 'Test error message';
    return this;
  }

  build() {
    return {
      id: this.data.id!,
      metric_id: this.data.metric_id!,
      metric_code: this.data.metric_code!,
      status: this.data.status!,
      requested_at: this.data.requested_at!,
      started_at: this.data.started_at ?? null,
      finished_at: this.data.finished_at ?? null,
      last_heartbeat_at: this.data.last_heartbeat_at ?? null,
      error: this.data.error ?? null,
      version_ts: this.data.version_ts ?? null,
      manifest_path: this.data.manifest_path ?? null,
      row_count: this.data.row_count ?? null,
    };
  }
}

