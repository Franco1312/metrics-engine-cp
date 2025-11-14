import { PendingRunService } from "../../pending-run.service";
import { PendingDatasetRepository } from "@/domain/ports/pending-dataset.repository";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { Logger } from "@/domain/interfaces/logger.interface";
import { PendingDatasetBuilder } from "../builders/pending-dataset.builder";
import { MetricRunBuilder } from "../builders/metric-run.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";

describe("PendingRunService", () => {
  let service: PendingRunService;
  let mockPendingDatasetRepository: jest.Mocked<PendingDatasetRepository>;
  let mockMetricRunRepository: jest.Mocked<MetricRunRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockPendingDatasetRepository = {
      findByDatasetId: jest.fn(),
      update: jest.fn(),
      countPendingByRunId: jest.fn(),
    } as any;

    mockMetricRunRepository = {
      findById: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new PendingRunService(
      mockPendingDatasetRepository,
      mockMetricRunRepository,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("updatePendingRunsForDataset", () => {
    it("should update pending datasets and return ready runs", async () => {
      const datasetId = "dataset-123";
      const updateId = "update-123";
      // Fecha reciente (hace 3 días) para que pase la validación de ventana de tiempo
      const updateCreatedAt = new Date();
      updateCreatedAt.setDate(updateCreatedAt.getDate() - 3);

      const pending1 = new PendingDatasetBuilder()
        .withRunId("run-1")
        .withDatasetId(datasetId)
        .withRequiredDays(7) // Acepta actualizaciones de los últimos 7 días
        .build();

      const pending2 = new PendingDatasetBuilder()
        .withRunId("run-2")
        .withDatasetId(datasetId)
        .withRequiredDays(7)
        .build();

      const run1 = new MetricRunBuilder().withId("run-1").build();
      const run2 = new MetricRunBuilder().withId("run-2").build();

      mockPendingDatasetRepository.findByDatasetId.mockResolvedValue([
        pending1,
        pending2,
      ]);

      mockPendingDatasetRepository.update.mockResolvedValue({
        ...pending1,
        received: true,
        receivedUpdateId: updateId,
        receivedAt: updateCreatedAt,
      } as any);

      // run-1 tiene todas las dependencias listas después de la actualización
      // run-2 todavía tiene dependencias pendientes
      mockPendingDatasetRepository.countPendingByRunId
        .mockResolvedValueOnce(0) // run-1 después de actualizar
        .mockResolvedValueOnce(1); // run-2 después de actualizar

      mockMetricRunRepository.findById
        .mockResolvedValueOnce(run1)
        .mockResolvedValueOnce(run2);

      const result = await service.updatePendingRunsForDataset(
        datasetId,
        updateId,
        updateCreatedAt,
      );

      expect(mockPendingDatasetRepository.findByDatasetId).toHaveBeenCalledWith(
        datasetId,
        undefined,
      );
      expect(mockPendingDatasetRepository.update).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("run-1");
    });

    it("should skip updates that are too old", async () => {
      const datasetId = "dataset-123";
      const updateId = "update-123";
      const updateCreatedAt = new Date("2024-01-01T00:00:00Z"); // Hace 14 días

      const pending = new PendingDatasetBuilder()
        .withRunId("run-1")
        .withDatasetId(datasetId)
        .withRequiredDays(7) // Solo acepta actualizaciones de los últimos 7 días
        .build();

      mockPendingDatasetRepository.findByDatasetId.mockResolvedValue([pending]);

      const result = await service.updatePendingRunsForDataset(
        datasetId,
        updateId,
        updateCreatedAt,
      );

      expect(mockPendingDatasetRepository.update).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_DEPENDENCY_PENDING,
        msg: "Update is too old for pending run, skipping",
        data: {
          runId: pending.runId,
          datasetId,
          updateId,
          requiredDays: pending.requiredDays,
        },
      });
    });

    it("should handle empty pending datasets", async () => {
      const datasetId = "dataset-123";
      const updateId = "update-123";
      const updateCreatedAt = new Date();

      mockPendingDatasetRepository.findByDatasetId.mockResolvedValue([]);

      const result = await service.updatePendingRunsForDataset(
        datasetId,
        updateId,
        updateCreatedAt,
      );

      expect(result).toHaveLength(0);
      expect(mockPendingDatasetRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("isRunReady", () => {
    it("should return true when no pending datasets", async () => {
      const runId = "run-123";

      mockPendingDatasetRepository.countPendingByRunId.mockResolvedValue(0);

      const result = await service.isRunReady(runId);

      expect(result).toBe(true);
      expect(
        mockPendingDatasetRepository.countPendingByRunId,
      ).toHaveBeenCalledWith(runId, undefined);
    });

    it("should return false when there are pending datasets", async () => {
      const runId = "run-123";

      mockPendingDatasetRepository.countPendingByRunId.mockResolvedValue(2);

      const result = await service.isRunReady(runId);

      expect(result).toBe(false);
    });
  });
});
