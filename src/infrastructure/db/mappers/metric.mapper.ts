import { Metric } from "@/domain/entities/metric.entity";
import { ExpressionJson } from "@/domain/constants/expression-types";

interface MetricRow {
  id: string;
  code: string;
  expression_type: string;
  expression_json: unknown; // JSONB from DB
  frequency: string | null;
  unit: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export class MetricMapper {
  /**
   * Convierte un objeto JSON de snake_case a camelCase
   * Específicamente convierte series_code -> seriesCode recursivamente
   */
  private static normalizeExpressionJson(json: unknown): ExpressionJson {
    if (!json || typeof json !== "object") {
      return json as ExpressionJson;
    }

    const convertSeriesCode = (obj: any): any => {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(convertSeriesCode);
      }

      const converted: any = {};

      for (const [key, value] of Object.entries(obj)) {
        if (key === "series_code") {
          converted.seriesCode = convertSeriesCode(value);
        } else {
          converted[key] = convertSeriesCode(value);
        }
      }

      return converted;
    };

    return convertSeriesCode(json) as ExpressionJson;
  }

  static toDomain(row: MetricRow): Metric {
    return {
      id: row.id,
      code: row.code,
      expressionType: row.expression_type as Metric["expressionType"],
      expressionJson: this.normalizeExpressionJson(row.expression_json),
      frequency: row.frequency ?? undefined,
      unit: row.unit ?? undefined,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static toDomainList(rows: MetricRow[]): Metric[] {
    return rows.map((row) => this.toDomain(row));
  }
}
