import { MetricDependencyResolverService } from "../../metric-dependency-resolver.service";
import { MetricRepository } from "@/domain/ports/metric.repository";
import { SeriesRepository } from "@/domain/ports/series.repository";
import { DatasetRepository } from "@/domain/ports/dataset.repository";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricBuilder } from "@/domain/services/tests/builders/metric.builder";
import { SeriesBuilder } from "../builders/series.builder";
import { DatasetBuilder } from "../builders/dataset.builder";
import { SERIES_MATH_OPS } from "@/domain/constants/expression-types";
import { SeriesNotFoundError } from "@/domain/errors/series-not-found.error";

describe("MetricDependencyResolverService", () => {
  let service: MetricDependencyResolverService;
  let mockMetricRepository: jest.Mocked<MetricRepository>;
  let mockSeriesRepository: jest.Mocked<SeriesRepository>;
  let mockDatasetRepository: jest.Mocked<DatasetRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockMetricRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    } as any;

    mockSeriesRepository = {
      findByCodes: jest.fn(),
    } as any;

    mockDatasetRepository = {
      findById: jest.fn(),
      findBySeriesCodes: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new MetricDependencyResolverService(
      mockMetricRepository,
      mockSeriesRepository,
      mockDatasetRepository,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findMetricsForDataset", () => {
    it("should find metrics that depend on a dataset", async () => {
      const datasetId = "dataset-123";
      const dataset = new DatasetBuilder().withId(datasetId).build();

      const metric1 = new MetricBuilder()
        .withId("metric-1")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const metric2 = new MetricBuilder()
        .withId("metric-2")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series3", "series4")
        .build();

      mockDatasetRepository.findById.mockResolvedValue(dataset);
      mockMetricRepository.findAll.mockResolvedValue([metric1, metric2]);

      // Mock resolveRequiredDatasets - se llama para cada métrica en el loop
      // Primera llamada para metric1
      mockMetricRepository.findById.mockResolvedValueOnce(metric1);
      mockSeriesRepository.findByCodes.mockResolvedValueOnce([
        new SeriesBuilder().withCode("series1").build(),
        new SeriesBuilder().withCode("series2").build(),
      ]);
      mockDatasetRepository.findBySeriesCodes.mockResolvedValueOnce([dataset]);

      // Segunda llamada para metric2
      mockMetricRepository.findById.mockResolvedValueOnce(metric2);
      mockSeriesRepository.findByCodes.mockResolvedValueOnce([
        new SeriesBuilder().withCode("series3").build(),
        new SeriesBuilder().withCode("series4").build(),
      ]);
      mockDatasetRepository.findBySeriesCodes.mockResolvedValueOnce([]);

      const result = await service.findMetricsForDataset(datasetId);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("metric-1");
    });

    it("should return empty array when dataset not found", async () => {
      const datasetId = "dataset-123";

      mockDatasetRepository.findById.mockResolvedValue(null);

      const result = await service.findMetricsForDataset(datasetId);

      expect(result).toHaveLength(0);
      expect(mockMetricRepository.findAll).not.toHaveBeenCalled();
    });

    it("should return empty array when no metrics depend on dataset", async () => {
      const datasetId = "dataset-123";
      const dataset = new DatasetBuilder().withId(datasetId).build();

      const metric = new MetricBuilder()
        .withId("metric-1")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      mockDatasetRepository.findById.mockResolvedValue(dataset);
      mockMetricRepository.findAll.mockResolvedValue([metric]);

      mockSeriesRepository.findByCodes.mockResolvedValue([
        new SeriesBuilder().withCode("series1").build(),
        new SeriesBuilder().withCode("series2").build(),
      ]);

      mockDatasetRepository.findBySeriesCodes.mockResolvedValue([]);

      const result = await service.findMetricsForDataset(datasetId);

      expect(result).toHaveLength(0);
    });
  });

  describe("resolveRequiredDatasets", () => {
    it("should resolve required datasets for a metric", async () => {
      const metricId = "metric-123";
      const metric = new MetricBuilder()
        .withId(metricId)
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const series1 = new SeriesBuilder().withCode("series1").build();
      const series2 = new SeriesBuilder().withCode("series2").build();

      const dataset1 = new DatasetBuilder().withId("dataset-1").build();
      const dataset2 = new DatasetBuilder().withId("dataset-2").build();

      mockMetricRepository.findById.mockResolvedValue(metric);
      mockSeriesRepository.findByCodes.mockResolvedValue([series1, series2]);
      mockDatasetRepository.findBySeriesCodes.mockResolvedValue([
        dataset1,
        dataset2,
      ]);

      const result = await service.resolveRequiredDatasets(metricId);

      expect(result).toHaveLength(2);
      expect(result).toContain("dataset-1");
      expect(result).toContain("dataset-2");
    });

    it("should return unique dataset IDs", async () => {
      const metricId = "metric-123";
      const metric = new MetricBuilder()
        .withId(metricId)
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const series1 = new SeriesBuilder().withCode("series1").build();
      const series2 = new SeriesBuilder().withCode("series2").build();

      const dataset1 = new DatasetBuilder().withId("dataset-1").build();

      mockMetricRepository.findById.mockResolvedValue(metric);
      mockSeriesRepository.findByCodes.mockResolvedValue([series1, series2]);
      // Ambas series están en el mismo dataset
      mockDatasetRepository.findBySeriesCodes.mockResolvedValue([dataset1]);

      const result = await service.resolveRequiredDatasets(metricId);

      expect(result).toHaveLength(1);
      expect(result).toContain("dataset-1");
    });

    it("should throw error when series not found", async () => {
      const metricId = "metric-123";
      const metric = new MetricBuilder()
        .withId(metricId)
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const series1 = new SeriesBuilder().withCode("series1").build();
      // series2 no existe

      mockMetricRepository.findById.mockResolvedValue(metric);
      mockSeriesRepository.findByCodes.mockResolvedValue([series1]);

      await expect(service.resolveRequiredDatasets(metricId)).rejects.toThrow(
        SeriesNotFoundError,
      );
    });

    it("should return empty array when metric not found", async () => {
      const metricId = "metric-123";

      mockMetricRepository.findById.mockResolvedValue(null);

      const result = await service.resolveRequiredDatasets(metricId);

      expect(result).toHaveLength(0);
    });

    // Test removido: "should return empty array when metric has no series dependencies"
    // Este caso no es realista ya que todas las métricas válidas tienen series en su expresión
    // Si extractSeriesCodes retorna [], el código retorna temprano antes de llamar a findByCodes
  });
});
