import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { PostgresMetricRepository } from "@/infrastructure/db/repositories/postgres-metric.repository";
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

describe("PostgresMetricRepository E2E", () => {
  let config: AppConfig;
  let databaseClient: PostgresDatabaseClient;
  let repository: PostgresMetricRepository;

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
    repository = new PostgresMetricRepository(databaseClient);
  });

  it("should find metric by id", async () => {
    const metricId = "metric-1";
    const metricCode = "test_metric";

    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        metricId,
        metricCode,
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.RATIO,
          left: { seriesCode: "series1" },
          right: { seriesCode: "series2" },
        }),
      ],
    );

    const metric = await repository.findById(metricId);

    expect(metric).not.toBeNull();
    expect(metric?.id).toBe(metricId);
    expect(metric?.code).toBe(metricCode);
    expect(metric?.expressionType).toBe(EXPRESSION_TYPES.SERIES_MATH);
  });

  it("should return null when metric not found by id", async () => {
    const metric = await repository.findById("non-existent-id");
    expect(metric).toBeNull();
  });

  it("should find metric by code", async () => {
    const metricId = "metric-2";
    const metricCode = "test_metric_code";

    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        metricId,
        metricCode,
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.ADD,
          left: { seriesCode: "series1" },
          right: { seriesCode: "series2" },
        }),
      ],
    );

    const metric = await repository.findByCode(metricCode);

    expect(metric).not.toBeNull();
    expect(metric?.id).toBe(metricId);
    expect(metric?.code).toBe(metricCode);
  });

  it("should return null when metric not found by code", async () => {
    const metric = await repository.findByCode("non-existent-code");
    expect(metric).toBeNull();
  });

  it("should find all metrics", async () => {
    await databaseClient.query(
      `INSERT INTO metrics (id, code, expression_type, expression_json)
       VALUES 
       ($1, $2, $3, $4::jsonb),
       ($5, $6, $7, $8::jsonb)`,
      [
        "metric-3",
        "metric_3",
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.SUBTRACT,
          left: { seriesCode: "series1" },
          right: { seriesCode: "series2" },
        }),
        "metric-4",
        "metric_4",
        EXPRESSION_TYPES.SERIES_MATH,
        JSON.stringify({
          op: SERIES_MATH_OPS.MULTIPLY,
          left: { seriesCode: "series1" },
          right: { seriesCode: "series2" },
        }),
      ],
    );

    const metrics = await repository.findAll();

    expect(metrics.length).toBe(2);
    expect(metrics.some((m) => m.code === "metric_3")).toBe(true);
    expect(metrics.some((m) => m.code === "metric_4")).toBe(true);
  });

  it("should work with transaction client", async () => {
    const metricId = "metric-transaction";
    const metricCode = "transaction_metric";

    await databaseClient.transaction(async (client) => {
      await databaseClient.query(
        `INSERT INTO metrics (id, code, expression_type, expression_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          metricId,
          metricCode,
          EXPRESSION_TYPES.SERIES_MATH,
          JSON.stringify({
            op: SERIES_MATH_OPS.RATIO,
            left: { seriesCode: "series1" },
            right: { seriesCode: "series2" },
          }),
        ],
      );

      const metric = await repository.findById(metricId, client);
      expect(metric).not.toBeNull();
      expect(metric?.code).toBe(metricCode);
    });

    // Verificar que persiste después de la transacción
    const metric = await repository.findById(metricId);
    expect(metric).not.toBeNull();
  });
});
