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
  static toDomain(row: MetricRow): Metric {
    return {
      id: row.id,
      code: row.code,
      expressionType: row.expression_type as Metric["expressionType"],
      expressionJson: row.expression_json as ExpressionJson,
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
