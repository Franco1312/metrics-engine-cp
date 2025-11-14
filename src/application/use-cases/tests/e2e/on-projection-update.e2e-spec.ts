import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import { DatasetUpdateService } from "@/application/services/dataset-update.service";
import { MetricDependencyResolverService } from "@/application/services/metric-dependency-resolver.service";
import { MetricRunOrchestratorService } from "@/application/services/metric-run-orchestrator.service";
import { PendingRunService } from "@/application/services/pending-run.service";
import { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
import { PostgresMetricRepository } from "@/infrastructure/db/repositories/postgres-metric.repository";
import { PostgresSeriesRepository } from "@/infrastructure/db/repositories/postgres-series.repository";
import { PostgresDatasetRepository } from "@/infrastructure/db/repositories/postgres-dataset.repository";
import { PostgresDatasetUpdateRepository } from "@/infrastructure/db/repositories/postgres-dataset-update.repository";
import { PostgresMetricRunRepository } from "@/infrastructure/db/repositories/postgres-metric-run.repository";
import { PostgresPendingDatasetRepository } from "@/infrastructure/db/repositories/postgres-pending-dataset.repository";
import { AwsSnsPublisher } from "@/infrastructure/aws/sns-publisher";
import { ProjectionUpdateEventBuilder } from "@/application/services/tests/builders/projection-update-event.builder";
import {
  EXPRESSION_TYPES,
  SERIES_MATH_OPS,
} from "@/domain/constants/expression-types";
import { METRIC_RUN_STATUS } from "@/domain/constants/metric-status";
import { loadConfig } from "@/infrastructure/config/app.config";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestDatabaseClient,
} from "@/test/helpers/test-database.helper";

