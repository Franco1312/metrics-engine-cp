import { OnMetricRunCompletedUseCase } from "../../on-metric-run-completed.use-case";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricRunCompletedEventBuilder } from "../builders/metric-run-completed-event.builder";
import { MetricRunBuilder } from "@/application/services/tests/builders/metric-run.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

describe("OnMetricRunCompletedUseCase", () => {
  let useCase: OnMetricRunCompletedUseCase;
  let mockMetricRunRepository: jest.Mocked<MetricRunRepository>;
  let mockDatabaseClient: jest.Mocked<DatabaseClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockTransactionClient: jest.Mocked<TransactionClient>;

  beforeEach(() => {
    mockTransactionClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    mockMetricRunRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockDatabaseClient = {
      transaction: jest.fn((callback) => callback(mockTransactionClient)),
      query: jest.fn(),
      getClient: jest.fn(),
      close: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    useCase = new OnMetricRunCompletedUseCase(
      mockMetricRunRepository,
      mockDatabaseClient,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should update run to SUCCEEDED status with all fields", async () => {
      const versionTs = new Date("2024-01-01T10:00:00Z");
      const event = new MetricRunCompletedEventBuilder()
        .withRunId("run-123")
        .withMetricCode("test_metric")
        .asSuccess()
        .withVersionTs(versionTs)
        .withOutputManifest("s3://bucket/manifest.json")
        .withRowCount(1000)
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withStatus(METRIC_RUN_STATUS.SUCCEEDED)
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(existingRun);
      mockMetricRunRepository.update.mockResolvedValue(updatedRun);

      await useCase.execute(event);

      expect(mockMetricRunRepository.findById).toHaveBeenCalledWith(
        "run-123",
        mockTransactionClient,
      );
      expect(mockMetricRunRepository.update).toHaveBeenCalledWith(
        "run-123",
        {
          status: METRIC_RUN_STATUS.SUCCEEDED,
          finishedAt: expect.any(Date),
          versionTs: versionTs.toISOString(),
          manifestPath: "s3://bucket/manifest.json",
          rowCount: 1000,
          error: undefined,
        },
        mockTransactionClient,
      );
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_COMPLETED,
        msg: "Metric run success",
        data: {
          runId: "run-123",
          metricCode: "test_metric",
          status: "SUCCESS",
          finishedAt: expect.any(String),
          versionTs: versionTs.toISOString(),
          outputManifest: "s3://bucket/manifest.json",
          rowCount: 1000,
          error: undefined,
        },
      });
    });

    it("should update run to FAILED status with error message", async () => {
      const event = new MetricRunCompletedEventBuilder()
        .withRunId("run-123")
        .withMetricCode("test_metric")
        .asFailure("Processing failed: invalid data")
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withStatus(METRIC_RUN_STATUS.FAILED)
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(existingRun);
      mockMetricRunRepository.update.mockResolvedValue(updatedRun);

      await useCase.execute(event);

      expect(mockMetricRunRepository.update).toHaveBeenCalledWith(
        "run-123",
        {
          status: METRIC_RUN_STATUS.FAILED,
          finishedAt: expect.any(Date),
          versionTs: undefined,
          manifestPath: undefined,
          rowCount: undefined,
          error: "Processing failed: invalid data",
        },
        mockTransactionClient,
      );
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_FAILED,
        msg: "Metric run failure",
        data: {
          runId: "run-123",
          metricCode: "test_metric",
          status: "FAILURE",
          finishedAt: expect.any(String),
          versionTs: undefined,
          outputManifest: undefined,
          rowCount: undefined,
          error: "Processing failed: invalid data",
        },
      });
    });

    it("should handle optional fields when not provided", async () => {
      const event = new MetricRunCompletedEventBuilder()
        .withRunId("run-123")
        .withMetricCode("test_metric")
        .asSuccess()
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withStatus(METRIC_RUN_STATUS.SUCCEEDED)
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(existingRun);
      mockMetricRunRepository.update.mockResolvedValue(updatedRun);

      await useCase.execute(event);

      expect(mockMetricRunRepository.update).toHaveBeenCalledWith(
        "run-123",
        {
          status: METRIC_RUN_STATUS.SUCCEEDED,
          finishedAt: expect.any(Date),
          versionTs: undefined,
          manifestPath: undefined,
          rowCount: undefined,
          error: undefined,
        },
        mockTransactionClient,
      );
    });

    it("should log error when run is not found", async () => {
      const event = new MetricRunCompletedEventBuilder()
        .withRunId("run-not-found")
        .asSuccess()
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(null);

      await useCase.execute(event);

      expect(mockMetricRunRepository.update).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_COMPLETED,
        msg: "Run not found",
        data: { runId: "run-not-found" },
        err: expect.any(Error),
      });
    });
  });
});
