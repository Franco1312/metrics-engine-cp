import { OnMetricRunHeartbeatUseCase } from "../../on-metric-run-heartbeat.use-case";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricRunHeartbeatEventBuilder } from "../builders/metric-run-heartbeat-event.builder";
import { MetricRunBuilder } from "@/application/services/tests/builders/metric-run.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";

describe("OnMetricRunHeartbeatUseCase", () => {
  let useCase: OnMetricRunHeartbeatUseCase;
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

    useCase = new OnMetricRunHeartbeatUseCase(
      mockMetricRunRepository,
      mockDatabaseClient,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should update lastHeartbeatAt with timestamp from event", async () => {
      const heartbeatTime = new Date("2024-01-01T10:00:00Z");
      const event = new MetricRunHeartbeatEventBuilder()
        .withRunId("run-123")
        .withTs(heartbeatTime)
        .withProgress(75)
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
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
          lastHeartbeatAt: heartbeatTime,
        },
        mockTransactionClient,
      );
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_HEARTBEAT,
        msg: "Metric run heartbeat received",
        data: {
          runId: "run-123",
          metricCode: "test_metric",
          heartbeatAt: "2024-01-01T10:00:00.000Z",
          progress: 75,
        },
      });
    });

    it("should handle heartbeat without progress", async () => {
      const heartbeatTime = new Date("2024-01-01T10:00:00Z");
      const event = new MetricRunHeartbeatEventBuilder()
        .withRunId("run-123")
        .withTs(heartbeatTime)
        .withoutProgress()
        .build();

      const existingRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      const updatedRun = new MetricRunBuilder()
        .withId("run-123")
        .withMetricCode("test_metric")
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(existingRun);
      mockMetricRunRepository.update.mockResolvedValue(updatedRun);

      await useCase.execute(event);

      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_HEARTBEAT,
        msg: "Metric run heartbeat received",
        data: {
          runId: "run-123",
          metricCode: "test_metric",
          heartbeatAt: "2024-01-01T10:00:00.000Z",
          progress: undefined,
        },
      });
    });

    it("should log error when run is not found", async () => {
      const event = new MetricRunHeartbeatEventBuilder()
        .withRunId("run-not-found")
        .build();

      mockMetricRunRepository.findById.mockResolvedValue(null);

      await useCase.execute(event);

      expect(mockMetricRunRepository.update).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_RUN_HEARTBEAT,
        msg: "Run not found",
        data: { runId: "run-not-found" },
        err: expect.any(Error),
      });
    });
  });
});
