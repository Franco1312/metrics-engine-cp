import { OnMetricRunStartedUseCase } from "../../on-metric-run-started.use-case";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricRunStartedEventBuilder } from "../builders/metric-run-started-event.builder";
import { MetricRunBuilder } from "@/application/services/tests/builders/metric-run.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

describe("OnMetricRunStartedUseCase", () => {
  let useCase: OnMetricRunStartedUseCase;
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

    useCase = new OnMetricRunStartedUseCase(
      mockMetricRunRepository,
      mockDatabaseClient,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should update run status to RUNNING and set startedAt", async () => {
      const event = new MetricRunStartedEventBuilder()
        .withRunId("run-123")
        .withStartedAt(new Date("2024-01-01T10:00:00Z"))
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .withStatus(METRIC_RUN_STATUS.QUEUED)
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .withStatus(METRIC_RUN_STATUS.RUNNING)
        .withStartedAt(new Date("2024-01-01T10:00:00Z"))
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
          status: METRIC_RUN_STATUS.RUNNING,
          startedAt: new Date("2024-01-01T10:00:00Z"),
        },
        mockTransactionClient,
      );
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_STARTED,
        msg: "Metric run started",
        data: {
          runId: "run-123",
          metricCode: "test_metric",
          startedAt: "2024-01-01T10:00:00.000Z",
        },
      });
    });

    it("should use current date when startedAt is not provided", async () => {
      const event = new MetricRunStartedEventBuilder()
        .withRunId("run-123")
        .withoutStartedAt()
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withStatus(METRIC_RUN_STATUS.RUNNING)
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(existingRun);
      mockMetricRunRepository.update.mockResolvedValue(updatedRun);

      const beforeExecution = new Date();
      await useCase.execute(event);
      const afterExecution = new Date();

      expect(mockMetricRunRepository.update).toHaveBeenCalledWith(
        "run-123",
        {
          status: METRIC_RUN_STATUS.RUNNING,
          startedAt: expect.any(Date),
        },
        mockTransactionClient,
      );

      const calledStartedAt = (
        mockMetricRunRepository.update.mock.calls[0][1] as {
          startedAt: Date;
        }
      ).startedAt;
      expect(calledStartedAt.getTime()).toBeGreaterThanOrEqual(
        beforeExecution.getTime(),
      );
      expect(calledStartedAt.getTime()).toBeLessThanOrEqual(
        afterExecution.getTime(),
      );
    });

    it("should log error when run is not found", async () => {
      const event = new MetricRunStartedEventBuilder()
        .withRunId("run-not-found")
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(null);

      await useCase.execute(event);

      expect(mockMetricRunRepository.update).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_STARTED,
        msg: "Run not found",
        data: { runId: "run-not-found" },
        err: expect.any(Error),
      });
    });
  });
});
