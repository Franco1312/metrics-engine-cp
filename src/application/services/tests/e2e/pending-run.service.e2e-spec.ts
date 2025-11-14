import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { PostgresPendingDatasetRepository } from "@/infrastructure/db/repositories/postgres-pending-dataset.repository";
import { PostgresMetricRunRepository } from "@/infrastructure/db/repositories/postgres-metric-run.repository";
import { PendingRunService } from "@/application/services/pending-run.service";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";
import { loadConfig } from "@/infrastructure/config/app.config";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestDatabaseClient,
} from "@/test/helpers/test-database.helper";

describe("PendingRunService E2E", () => {
  let config: AppConfig;
  let databaseClient: PostgresDatabaseClient;
  let service: PendingRunService;

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
    const pendingDatasetRepository = new PostgresPendingDatasetRepository(
      databaseClient,
    );
    const metricRunRepository = new PostgresMetricRunRepository(databaseClient);
    service = new PendingRunService(
      pendingDatasetRepository,
      metricRunRepository,
      defaultLogger,
    );
  });

  it("should update pending runs and mark ready runs", async () => {
    const runId = "run-1";
    const metricId = "metric-1";
    const dataset1Id = "dataset-1";
    const dataset2Id = "dataset-2";
    const updateId = "update-1";

    // Crear una métrica primero (requerida por foreign key)
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, 'test_metric', 'series_math', '{"op": "ratio", "left": {"seriesCode": "s1"}, "right": {"seriesCode": "s2"}}'::jsonb)`,
      [metricId],
    );

    // Crear datasets primero (requeridos por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Dataset 1'), ($2, 'Dataset 2')`,
      [dataset1Id, dataset2Id],
    );

    // Crear dataset update primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO dataset_updates (id, dataset_id, bucket, version_manifest_path, projections_path, event_key)
       VALUES ($1, $2, 'test-bucket', 'manifest.json', 'projections/', $3)`,
      [updateId, dataset1Id, `${dataset1Id}:manifest.json`],
    );

    // Crear un run pendiente
    await databaseClient.query(
      `INSERT INTO metric_runs (id, metric_id, metric_code, status)
       VALUES ($1, $2, 'test_metric', $3)`,
      [runId, metricId, METRIC_RUN_STATUS.PENDING_DEPENDENCIES],
    );

    // Crear pending datasets
    await databaseClient.query(
      `INSERT INTO metric_run_pending_datasets 
       (run_id, dataset_id, required_days, received, received_update_id)
       VALUES 
       ($1, $2, 7, true, $3),
       ($4, $5, 7, false, NULL)`,
      [runId, dataset1Id, updateId, runId, dataset2Id],
    );

    const updateDate = new Date();

    const readyRuns = await service.updatePendingRunsForDataset(
      dataset1Id,
      updateId,
      updateDate,
    );

    // El run debería seguir pendiente porque falta dataset-2
    expect(readyRuns.length).toBe(0);

    // Verificar que el pending dataset fue actualizado
    const pendingDatasets = await databaseClient.query(
      `SELECT * FROM metric_run_pending_datasets WHERE run_id = $1`,
      [runId],
    );
    const updatedPending = pendingDatasets.rows.find(
      (p) => p.dataset_id === dataset1Id,
    );
    expect(updatedPending).toBeDefined();
    expect(updatedPending!.received).toBe(true);
    expect(updatedPending!.received_update_id).toBe(updateId);
  });

  it("should mark run as ready when all dependencies are received", async () => {
    const runId = "run-2";
    const metricId = "metric-2";
    const dataset1Id = "dataset-1";
    const dataset2Id = "dataset-2";
    const update1Id = "update-1";
    const update2Id = "update-2";

    // Crear una métrica primero (requerida por foreign key)
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, 'test_metric', 'series_math', '{"op": "ratio", "left": {"seriesCode": "s1"}, "right": {"seriesCode": "s2"}}'::jsonb)`,
      [metricId],
    );

    // Crear datasets primero (requeridos por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Dataset 1'), ($2, 'Dataset 2')`,
      [dataset1Id, dataset2Id],
    );

    // Crear dataset updates primero (requeridos por foreign key)
    await databaseClient.query(
      `INSERT INTO dataset_updates (id, dataset_id, bucket, version_manifest_path, projections_path, event_key)
       VALUES 
       ($1, $2, 'test-bucket', 'manifest1.json', 'projections/', $3),
       ($4, $5, 'test-bucket', 'manifest2.json', 'projections/', $6)`,
      [
        update1Id,
        dataset1Id,
        `${dataset1Id}:manifest1.json`,
        update2Id,
        dataset2Id,
        `${dataset2Id}:manifest2.json`,
      ],
    );

    // Crear un run pendiente
    await databaseClient.query(
      `INSERT INTO metric_runs (id, metric_id, metric_code, status)
       VALUES ($1, $2, 'test_metric', $3)`,
      [runId, metricId, METRIC_RUN_STATUS.PENDING_DEPENDENCIES],
    );

    // Crear pending datasets - solo dataset1 recibido, dataset2 pendiente
    await databaseClient.query(
      `INSERT INTO metric_run_pending_datasets 
       (run_id, dataset_id, required_days, received, received_update_id)
       VALUES 
       ($1, $2, 7, true, $3),
       ($1, $4, 7, false, NULL)`,
      [runId, dataset1Id, update1Id, dataset2Id],
    );

    // Primero actualizar con dataset-1 (ya recibido, no debería cambiar nada)
    const readyRuns1 = await service.updatePendingRunsForDataset(
      dataset1Id,
      update1Id,
      new Date(),
    );
    expect(readyRuns1.length).toBe(0); // No está listo porque falta dataset-2

    // Ahora actualizar con dataset-2 (esto debería marcar el run como listo)
    const readyRuns = await service.updatePendingRunsForDataset(
      dataset2Id,
      update2Id,
      new Date(),
    );

    // El run debería estar listo porque todas las dependencias están recibidas
    expect(readyRuns.length).toBe(1);
    const readyRun = readyRuns[0]!;
    expect(readyRun.id).toBe(runId);
    expect(readyRun.status).toBe(METRIC_RUN_STATUS.PENDING_DEPENDENCIES); // Sigue pendiente hasta que se emita
  });

  it("should work with transaction client", async () => {
    const runId = "run-transaction";
    const metricId = "metric-transaction";
    const datasetId = "dataset-transaction";
    const updateId = "update-transaction";

    // Crear una métrica primero (requerida por foreign key)
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, 'test_metric', 'series_math', '{"op": "ratio", "left": {"seriesCode": "s1"}, "right": {"seriesCode": "s2"}}'::jsonb)`,
      [metricId],
    );

    // Crear dataset primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO datasets (id, name) VALUES ($1, 'Dataset Transaction')`,
      [datasetId],
    );

    // Crear dataset update primero (requerido por foreign key)
    await databaseClient.query(
      `INSERT INTO dataset_updates (id, dataset_id, bucket, version_manifest_path, projections_path, event_key)
       VALUES ($1, $2, 'test-bucket', 'manifest.json', 'projections/', $3)`,
      [updateId, datasetId, `${datasetId}:manifest.json`],
    );

    await databaseClient.transaction(async (client) => {
      await client.query(
        `INSERT INTO metric_runs (id, metric_id, metric_code, status)
         VALUES ($1, $2, 'test_metric', $3)`,
        [runId, metricId, METRIC_RUN_STATUS.PENDING_DEPENDENCIES],
      );

      await client.query(
        `INSERT INTO metric_run_pending_datasets 
         (run_id, dataset_id, required_days, received)
         VALUES ($1, $2, 7, false)`,
        [runId, datasetId],
      );

      // El run no debería estar listo porque acabamos de crear el pending dataset
      // y aún no se ha recibido el update
      const readyRuns = await service.updatePendingRunsForDataset(
        datasetId,
        updateId,
        new Date(),
        client,
      );

      // Después de recibir el update, el run debería estar listo (solo tiene una dependencia)
      expect(readyRuns.length).toBe(1);
    });
  });
});
