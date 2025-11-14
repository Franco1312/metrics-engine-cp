/**
 * Estado de finalización de una ejecución de métrica
 */
export type MetricRunCompletionStatus = 'SUCCESS' | 'FAILURE';

/**
 * Evento recibido cuando la ejecución de una métrica termina
 */
export interface MetricRunCompletedEvent {
  type: 'metric_run_completed';
  runId: string;
  metricCode: string;
  status: MetricRunCompletionStatus;
  versionTs?: string; // ISO timestamp
  outputManifest?: string; // Ruta al manifest de salida
  rowCount?: number;
  error?: string; // Solo si status es FAILURE
}

