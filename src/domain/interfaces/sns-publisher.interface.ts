import { MetricRunRequestEvent } from '@/domain/dto/metric-run-request-event.dto';

/**
 * Interfaz para publicar eventos a SNS
 */
export interface SNSPublisher {
  /**
   * Publica un evento de solicitud de ejecución de métrica
   */
  publishMetricRunRequest(event: MetricRunRequestEvent): Promise<void>;
}

