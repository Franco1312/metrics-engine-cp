import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { PostgresMetricRepository } from "@/infrastructure/db/repositories/postgres-metric.repository";
import { PostgresSeriesRepository } from "@/infrastructure/db/repositories/postgres-series.repository";
import { PostgresDatasetRepository } from "@/infrastructure/db/repositories/postgres-dataset.repository";
import { MetricDependencyResolverService } from "@/application/services/metric-dependency-resolver.service";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";
import {
  EXPRESSION_TYPES,
  SERIES_MATH_OPS,
} from "@/domain/constants/expression-types";
import { loadConfig } from "@/infrastructure/config/app.config";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestDatabaseClient,
} from "@/test/helpers/test-database.helper";

describe("MetricDependencyResolverService E2E", () => {
  let config: AppConfig;
  let databaseClient: PostgresDatabaseClient;
  let service: MetricDependencyResolverService;

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
    service = new MetricDependencyResolverService(
      metricRepository,
      seriesRepository,
      datasetRepository,
      defaultLogger,
    );
  });

  it("should find metrics that depend on a dataset", async () => {
    const seriesCode = "series_1";
    const datasetId = "dataset-1";
    const metricId = "metric-1";

    // Setup: crear serie, dataset, asociación y métrica
    await databaseClient.query(
      "INSERT INTO series (code, name) VALUES ($1, $2)",
      [seriesCode, "Series 1"],
    );
    await databaseClient.query(
      "INSERT INTO datasets (id, name) VALUES ($1, $2)",
      [datasetId, "Dataset 1"],
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
        "test_metric",
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.RATIO,
          left: { seriesCode },
          right: { seriesCode },
        }),
      ],
    );

    const metrics = await service.findMetricsForDataset(datasetId);

    expect(metrics.length).toBe(1);
    expect(metrics[0].id).toBe(metricId);
  });

  it("should return empty array when no metrics depend on dataset", async () => {
    const datasetId = "dataset-no-metrics";
    await databaseClient.query(
      "INSERT INTO datasets (id, name) VALUES ($1, $2)",
      [datasetId, "Dataset without metrics"],
    );

    const metrics = await service.findMetricsForDataset(datasetId);
    expect(metrics).toEqual([]);
  });

  it("should resolve required datasets for a metric", async () => {
    const series1Code = "series_1";
    const series2Code = "series_2";
    const dataset1Id = "dataset-1";
    const dataset2Id = "dataset-2";
    const metricId = "metric-multi";

    // Setup
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
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        metricId,
        "multi_metric",
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.ADD,
          left: { seriesCode: series1Code },
          right: { seriesCode: series2Code },
        }),
      ],
    );

    const datasetIds = await service.resolveRequiredDatasets(metricId);

    expect(datasetIds.length).toBe(2);
    expect(datasetIds).toContain(dataset1Id);
    expect(datasetIds).toContain(dataset2Id);
  });

  it("should work with transaction client", async () => {
    const seriesCode = "series_transaction";
    const datasetId = "dataset-transaction";
    const metricId = "metric-transaction";

    await databaseClient.transaction(async (client) => {
      await databaseClient.query(
        "INSERT INTO series (code, name) VALUES ($1, $2)",
        [seriesCode, "Series"],
      );
      await databaseClient.query(
        "INSERT INTO datasets (id, name) VALUES ($1, $2)",
        [datasetId, "Dataset"],
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
          "test_metric",
          EXPRESSION_TYPES.SERIES_MATH,
          JSON.stringify({
            op: SERIES_MATH_OPS.RATIO,
            left: { seriesCode },
            right: { seriesCode },
          }),
        ],
      );

      const metrics = await service.findMetricsForDataset(datasetId, client);
      expect(metrics.length).toBe(1);
    });
  });
});
