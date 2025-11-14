import { DatasetUpdateService } from "../../dataset-update.service";
import { DatasetUpdateRepository } from "@/domain/ports/dataset-update.repository";
import { Logger } from "@/domain/interfaces/logger.interface";
import { ProjectionUpdateEventBuilder } from "../builders/projection-update-event.builder";
import { DatasetUpdateBuilder } from "@/domain/services/tests/builders/dataset-update.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";

describe("DatasetUpdateService", () => {
  let service: DatasetUpdateService;
  let mockRepository: jest.Mocked<DatasetUpdateRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockRepository = {
      findByEventKey: jest.fn(),
      create: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new DatasetUpdateService(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("persistUpdate", () => {
    it("should create new update when it does not exist", async () => {
      const event = new ProjectionUpdateEventBuilder().build();
      const expectedUpdate = new DatasetUpdateBuilder()
        .withDatasetId(event.dataset_id)
        .withCreatedAt(new Date())
        .build();

      mockRepository.findByEventKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedUpdate);

      const result = await service.persistUpdate(event);

      expect(mockRepository.findByEventKey).toHaveBeenCalledWith(
        `${event.dataset_id}:${event.version_manifest_path}`,
        undefined,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          datasetId: event.dataset_id,
          versionManifestPath: event.version_manifest_path,
          projectionsPath: event.projections_path,
          bucket: event.bucket,
          eventKey: `${event.dataset_id}:${event.version_manifest_path}`,
        },
        undefined,
      );
      expect(result).toEqual(expectedUpdate);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE,
        msg: "Dataset update persisted successfully",
        data: {
          datasetId: event.dataset_id,
          updateId: expectedUpdate.id,
          eventKey: `${event.dataset_id}:${event.version_manifest_path}`,
        },
      });
    });

    it("should return existing update when it already exists", async () => {
      const event = new ProjectionUpdateEventBuilder().build();
      const existingUpdate = new DatasetUpdateBuilder()
        .withDatasetId(event.dataset_id)
        .build();

      mockRepository.findByEventKey.mockResolvedValue(existingUpdate);

      const result = await service.persistUpdate(event);

      expect(mockRepository.findByEventKey).toHaveBeenCalledWith(
        `${event.dataset_id}:${event.version_manifest_path}`,
        undefined,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingUpdate);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.ON_PROJECTION_UPDATE,
        msg: "Dataset update already exists, skipping",
        data: {
          datasetId: event.dataset_id,
          eventKey: `${event.dataset_id}:${event.version_manifest_path}`,
          updateId: existingUpdate.id,
        },
      });
    });

    it("should pass transaction client when provided", async () => {
      const event = new ProjectionUpdateEventBuilder().build();
      const mockClient = {} as any;
      const expectedUpdate = new DatasetUpdateBuilder()
        .withDatasetId(event.dataset_id)
        .build();

      mockRepository.findByEventKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedUpdate);

      await service.persistUpdate(event, mockClient);

      expect(mockRepository.findByEventKey).toHaveBeenCalledWith(
        `${event.dataset_id}:${event.version_manifest_path}`,
        mockClient,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockClient,
      );
    });
  });
});
