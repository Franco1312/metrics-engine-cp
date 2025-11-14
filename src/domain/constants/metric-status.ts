/**
 * Estados posibles de una ejecución de métrica (metric run)
 */
export const METRIC_RUN_STATUS = {
  PENDING_DEPENDENCIES: 'pending_dependencies',
  QUEUED: 'queued',
  DISPATCHED: 'dispatched',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  TIMED_OUT: 'timed_out',
  CANCELED: 'canceled',
} as const;

export type MetricRunStatus =
  (typeof METRIC_RUN_STATUS)[keyof typeof METRIC_RUN_STATUS];

