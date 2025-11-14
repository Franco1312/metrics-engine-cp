import {
  ExpressionType,
  ExpressionJson,
} from "@/domain/constants/expression-types";

/**
 * Input para una métrica (datasetId y seriesCode)
 */
export interface MetricInput {
  datasetId: string;
  seriesCode: string;
}

/**
 * Información de un dataset en el catálogo
 */
export interface DatasetCatalogInfo {
  manifestPath: string;
  projectionsPath: string;
}

/**
 * Catálogo de datasets disponibles
 */
export interface DatasetCatalog {
  datasets: Record<string, DatasetCatalogInfo>;
}

/**
 * Configuración de salida
 */
export interface MetricOutput {
  basePath: string;
}

/**
 * Evento que se publica para solicitar la ejecución de una métrica
 */
export interface MetricRunRequestEvent {
  type: "metric_run_requested";
  runId: string;
  metricCode: string;
  expressionType: ExpressionType;
  expressionJson: ExpressionJson;
  inputs: MetricInput[];
  catalog: DatasetCatalog;
  output: MetricOutput;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}
