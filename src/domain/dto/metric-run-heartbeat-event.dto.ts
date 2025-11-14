/**
 * Evento recibido periódicamente durante la ejecución de una métrica
 */
export interface MetricRunHeartbeatEvent {
  type: 'metric_run_heartbeat';
  runId: string;
  progress?: number; // 0-100
  ts: string; // ISO timestamp
}

