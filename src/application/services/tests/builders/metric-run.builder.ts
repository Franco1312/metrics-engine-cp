import { MetricRun } from "@/domain/entities/metric-run.entity";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

interface MetricRunData {
  id?: string;
  metricId?: string;
  metricCode?: string;
  status?: MetricRun["status"];
  requestedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  lastHeartbeatAt?: Date;
  error?: string;
  versionTs?: string;
  manifestPath?: string;
  rowCount?: number;
}

export class MetricRunBuilder {
  private data: MetricRunData = {
    id: "run-123",
    metricId: "metric-123",
    metricCode: "test_metric",
    status: METRIC_RUN_STATUS.PENDING_DEPENDENCIES,
    requestedAt: new Date("2024-01-01T00:00:00Z"),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withMetricId(metricId: string): this {
    this.data.metricId = metricId;
    return this;
  }

  withMetricCode(code: string): this {
    this.data.metricCode = code;
    return this;
  }

  withStatus(status: MetricRun["status"]): this {
    this.data.status = status;
    return this;
  }

  withRequestedAt(date: Date): this {
    this.data.requestedAt = date;
    return this;
  }

  asPendingDependencies(): this {
    this.data.status = METRIC_RUN_STATUS.PENDING_DEPENDENCIES;
    return this;
  }

  asQueued(): this {
    this.data.status = METRIC_RUN_STATUS.QUEUED;
    return this;
  }

  build(): MetricRun {
    return {
      id: this.data.id!,
      metricId: this.data.metricId!,
      metricCode: this.data.metricCode!,
      status: this.data.status!,
      requestedAt: this.data.requestedAt!,
      startedAt: this.data.startedAt,
      finishedAt: this.data.finishedAt,
      lastHeartbeatAt: this.data.lastHeartbeatAt,
      error: this.data.error,
      versionTs: this.data.versionTs,
      manifestPath: this.data.manifestPath,
      rowCount: this.data.rowCount,
    };
  }
}
