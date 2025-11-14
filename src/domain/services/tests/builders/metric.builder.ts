import { Metric } from "@/domain/entities/metric.entity";
import {
  EXPRESSION_TYPES,
  SERIES_MATH_OPS,
  WINDOW_OPS,
  COMPOSITE_OPS,
  ExpressionJson,
} from "@/domain/constants/expression-types";

interface MetricData {
  id?: string;
  code?: string;
  expressionType?: Metric["expressionType"];
  expressionJson?: ExpressionJson;
  frequency?: string;
  unit?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MetricBuilder {
  private data: MetricData = {
    id: "metric-123",
    code: "test_metric",
    expressionType: EXPRESSION_TYPES.SERIES_MATH,
    expressionJson: {
      op: SERIES_MATH_OPS.RATIO,
      left: { seriesCode: "series1" },
      right: { seriesCode: "series2" },
    },
    frequency: "daily",
    unit: "ratio",
    description: "Test metric",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withCode(code: string): this {
    this.data.code = code;
    return this;
  }

  withExpressionType(type: Metric["expressionType"]): this {
    this.data.expressionType = type;
    return this;
  }

  withExpressionJson(json: ExpressionJson): this {
    this.data.expressionJson = json;
    return this;
  }

  withSeriesMathExpression(
    op: (typeof SERIES_MATH_OPS)[keyof typeof SERIES_MATH_OPS],
    leftSeries: string,
    rightSeries: string,
  ): this {
    this.data.expressionType = EXPRESSION_TYPES.SERIES_MATH;
    this.data.expressionJson = {
      op,
      left: { seriesCode: leftSeries },
      right: { seriesCode: rightSeries },
    };
    return this;
  }

  withWindowOpExpression(
    op: (typeof WINDOW_OPS)[keyof typeof WINDOW_OPS],
    series: string,
    window: number,
  ): this {
    this.data.expressionType = EXPRESSION_TYPES.WINDOW_OP;
    this.data.expressionJson = {
      op,
      series: { seriesCode: series },
      window,
    };
    return this;
  }

  withCompositeExpression(
    op: (typeof COMPOSITE_OPS)[keyof typeof COMPOSITE_OPS],
    seriesCodes: string[],
  ): this {
    this.data.expressionType = EXPRESSION_TYPES.COMPOSITE;
    this.data.expressionJson = {
      op,
      operands: seriesCodes.map((code) => ({ seriesCode: code })),
    };
    return this;
  }

  withNestedExpression(): this {
    this.data.expressionType = EXPRESSION_TYPES.SERIES_MATH;
    this.data.expressionJson = {
      op: SERIES_MATH_OPS.RATIO,
      left: {
        op: SERIES_MATH_OPS.MULTIPLY,
        left: { seriesCode: "series1" },
        right: { seriesCode: "series2" },
      },
      right: { seriesCode: "series3" },
    };
    return this;
  }

  build(): Metric {
    return {
      id: this.data.id!,
      code: this.data.code!,
      expressionType: this.data.expressionType!,
      expressionJson: this.data.expressionJson!,
      frequency: this.data.frequency,
      unit: this.data.unit,
      description: this.data.description,
      createdAt: this.data.createdAt!,
      updatedAt: this.data.updatedAt!,
    };
  }
}
