import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { PostgresDatasetUpdateRepository } from "@/infrastructure/db/repositories/postgres-dataset-update.repository";
import { DatasetUpdateService } from "@/application/services/dataset-update.service";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import { ProjectionUpdateEventBuilder } from "@/application/services/tests/builders/projection-update-event.builder";
import { loadConfig } from "@/infrastructure/config/app.config";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestDatabaseClient,
} from "@/test/helpers/test-database.helper";

describe("DatasetUpdateService E2E", () => {
  let config: AppConfig;
  let databaseClient: PostgresDatabaseClient;
  let service: DatasetUpdateService;

  beforeAll(async () => {
    config = loadConfig();
    config.database.name = process.env.DB_NAME || "metrics_engine_test";
    config.database.host = process.env.DB_HOST || "localhost";
    config.database.port = parseInt(process.env.DB_PORT || "5433", 10);
    config.database.user = process.env.DB_USER || "postgres";
    config.database.password = process.env.DB_PASSWORD || "postgres";
    await setupTestDatabase(config);
  });

  afterAll(async () => {
    await cleanupTestDatabase(config);
    if (databaseClient) {
      await databaseClient.close();
    }
  });

  beforeEach(async () => {
    await cleanupTestDatabase(config);
    databaseClient = createTestDatabaseClient(config);
    const repository = new PostgresDatasetUpdateRepository(databaseClient);
    service = new DatasetUpdateService(repository, defaultLogger);
  });

  it("should persist dataset update", async () => {
    const datasetId = "dataset-1";

    // Crear dataset primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Test Dataset')`,
      [datasetId],
    );

    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .withBucket("test-bucket")
      .withVersionManifestPath("datasets/dataset-1/versions/v1/manifest.json")
      .withProjectionsPath("datasets/dataset-1/projections/")
      .build();

    const update = await service.persistUpdate(event);

    expect(update).not.toBeNull();
    expect(update.datasetId).toBe(datasetId);
    expect(update.bucket).toBe("test-bucket");
    expect(update.versionManifestPath).toBe(
      "datasets/dataset-1/versions/v1/manifest.json",
    );
    expect(update.projectionsPath).toBe("datasets/dataset-1/projections/");
  });

  it("should handle idempotency - same event twice", async () => {
    const datasetId = "dataset-idempotency";

    // Crear dataset primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Idempotency Dataset')`,
      [datasetId],
    );

    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .withVersionManifestPath("same/path/manifest.json")
      .build();

    const update1 = await service.persistUpdate(event);
    const update2 = await service.persistUpdate(event);

    // Debería retornar el mismo update (idempotencia)
    expect(update1.id).toBe(update2.id);
    expect(update1.datasetId).toBe(update2.datasetId);
  });

  it("should work with transaction client", async () => {
    const datasetId = "dataset-transaction";

    // Crear dataset primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Transaction Dataset')`,
      [datasetId],
    );

    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .build();

    let updateId: string;

    await databaseClient.transaction(async (client) => {
      const update = await service.persistUpdate(event, client);
      updateId = update.id;
      expect(update).not.toBeNull();
    });

    // Verificar que persiste después de la transacción
    const repository = new PostgresDatasetUpdateRepository(databaseClient);
    const savedUpdate = await repository.findById(updateId!);
    expect(savedUpdate).not.toBeNull();
    expect(savedUpdate?.datasetId).toBe(datasetId);
  });
});
