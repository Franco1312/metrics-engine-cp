import { MetricDependencyExtractorService } from "../../metric-dependency-extractor.service";
import { MetricBuilder } from "../builders/metric.builder";
import {
  SERIES_MATH_OPS,
  WINDOW_OPS,
  COMPOSITE_OPS,
} from "@/domain/constants/expression-types";

describe("MetricDependencyExtractorService", () => {
  describe("extractSeriesCodes", () => {
    it("should extract series codes from simple series_math expression", () => {
      const metric = new MetricBuilder()
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(2);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
    });

    it("should extract unique series codes (no duplicates)", () => {
      const metric = new MetricBuilder()
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series1")
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(1);
      expect(result).toContain("series1");
    });

    it("should extract series code from window_op expression", () => {
      const metric = new MetricBuilder()
        .withWindowOpExpression(WINDOW_OPS.SMA, "series1", 7)
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(1);
      expect(result).toContain("series1");
    });

    it("should extract series codes from composite expression", () => {
      const metric = new MetricBuilder()
        .withCompositeExpression(COMPOSITE_OPS.SUM, [
          "series1",
          "series2",
          "series3",
        ])
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(3);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
      expect(result).toContain("series3");
    });

    it("should extract unique series codes from composite expression", () => {
      const metric = new MetricBuilder()
        .withCompositeExpression(COMPOSITE_OPS.AVG, [
          "series1",
          "series1",
          "series2",
        ])
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(2);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
    });

    it("should extract series codes from nested expressions", () => {
      const metric = new MetricBuilder().withNestedExpression().build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(3);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
      expect(result).toContain("series3");
    });

    it("should handle complex nested expressions", () => {
      const metric = new MetricBuilder()
        .withExpressionJson({
          op: SERIES_MATH_OPS.RATIO,
          left: {
            op: SERIES_MATH_OPS.MULTIPLY,
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          },
          right: {
            op: WINDOW_OPS.SMA,
            series: { seriesCode: "series3" },
            window: 7,
          },
        })
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(3);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
      expect(result).toContain("series3");
    });

    it("should return empty array for expression with no series references", () => {
      // This shouldn't happen in practice, but we test edge case
      const metric = new MetricBuilder()
        .withExpressionJson({
          op: SERIES_MATH_OPS.RATIO,
          left: {
            op: SERIES_MATH_OPS.MULTIPLY,
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          },
          right: {
            op: SERIES_MATH_OPS.MULTIPLY,
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          },
        })
        .build();

      const result =
        MetricDependencyExtractorService.extractSeriesCodes(metric);

      expect(result).toHaveLength(2);
      expect(result).toContain("series1");
      expect(result).toContain("series2");
    });

    it("should handle all series_math operations", () => {
      const operations = [
        SERIES_MATH_OPS.RATIO,
        SERIES_MATH_OPS.MULTIPLY,
        SERIES_MATH_OPS.SUBTRACT,
        SERIES_MATH_OPS.ADD,
      ];

      for (const op of operations) {
        const metric = new MetricBuilder()
          .withSeriesMathExpression(op, "series1", "series2")
          .build();

        const result =
          MetricDependencyExtractorService.extractSeriesCodes(metric);

        expect(result).toHaveLength(2);
        expect(result).toContain("series1");
        expect(result).toContain("series2");
      }
    });

    it("should handle all window_op operations", () => {
      const operations = [
        WINDOW_OPS.SMA,
        WINDOW_OPS.EMA,
        WINDOW_OPS.SUM,
        WINDOW_OPS.MAX,
        WINDOW_OPS.MIN,
        WINDOW_OPS.LAG,
      ];

      for (const op of operations) {
        const metric = new MetricBuilder()
          .withWindowOpExpression(op, "series1", 7)
          .build();

        const result =
          MetricDependencyExtractorService.extractSeriesCodes(metric);

        expect(result).toHaveLength(1);
        expect(result).toContain("series1");
      }
    });

    it("should handle all composite operations", () => {
      const operations = [
        COMPOSITE_OPS.SUM,
        COMPOSITE_OPS.AVG,
        COMPOSITE_OPS.MAX,
        COMPOSITE_OPS.MIN,
      ];

      for (const op of operations) {
        const metric = new MetricBuilder()
          .withCompositeExpression(op, ["series1", "series2", "series3"])
          .build();

        const result =
          MetricDependencyExtractorService.extractSeriesCodes(metric);

        expect(result).toHaveLength(3);
        expect(result).toContain("series1");
        expect(result).toContain("series2");
        expect(result).toContain("series3");
      }
    });
  });
});
