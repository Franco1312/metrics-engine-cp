import { MetricRunStatus } from "@/domain/constants/metric-status";

export interface MetricRun {
  id: string;
  metricId: string;
  metricCode: string;
  status: MetricRunStatus;
  requestedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  lastHeartbeatAt?: Date;
  error?: string;
  versionTs?: string;
  manifestPath?: string;
  rowCount?: number;
}
