import { MetricRunOrchestratorService } from "../../metric-run-orchestrator.service";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { MetricRepository } from "@/domain/ports/metric.repository";
import { PendingDatasetRepository } from "@/domain/ports/pending-dataset.repository";
import { DatasetUpdateRepository } from "@/domain/ports/dataset-update.repository";
import { SeriesRepository } from "@/domain/ports/series.repository";
import { DatasetRepository } from "@/domain/ports/dataset.repository";
import { SNSPublisher } from "@/domain/interfaces/sns-publisher.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricBuilder } from "@/domain/services/tests/builders/metric.builder";
import { DatasetUpdateBuilder } from "@/domain/services/tests/builders/dataset-update.builder";
import { MetricRunBuilder } from "../builders/metric-run.builder";
import { SeriesBuilder } from "../builders/series.builder";
import { DatasetBuilder } from "../builders/dataset.builder";
import { SERIES_MATH_OPS } from "@/domain/constants/expression-types";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

describe("MetricRunOrchestratorService", () => {
  let service: MetricRunOrchestratorService;
  let mockMetricRunRepository: jest.Mocked<MetricRunRepository>;
  let mockMetricRepository: jest.Mocked<MetricRepository>;
  let mockPendingDatasetRepository: jest.Mocked<PendingDatasetRepository>;
  let mockDatasetUpdateRepository: jest.Mocked<DatasetUpdateRepository>;
  let mockSeriesRepository: jest.Mocked<SeriesRepository>;
  let mockDatasetRepository: jest.Mocked<DatasetRepository>;
  let mockSnsPublisher: jest.Mocked<SNSPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockMetricRunRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      linkDatasetUpdates: jest.fn(),
    } as any;

    mockMetricRepository = {
      findById: jest.fn(),
    } as any;

    mockPendingDatasetRepository = {
      create: jest.fn(),
      findByRunId: jest.fn(),
      countPendingByRunId: jest.fn(),
    } as any;

    mockDatasetUpdateRepository = {
      findLatestByDatasetId: jest.fn(),
    } as any;

    mockSeriesRepository = {
      findByCodes: jest.fn(),
    } as any;

    mockDatasetRepository = {
      findBySeriesCodes: jest.fn(),
    } as any;

    mockSnsPublisher = {
      publishMetricRunRequest: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new MetricRunOrchestratorService(
      mockMetricRunRepository,
      mockMetricRepository,
      mockPendingDatasetRepository,
      mockDatasetUpdateRepository,
      mockSeriesRepository,
      mockDatasetRepository,
      mockSnsPublisher,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createRunForMetric", () => {
    it("should create run and emit immediately when all dependencies are ready", async () => {
      const metric = new MetricBuilder()
        .withId("metric-123")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const currentDatasetId = "dataset-123";
      const currentUpdate = new DatasetUpdateBuilder()
        .withDatasetId(currentDatasetId)
        .build();

      const requiredDatasetIds = [currentDatasetId];

      const run = new MetricRunBuilder()
        .withId("run-123")
        .withMetricId(metric.id)
        .withMetricCode(metric.code)
        .asPendingDependencies()
        .build();

      const series1 = new SeriesBuilder().withCode("series1").build();
      const series2 = new SeriesBuilder().withCode("series2").build();
      const dataset = new DatasetBuilder().withId(currentDatasetId).build();

      mockMetricRunRepository.create.mockResolvedValue(run);
      mockPendingDatasetRepository.create.mockResolvedValue({
        runId: run.id,
        datasetId: currentDatasetId,
        requiredDays: 7,
        received: true,
        receivedUpdateId: currentUpdate.id,
        receivedAt: currentUpdate.createdAt,
        createdAt: new Date(),
      } as any);

      mockPendingDatasetRepository.countPendingByRunId.mockResolvedValue(0);

      // Para emitPendingRun (se llama desde createRunForMetric cuando pendingCount === 0)
      // Necesitamos que findById retorne el run cuando se llama desde emitPendingRun
      mockMetricRunRepository.findById.mockResolvedValue(run);
      mockMetricRepository.findById.mockResolvedValue(metric);
      mockPendingDatasetRepository.findByRunId.mockResolvedValue([
        {
          runId: run.id,
          datasetId: currentDatasetId,
          requiredDays: 7,
          received: true,
          receivedUpdateId: currentUpdate.id,
          receivedAt: currentUpdate.createdAt,
          createdAt: new Date(),
        } as any,
      ]);

      mockDatasetUpdateRepository.findLatestByDatasetId.mockResolvedValue(
        currentUpdate,
      );

      mockSeriesRepository.findByCodes.mockResolvedValue([series1, series2]);
      mockDatasetRepository.findBySeriesCodes
        .mockResolvedValueOnce([dataset]) // series1
        .mockResolvedValueOnce([dataset]); // series2

      mockMetricRunRepository.updateStatus.mockResolvedValue({
        ...run,
        status: METRIC_RUN_STATUS.QUEUED,
      });

      const result = await service.createRunForMetric(
        metric,
        currentDatasetId,
        currentUpdate,
        requiredDatasetIds,
      );

      expect(mockMetricRunRepository.create).toHaveBeenCalledWith(
        {
          metricId: metric.id,
          metricCode: metric.code,
          status: METRIC_RUN_STATUS.PENDING_DEPENDENCIES,
        },
        undefined,
      );

      expect(mockPendingDatasetRepository.create).toHaveBeenCalledTimes(1);
      expect(
        mockPendingDatasetRepository.countPendingByRunId,
      ).toHaveBeenCalled();
      expect(mockSnsPublisher.publishMetricRunRequest).toHaveBeenCalled();
      expect(mockMetricRunRepository.updateStatus).toHaveBeenCalledWith(
        run.id,
        METRIC_RUN_STATUS.QUEUED,
        undefined,
      );

      expect(result.id).toBe(run.id);
    });

    it("should create run as pending when dependencies are not ready", async () => {
      const metric = new MetricBuilder()
        .withId("metric-123")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const currentDatasetId = "dataset-123";
      const otherDatasetId = "dataset-456";
      const currentUpdate = new DatasetUpdateBuilder()
        .withDatasetId(currentDatasetId)
        .build();

      const requiredDatasetIds = [currentDatasetId, otherDatasetId];

      const run = new MetricRunBuilder()
        .withId("run-123")
        .withMetricId(metric.id)
        .withMetricCode(metric.code)
        .asPendingDependencies()
        .build();

      mockMetricRunRepository.create.mockResolvedValue(run);
      mockPendingDatasetRepository.create.mockResolvedValue({
        runId: run.id,
        datasetId: currentDatasetId,
        requiredDays: 7,
        received: true,
        receivedUpdateId: currentUpdate.id,
        receivedAt: currentUpdate.createdAt,
        createdAt: new Date(),
      } as any);

      // Hay una dependencia pendiente
      mockPendingDatasetRepository.countPendingByRunId.mockResolvedValue(1);

      const result = await service.createRunForMetric(
        metric,
        currentDatasetId,
        currentUpdate,
        requiredDatasetIds,
      );

      expect(mockPendingDatasetRepository.create).toHaveBeenCalledTimes(2);
      expect(
        mockPendingDatasetRepository.countPendingByRunId,
      ).toHaveBeenCalled();
      expect(mockSnsPublisher.publishMetricRunRequest).not.toHaveBeenCalled();
      expect(mockMetricRunRepository.updateStatus).not.toHaveBeenCalled();

      expect(result.id).toBe(run.id);
    });
  });

  describe("emitPendingRun", () => {
    it("should emit pending run when ready", async () => {
      const runId = "run-123";
      const run = new MetricRunBuilder()
        .withId(runId)
        .withMetricId("metric-123")
        .asPendingDependencies()
        .build();

      const metric = new MetricBuilder()
        .withId("metric-123")
        .withSeriesMathExpression(SERIES_MATH_OPS.RATIO, "series1", "series2")
        .build();

      const datasetId = "dataset-123";
      const update = new DatasetUpdateBuilder()
        .withDatasetId(datasetId)
        .build();
      const series1 = new SeriesBuilder().withCode("series1").build();
      const series2 = new SeriesBuilder().withCode("series2").build();
      const dataset = new DatasetBuilder().withId(datasetId).build();

      mockMetricRunRepository.findById.mockResolvedValue(run);
      mockMetricRepository.findById.mockResolvedValue(metric);
      mockPendingDatasetRepository.findByRunId.mockResolvedValue([
        {
          runId,
          datasetId,
          requiredDays: 7,
          received: true,
          receivedUpdateId: update.id,
          receivedAt: update.createdAt,
          createdAt: new Date(),
        } as any,
      ]);

      mockDatasetUpdateRepository.findLatestByDatasetId.mockResolvedValue(
        update,
      );

      mockSeriesRepository.findByCodes.mockResolvedValue([series1, series2]);
      mockDatasetRepository.findBySeriesCodes
        .mockResolvedValueOnce([dataset]) // series1
        .mockResolvedValueOnce([dataset]); // series2

      mockMetricRunRepository.updateStatus.mockResolvedValue({
        ...run,
        status: METRIC_RUN_STATUS.QUEUED,
      });

      await service.emitPendingRun(runId);

      expect(mockSnsPublisher.publishMetricRunRequest).toHaveBeenCalled();
      expect(mockMetricRunRepository.updateStatus).toHaveBeenCalledWith(
        runId,
        METRIC_RUN_STATUS.QUEUED,
        undefined,
      );
    });

    it("should throw error when run not found", async () => {
      const runId = "run-123";

      mockMetricRunRepository.findById.mockResolvedValue(null);

      await expect(service.emitPendingRun(runId)).rejects.toThrow(
        `Run not found: ${runId}`,
      );
    });

    it("should throw error when run is not in pending_dependencies status", async () => {
      const runId = "run-123";
      const run = new MetricRunBuilder().withId(runId).asQueued().build();

      mockMetricRunRepository.findById.mockResolvedValue(run);

      await expect(service.emitPendingRun(runId)).rejects.toThrow(
        `Run ${runId} is not in pending_dependencies status`,
      );
    });
  });
});
