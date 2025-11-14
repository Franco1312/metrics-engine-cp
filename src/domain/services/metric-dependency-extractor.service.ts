import { Metric } from "@/domain/entities/metric.entity";
import {
  ExpressionJson,
  SeriesMathExpression,
  WindowOpExpression,
  CompositeExpression,
  SeriesReference,
} from "@/domain/constants/expression-types";

/**
 * Servicio de dominio para extraer dependencias de métricas
 * Lógica de negocio pura sin dependencias externas
 */
export class MetricDependencyExtractorService {
  /**
   * Extrae los códigos de series requeridos de una métrica
   *
   * @param metric - La métrica de la cual extraer las dependencias
   * @returns Array de códigos de series únicos requeridos por la métrica
   */
  static extractSeriesCodes(metric: Metric): string[] {
    const seriesCodes = new Set<string>();

    this.extractSeriesFromExpression(metric.expressionJson, seriesCodes);

    return Array.from(seriesCodes);
  }

  /**
   * Extrae códigos de series de una expresión recursivamente
   *
   * @param expression - La expresión JSON a procesar
   * @param seriesCodes - Set donde se acumulan los códigos de series
   */
  private static extractSeriesFromExpression(
    expression: ExpressionJson,
    seriesCodes: Set<string>,
  ): void {
    if (this.isSeriesMathExpression(expression)) {
      // Expresión de tipo series_math
      this.extractFromSeriesReference(expression.left, seriesCodes);
      this.extractFromSeriesReference(expression.right, seriesCodes);
    } else if (this.isWindowOpExpression(expression)) {
      // Expresión de tipo window_op
      this.extractFromSeriesReference(expression.series, seriesCodes);
    } else if (this.isCompositeExpression(expression)) {
      // Expresión de tipo composite
      for (const operand of expression.operands) {
        if (this.isSeriesReference(operand)) {
          seriesCodes.add(operand.seriesCode);
        }
      }
    }
  }

  /**
   * Extrae códigos de series de una referencia o expresión anidada
   */
  private static extractFromSeriesReference(
    refOrExpr: SeriesReference | ExpressionJson,
    seriesCodes: Set<string>,
  ): void {
    if (this.isSeriesReference(refOrExpr)) {
      seriesCodes.add(refOrExpr.seriesCode);
    } else {
      // Es una expresión anidada, procesarla recursivamente
      this.extractSeriesFromExpression(refOrExpr, seriesCodes);
    }
  }

  /**
   * Verifica si un valor es una referencia a una serie
   */
  private static isSeriesReference(
    value: SeriesReference | ExpressionJson,
  ): value is SeriesReference {
    return "seriesCode" in value && typeof value.seriesCode === "string";
  }

  /**
   * Verifica si una expresión es de tipo series_math
   */
  private static isSeriesMathExpression(
    expression: ExpressionJson,
  ): expression is SeriesMathExpression {
    return "op" in expression && "left" in expression && "right" in expression;
  }

  /**
   * Verifica si una expresión es de tipo window_op
   */
  private static isWindowOpExpression(
    expression: ExpressionJson,
  ): expression is WindowOpExpression {
    return "window" in expression && "series" in expression;
  }

  /**
   * Verifica si una expresión es de tipo composite
   */
  private static isCompositeExpression(
    expression: ExpressionJson,
  ): expression is CompositeExpression {
    return "operands" in expression && Array.isArray(expression.operands);
  }
}