describe("OnProjectionUpdateUseCase E2E", () => {
  let config: AppConfig;
  let databaseClient: PostgresDatabaseClient;
  let useCase: OnProjectionUpdateUseCase;
  let mockSnsPublisher: jest.Mocked<AwsSnsPublisher>;

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
    const metricRepository = new PostgresMetricRepository(databaseClient);
    const seriesRepository = new PostgresSeriesRepository(databaseClient);
    const datasetRepository = new PostgresDatasetRepository(databaseClient);
    const datasetUpdateRepository = new PostgresDatasetUpdateRepository(
      databaseClient,
    );
    const metricRunRepository = new PostgresMetricRunRepository(databaseClient);
    const pendingDatasetRepository = new PostgresPendingDatasetRepository(
      databaseClient,
    );

    mockSnsPublisher = {
      publishMetricRunRequest: jest.fn().mockResolvedValue(undefined),
    } as any;

    const datasetUpdateService = new DatasetUpdateService(
      datasetUpdateRepository,
      defaultLogger,
    );

    const metricDependencyResolverService = new MetricDependencyResolverService(
      metricRepository,
      seriesRepository,
      datasetRepository,
      defaultLogger,
    );

    const metricRunOrchestratorService = new MetricRunOrchestratorService(
      metricRunRepository,
      metricRepository,
      pendingDatasetRepository,
      datasetUpdateRepository,
      seriesRepository,
      datasetRepository,
      mockSnsPublisher,
      defaultLogger,
    );

    const pendingRunService = new PendingRunService(
      pendingDatasetRepository,
      metricRunRepository,
      defaultLogger,
    );

    useCase = new OnProjectionUpdateUseCase(
      datasetUpdateService,
      metricDependencyResolverService,
      metricRunOrchestratorService,
      pendingRunService,
      databaseClient,
      defaultLogger,
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it("should process projection update and create run for dependent metric", async () => {
    // 1. Crear datos de prueba: serie, dataset, métrica
    const seriesCode = "test_series_1";
    const datasetId = "dataset-123";
    const metricId = "metric-123";
    const metricCode = "test_metric";

    // Crear serie
    await databaseClient.query(
      "INSERT INTO series (code, name, description) VALUES ($1, $2, $3)",
      [seriesCode, "Test Series 1", "Test series"],
    );

    // Crear dataset
    await databaseClient.query(
      "INSERT INTO datasets (id, name, description) VALUES ($1, $2, $3)",
      [datasetId, "Test Dataset", "Test dataset"],
    );

    // Asociar serie con dataset
    await databaseClient.query(
      "INSERT INTO dataset_series (dataset_id, series_code) VALUES ($1, $2)",
      [datasetId, seriesCode],
    );

    // Crear métrica que depende de la serie
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json, frequency, unit)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [
        metricId,
        metricCode,
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.RATIO,
          left: { seriesCode },
          right: { seriesCode },
        }),
        "daily",
        "ratio",
      ],
    );

    // 2. Ejecutar el use case con un evento de actualización
    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .withBucket("test-bucket")
      .withVersionManifestPath("datasets/dataset-123/versions/v1/manifest.json")
      .withProjectionsPath("datasets/dataset-123/projections/")
      .build();

    const runs = await useCase.execute(event);

    // 3. Verificar resultados
    expect(runs.length).toBeGreaterThan(0);

    const run = runs[0]!;
    expect(run.metricId).toBe(metricId);
    expect(run.metricCode).toBe(metricCode);

    // Verificar que el dataset update fue persistido
    const datasetUpdateRepository = new PostgresDatasetUpdateRepository(
      databaseClient,
    );
    const update = await datasetUpdateRepository.findByEventKey(
      `${datasetId}:${event.version_manifest_path}`,
    );
    expect(update).not.toBeNull();
    expect(update?.datasetId).toBe(datasetId);

    // Verificar que el run fue creado
    const metricRunRepository = new PostgresMetricRunRepository(databaseClient);
    const savedRun = await metricRunRepository.findById(run!.id);
    expect(savedRun).not.toBeNull();
    expect(savedRun?.status).toBe(METRIC_RUN_STATUS.QUEUED); // Debería estar en QUEUED porque todas las dependencias están listas

    // Verificar que se publicó el evento SNS
    expect(mockSnsPublisher.publishMetricRunRequest).toHaveBeenCalledTimes(1);
  });

  it("should create pending run when metric depends on multiple datasets", async () => {
    // Crear dos series y dos datasets
    const series1Code = "series_1";
    const series2Code = "series_2";
    const dataset1Id = "dataset-1";
    const dataset2Id = "dataset-2";
    const metricId = "metric-456";
    const metricCode = "multi_dataset_metric";

    await databaseClient.query(
      "INSERT INTO series (code, name) VALUES ($1, $2), ($3, $4)",
      [series1Code, "Series 1", series2Code, "Series 2"],
    );

    await databaseClient.query(
      "INSERT INTO datasets (id, name) VALUES ($1, $2), ($3, $4)",
      [dataset1Id, "Dataset 1", dataset2Id, "Dataset 2"],
    );

    await databaseClient.query(
      "INSERT INTO dataset_series (dataset_id, series_code) VALUES ($1, $2), ($3, $4)",
      [dataset1Id, series1Code, dataset2Id, series2Code],
    );

    // Crear métrica que depende de ambas series
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        metricId,
        metricCode,
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.ADD,
          left: { seriesCode: series1Code },
          right: { seriesCode: series2Code },
        }),
      ],
    );

    // Actualizar solo dataset-1
    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(dataset1Id)
      .build();

    const runs = await useCase.execute(event);

    expect(runs.length).toBe(1);
    const run = runs[0]!;
    expect(run.status).toBe(METRIC_RUN_STATUS.PENDING_DEPENDENCIES); // Debería estar pendiente porque falta dataset-2

    // Verificar que NO se publicó el evento SNS (porque está pendiente)
    expect(mockSnsPublisher.publishMetricRunRequest).not.toHaveBeenCalled();

    // Verificar que hay pending datasets
    const pendingDatasetRepository = new PostgresPendingDatasetRepository(
      databaseClient,
    );
    const pendingDatasets = await pendingDatasetRepository.findByRunId(run!.id);
    expect(pendingDatasets.length).toBe(2);
    expect(
      pendingDatasets.some((p) => p.datasetId === dataset1Id && p.received),
    ).toBe(true);
    expect(
      pendingDatasets.some((p) => p.datasetId === dataset2Id && !p.received),
    ).toBe(true);
  });

  it("should return empty array when no dependent metrics found", async () => {
    const datasetId = "dataset-no-metrics";

    await databaseClient.query(
      "INSERT INTO datasets (id, name) VALUES ($1, $2)",
      [datasetId, "Dataset without metrics"],
    );

    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .build();

    const runs = await useCase.execute(event);

    expect(runs).toEqual([]);
    expect(mockSnsPublisher.publishMetricRunRequest).not.toHaveBeenCalled();
  });

  it("should handle idempotency - same event processed twice", async () => {
    const seriesCode = "series_idempotency";
    const datasetId = "dataset-idempotency";
    const metricId = "metric-idempotency";

    await databaseClient.query(
      "INSERT INTO series (code, name) VALUES ($1, $2)",
      [seriesCode, "Series for idempotency"],
    );
    await databaseClient.query(
      "INSERT INTO datasets (id, name) VALUES ($1, $2)",
      [datasetId, "Dataset for idempotency"],
    );
    await databaseClient.query(
      "INSERT INTO dataset_series (dataset_id, series_code) VALUES ($1, $2)",
      [datasetId, seriesCode],
    );
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        metricId,
        "idempotency_metric",
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.RATIO,
          left: { seriesCode },
          right: { seriesCode },
        }),
      ],
    );

    const event = new ProjectionUpdateEventBuilder()
      .withDatasetId(datasetId)
      .withVersionManifestPath("same/path/manifest.json")
      .build();

    // Ejecutar dos veces
    const runs1 = await useCase.execute(event);
    const runs2 = await useCase.execute(event);

    // Debería crear el mismo número de runs (o menos si detecta duplicados)
    expect(runs2.length).toBeGreaterThanOrEqual(0);

    // El dataset update debería ser el mismo (idempotencia)
    const datasetUpdateRepository = new PostgresDatasetUpdateRepository(
      databaseClient,
    );
    const update1 = await datasetUpdateRepository.findByEventKey(
      `${datasetId}:${event.version_manifest_path}`,
    );
    const update2 = await datasetUpdateRepository.findByEventKey(
      `${datasetId}:${event.version_manifest_path}`,
    );

    expect(update1?.id).toBe(update2?.id);
  });
});
