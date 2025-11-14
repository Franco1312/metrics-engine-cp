import {
  MetricExpressionValidator,
  MetricExpressionValidationError,
} from "../../metric-expression.validator";
import { MetricBuilder } from "@/domain/services/tests/builders/metric.builder";
import {
  EXPRESSION_TYPES,
  SERIES_MATH_OPS,
  WINDOW_OPS,
  COMPOSITE_OPS,
} from "@/domain/constants/expression-types";

describe("MetricExpressionValidator", () => {
  describe("validateMetric", () => {
    describe("valid expressions", () => {
      it("should validate a valid series_math expression", () => {
        const metric = new MetricBuilder()
          .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
          .build();

        expect(() =>
          MetricExpressionValidator.validateMetric(metric),
        ).not.toThrow();
      });

      it("should validate a valid window_op expression", () => {
        const metric = new MetricBuilder()
          .withWindowOpExpression(WINDOW_OPS.SMA, "series1", 7)
          .build();

        expect(() =>
          MetricExpressionValidator.validateMetric(metric),
        ).not.toThrow();
      });

      it("should validate a valid composite expression", () => {
        const metric = new MetricBuilder()
          .withCompositeExpression(COMPOSITE_OPS.SUM, ["series1", "series2"])
          .build();

        expect(() =>
          MetricExpressionValidator.validateMetric(metric),
        ).not.toThrow();
      });

      it("should validate nested expressions", () => {
        const metric = new MetricBuilder()
          .withNestedSeriesMathExpression(
            SERIES_MATH_OPS.MULTIPLY,
            SERIES_MATH_OPS.RATIO,
            "series1",
            "series2",
            "series3",
          )
          .build();

        expect(() =>
          MetricExpressionValidator.validateMetric(metric),
        ).not.toThrow();
      });

      it("should validate series_math with scale", () => {
        const metric = new MetricBuilder()
          .withSeriesMathExpression(
            SERIES_MATH_OPS.RATIO,
            "series1",
            "series2",
            100,
          )
          .build();

        expect(() =>
          MetricExpressionValidator.validateMetric(metric),
        ).not.toThrow();
      });
    });

    describe("invalid metric code", () => {
      it("should throw error when code is empty", () => {
        const metric = new MetricBuilder().withCode("").build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Metric code is required and cannot be empty",
        );
      });

      it("should throw error when code is missing", () => {
        const metric = new MetricBuilder().withCode(undefined as any).build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
      });
    });

    describe("invalid expression type", () => {
      it("should throw error when expressionType is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(undefined as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Expression type is required",
        );
      });

      it("should throw error when expressionType does not match expressionJson structure", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: WINDOW_OPS.SMA,
            series: { seriesCode: "series1" },
            window: 7,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "does not match series_math structure",
        );
      });
    });

    describe("invalid series_math expressions", () => {
      it("should throw error when op is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "does not match series_math structure",
        );
      });

      it("should throw error when op is invalid", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: "invalid_op",
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Invalid series math operation",
        );
      });

      it("should throw error when left is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            right: { seriesCode: "series2" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "does not match series_math structure",
        );
      });

      it("should throw error when right is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            left: { seriesCode: "series1" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "does not match series_math structure",
        );
      });

      it("should throw error when scale is not positive", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
            scale: -1,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Scale must be a positive number",
        );
      });

      it("should throw error when left seriesCode is empty", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            left: { seriesCode: "" },
            right: { seriesCode: "series2" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Series code must be a non-empty string",
        );
      });
    });

    describe("invalid window_op expressions", () => {
      it("should throw error when op is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.WINDOW_OP)
          .withExpressionJson({
            series: { seriesCode: "series1" },
            window: 7,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
      });

      it("should throw error when op is invalid", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.WINDOW_OP)
          .withExpressionJson({
            op: "invalid_op",
            series: { seriesCode: "series1" },
            window: 7,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Invalid window operation",
        );
      });

      it("should throw error when window is not positive", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.WINDOW_OP)
          .withExpressionJson({
            op: WINDOW_OPS.SMA,
            series: { seriesCode: "series1" },
            window: 0,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Window must be a positive number",
        );
      });

      it("should throw error when series is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.WINDOW_OP)
          .withExpressionJson({
            op: WINDOW_OPS.SMA,
            window: 7,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
      });
    });

    describe("invalid composite expressions", () => {
      it("should throw error when op is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.COMPOSITE)
          .withExpressionJson({
            operands: [{ seriesCode: "series1" }],
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
      });

      it("should throw error when op is invalid", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.COMPOSITE)
          .withExpressionJson({
            op: "invalid_op",
            operands: [{ seriesCode: "series1" }],
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "Invalid composite operation",
        );
      });

      it("should throw error when operands is missing", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.COMPOSITE)
          .withExpressionJson({
            op: COMPOSITE_OPS.SUM,
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "does not match composite structure",
        );
      });

      it("should throw error when operands is empty", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.COMPOSITE)
          .withExpressionJson({
            op: COMPOSITE_OPS.SUM,
            operands: [],
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "must have at least one operand",
        );
      });
    });

    describe("invalid nested expressions", () => {
      it("should throw error when nested expression is invalid", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            left: {
              op: "invalid_op", // Invalid nested op
              left: { seriesCode: "series1" },
              right: { seriesCode: "series2" },
            },
            right: { seriesCode: "series3" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
      });

      it("should throw error when operand is neither SeriesReference nor ExpressionJson", () => {
        const metric = new MetricBuilder()
          .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
          .withExpressionJson({
            op: SERIES_MATH_OPS.RATIO,
            left: {}, // Invalid: no seriesCode and no op
            right: { seriesCode: "series2" },
          } as any)
          .build();

        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          MetricExpressionValidationError,
        );
        expect(() => MetricExpressionValidator.validateMetric(metric)).toThrow(
          "must be either a SeriesReference",
        );
      });
    });
  });
});
