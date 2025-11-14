/**
 * Evento recibido cuando el procesador de métricas comienza a ejecutar una métrica
 */
export interface MetricRunStartedEvent {
  type: "metric_run_started";
  runId: string;
  startedAt?: string; // ISO timestamp
}
