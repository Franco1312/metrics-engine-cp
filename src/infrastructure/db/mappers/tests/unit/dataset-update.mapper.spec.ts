import { DatasetUpdateMapper } from "../../dataset-update.mapper";
import { DatasetUpdateRowBuilder } from "../builders/dataset-update-row.builder";
import { DatasetUpdate } from "@/domain/entities/dataset-update.entity";

describe("DatasetUpdateMapper", () => {
  describe("toDomain", () => {
    it("should map a complete dataset update row to domain entity", () => {
      const row = new DatasetUpdateRowBuilder().build();
      const result = DatasetUpdateMapper.toDomain(row);

      expect(result.id).toBe(row.id);
      expect(result.datasetId).toBe(row.dataset_id);
      expect(result.versionManifestPath).toBe(row.version_manifest_path);
      expect(result.projectionsPath).toBe(row.projections_path);
      expect(result.bucket).toBe(row.bucket);
      expect(result.eventKey).toBe(row.event_key);
      expect(result.createdAt).toBe(row.created_at);
    });

    it("should map null bucket to undefined", () => {
      const row = new DatasetUpdateRowBuilder().withNullBucket().build();
      const result = DatasetUpdateMapper.toDomain(row);

      expect(result.bucket).toBeUndefined();
    });

    it("should handle all fields correctly", () => {
      const row = new DatasetUpdateRowBuilder()
        .withId("update-456")
        .withDatasetId("dataset-456")
        .withVersionManifestPath("custom/path/manifest.json")
        .withProjectionsPath("custom/projections/")
        .withBucket("custom-bucket")
        .withEventKey("custom-event-key")
        .withCreatedAt(new Date("2024-02-01T00:00:00Z"))
        .build();

      const result = DatasetUpdateMapper.toDomain(row);

      expect(result.id).toBe("update-456");
      expect(result.datasetId).toBe("dataset-456");
      expect(result.versionManifestPath).toBe("custom/path/manifest.json");
      expect(result.projectionsPath).toBe("custom/projections/");
      expect(result.bucket).toBe("custom-bucket");
      expect(result.eventKey).toBe("custom-event-key");
      expect(result.createdAt).toEqual(new Date("2024-02-01T00:00:00Z"));
    });
  });

  describe("toDomainList", () => {
    it("should map an array of rows to domain entities", () => {
      const rows = [
        new DatasetUpdateRowBuilder().withId("update-1").build(),
        new DatasetUpdateRowBuilder().withId("update-2").build(),
      ];

      const result = DatasetUpdateMapper.toDomainList(rows);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("update-1");
      expect(result[1]?.id).toBe("update-2");
    });
  });

  describe("toRow", () => {
    it("should map domain entity to row format", () => {
      const update: Omit<DatasetUpdate, "id" | "createdAt"> = {
        datasetId: "dataset-123",
        versionManifestPath: "path/manifest.json",
        projectionsPath: "path/projections/",
        bucket: "test-bucket",
        eventKey: "event-key-123",
      };

      const result = DatasetUpdateMapper.toRow(update);

      expect(result.dataset_id).toBe(update.datasetId);
      expect(result.version_manifest_path).toBe(update.versionManifestPath);
      expect(result.projections_path).toBe(update.projectionsPath);
      expect(result.bucket).toBe(update.bucket);
      expect(result.event_key).toBe(update.eventKey);
    });

    it("should map undefined bucket to null", () => {
      const update: Omit<DatasetUpdate, "id" | "createdAt"> = {
        datasetId: "dataset-123",
        versionManifestPath: "path/manifest.json",
        projectionsPath: "path/projections/",
        eventKey: "event-key-123",
      };

      const result = DatasetUpdateMapper.toRow(update);

      expect(result.bucket).toBeNull();
    });
  });
});
