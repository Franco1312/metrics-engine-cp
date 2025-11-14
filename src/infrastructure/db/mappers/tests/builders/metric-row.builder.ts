import { EXPRESSION_TYPES } from "@/domain/constants/expression-types";

interface MetricRowData {
  id?: string;
  code?: string;
  expression_type?: string;
  expression_json?: unknown;
  frequency?: string | null;
  unit?: string | null;
  description?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export class MetricRowBuilder {
  private data: MetricRowData = {
    id: "metric-123",
    code: "test_metric",
    expression_type: EXPRESSION_TYPES.SERIES_MATH,
    expression_json: {
      op: "ratio",
      left: { seriesCode: "series1" },
      right: { seriesCode: "series2" },
    },
    frequency: "daily",
    unit: "ratio",
    description: "Test metric",
    created_at: new Date("2024-01-01T00:00:00Z"),
    updated_at: new Date("2024-01-01T00:00:00Z"),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withCode(code: string): this {
    this.data.code = code;
    return this;
  }

  withExpressionType(type: string): this {
    this.data.expression_type = type;
    return this;
  }

  withExpressionJson(json: unknown): this {
    this.data.expression_json = json;
    return this;
  }

  withFrequency(frequency: string | null): this {
    this.data.frequency = frequency;
    return this;
  }

  withUnit(unit: string | null): this {
    this.data.unit = unit;
    return this;
  }

  withDescription(description: string | null): this {
    this.data.description = description;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.created_at = date;
    return this;
  }

  withUpdatedAt(date: Date): this {
    this.data.updated_at = date;
    return this;
  }

  withNullOptionalFields(): this {
    this.data.frequency = null;
    this.data.unit = null;
    this.data.description = null;
    return this;
  }

  build() {
    return {
      id: this.data.id!,
      code: this.data.code!,
      expression_type: this.data.expression_type!,
      expression_json: this.data.expression_json!,
      frequency: this.data.frequency ?? null,
      unit: this.data.unit ?? null,
      description: this.data.description ?? null,
      created_at: this.data.created_at!,
      updated_at: this.data.updated_at!,
    };
  }
}
