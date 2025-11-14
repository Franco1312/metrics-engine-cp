import { OnProjectionUpdateUseCase } from "../../on-projection-update.use-case";
import { DatasetUpdateService } from "@/application/services/dataset-update.service";
import { MetricDependencyResolverService } from "@/application/services/metric-dependency-resolver.service";
import { MetricRunOrchestratorService } from "@/application/services/metric-run-orchestrator.service";
import { PendingRunService } from "@/application/services/pending-run.service";
import {
  DatabaseClient,
  TransactionClient,
} from "@/domain/interfaces/database-client.interface";
import { EventLogRepository } from "@/domain/ports/event-log.repository";
import { Logger } from "@/domain/interfaces/logger.interface";
import { ProjectionUpdateEventBuilder } from "@/application/services/tests/builders/projection-update-event.builder";
import { DatasetUpdateBuilder } from "@/domain/services/tests/builders/dataset-update.builder";
import { MetricBuilder } from "@/domain/services/tests/builders/metric.builder";
import { MetricRunBuilder } from "@/application/services/tests/builders/metric-run.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";

describe("OnProjectionUpdateUseCase", () => {
  let useCase: OnProjectionUpdateUseCase;
  let mockDatasetUpdateService: jest.Mocked<DatasetUpdateService>;
  let mockMetricDependencyResolverService: jest.Mocked<MetricDependencyResolverService>;
  let mockMetricRunOrchestratorService: jest.Mocked<MetricRunOrchestratorService>;
  let mockPendingRunService: jest.Mocked<PendingRunService>;
  let mockEventLogRepository: jest.Mocked<EventLogRepository>;
  let mockDatabaseClient: jest.Mocked<DatabaseClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockTransactionClient: jest.Mocked<TransactionClient>;

  beforeEach(() => {
    mockTransactionClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    mockDatasetUpdateService = {
      persistUpdate: jest.fn(),
    } as any;

    mockMetricDependencyResolverService = {
      findMetricsForDataset: jest.fn(),
      resolveRequiredDatasets: jest.fn(),
    } as any;

    mockMetricRunOrchestratorService = {
      createRunForMetric: jest.fn(),
      emitPendingRun: jest.fn(),
    } as any;

    mockPendingRunService = {
      updatePendingRunsForDataset: jest.fn(),
    } as any;

    mockEventLogRepository = {
      create: jest.fn(),
      findByEventKey: jest.fn(),
      markAsProcessed: jest.fn(),
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

    useCase = new OnProjectionUpdateUseCase(
      mockDatasetUpdateService,
      mockMetricDependencyResolverService,
      mockMetricRunOrchestratorService,
      mockPendingRunService,
      mockEventLogRepository,
      mockDatabaseClient,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should process projection update and create runs for dependent metrics", async () => {
      const event = new ProjectionUpdateEventBuilder()
        .withDatasetId("dataset-123")
        .build();

      const datasetUpdate = new DatasetUpdateBuilder()
        .withDatasetId("dataset-123")
        .withCreatedAt(new Date())
        .build();

      const metric1 = new MetricBuilder()
        .withId("metric-1")
        .withCode("metric_1")
        .build();

      const metric2 = new MetricBuilder()
        .withId("metric-2")
        .withCode("metric_2")
        .build();

      const run1 = new MetricRunBuilder()
        .withId("run-1")
        .withMetricId("metric-1")
        .withStatus(METRIC_RUN_STATUS.PENDING_DEPENDENCIES)
        .build();

      const run2 = new MetricRunBuilder()
        .withId("run-2")
        .withMetricId("metric-2")
        .withStatus(METRIC_RUN_STATUS.QUEUED)
        .build();

      mockEventLogRepository.findByEventKey.mockResolvedValue(null);
      mockEventLogRepository.create.mockResolvedValue({
        eventKey: "dataset-123:path/to/manifest.json",
        eventType: "projection_update",
        eventPayload: {},
        createdAt: new Date(),
      });
      mockEventLogRepository.markAsProcessed.mockResolvedValue();

      mockDatasetUpdateService.persistUpdate.mockResolvedValue(datasetUpdate);
      mockMetricDependencyResolverService.findMetricsForDataset.mockResolvedValue(
        [metric1, metric2],
      );
      mockMetricDependencyResolverService.resolveRequiredDatasets
        .mockResolvedValueOnce(["dataset-123", "dataset-456"])
        .mockResolvedValueOnce(["dataset-123"]);

      mockMetricRunOrchestratorService.createRunForMetric
        .mockResolvedValueOnce(run1)
        .mockResolvedValueOnce(run2);

      mockPendingRunService.updatePendingRunsForDataset.mockResolvedValue([]);

      const result = await useCase.execute(event);

      expect(mockDatasetUpdateService.persistUpdate).toHaveBeenCalledWith(
        event,
        mockTransactionClient,
      );
      expect(
        mockMetricDependencyResolverService.findMetricsForDataset,
      ).toHaveBeenCalledWith("dataset-123", mockTransactionClient);
      expect(
        mockMetricDependencyResolverService.resolveRequiredDatasets,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockMetricRunOrchestratorService.createRunForMetric,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockPendingRunService.updatePendingRunsForDataset,
      ).toHaveBeenCalledWith(
        "dataset-123",
        datasetUpdate.id,
        datasetUpdate.createdAt,
        mockTransactionClient,
      );
      expect(result).toEqual([run1, run2]);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE_STARTED,
        msg: "Processing projection update event",
        data: expect.objectContaining({
          datasetId: "dataset-123",
          bucket: event.bucket,
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE_COMPLETED,
        msg: "Projection update processed successfully",
        data: {
          datasetId: "dataset-123",
          updateId: datasetUpdate.id,
          dependentMetricsCount: 2,
          createdRunsCount: 2,
          readyRunsCount: 0,
        },
      });
    });

    it("should return empty array when no dependent metrics found", async () => {
      const event = new ProjectionUpdateEventBuilder().build();
      const datasetUpdate = new DatasetUpdateBuilder().build();

      mockEventLogRepository.findByEventKey.mockResolvedValue(null);
      mockEventLogRepository.create.mockResolvedValue({
        eventKey: "dataset-123:path/to/manifest.json",
        eventType: "projection_update",
        eventPayload: {},
        createdAt: new Date(),
      });
      mockEventLogRepository.markAsProcessed.mockResolvedValue();

      mockDatasetUpdateService.persistUpdate.mockResolvedValue(datasetUpdate);
      mockMetricDependencyResolverService.findMetricsForDataset.mockResolvedValue(
        [],
      );

      const result = await useCase.execute(event);

      expect(result).toEqual([]);
      expect(
        mockMetricRunOrchestratorService.createRunForMetric,
      ).not.toHaveBeenCalled();

      // Verificar que se llamó ON_PROJECTION_UPDATE_STARTED
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.ON_PROJECTION_UPDATE_STARTED,
          msg: "Processing projection update event",
          data: expect.objectContaining({
            datasetId: event.dataset_id,
          }),
        }),
      );

      // Verificar que se llamó ON_PROJECTION_UPDATE_COMPLETED
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.ON_PROJECTION_UPDATE_COMPLETED,
          msg: "Projection update processed successfully",
          data: expect.objectContaining({
            datasetId: event.dataset_id,
            updateId: datasetUpdate.id,
          }),
        }),
      );
    });

    it("should emit ready runs that are still pending", async () => {
      const event = new ProjectionUpdateEventBuilder()
        .withDatasetId("dataset-123")
        .build();

      const datasetUpdate = new DatasetUpdateBuilder()
        .withDatasetId("dataset-123")
        .withCreatedAt(new Date())
        .build();

      const metric = new MetricBuilder().withId("metric-1").build();
      const run = new MetricRunBuilder()
        .withId("run-1")
        .withStatus(METRIC_RUN_STATUS.PENDING_DEPENDENCIES)
        .build();

      const readyRun = new MetricRunBuilder()
        .withId("run-2")
        .withStatus(METRIC_RUN_STATUS.PENDING_DEPENDENCIES)
        .build();

      mockEventLogRepository.findByEventKey.mockResolvedValue(null);
      mockEventLogRepository.create.mockResolvedValue({
        eventKey: "dataset-123:path/to/manifest.json",
        eventType: "projection_update",
        eventPayload: {},
        createdAt: new Date(),
      });
      mockEventLogRepository.markAsProcessed.mockResolvedValue();

      mockDatasetUpdateService.persistUpdate.mockResolvedValue(datasetUpdate);
      mockMetricDependencyResolverService.findMetricsForDataset.mockResolvedValue(
        [metric],
      );
      mockMetricDependencyResolverService.resolveRequiredDatasets.mockResolvedValue(
        ["dataset-123"],
      );
      mockMetricRunOrchestratorService.createRunForMetric.mockResolvedValue(
        run,
      );
      mockPendingRunService.updatePendingRunsForDataset.mockResolvedValue([
        readyRun,
      ]);

      await useCase.execute(event);

      expect(
        mockMetricRunOrchestratorService.emitPendingRun,
      ).toHaveBeenCalledWith("run-2", mockTransactionClient);
    });
  });
});
