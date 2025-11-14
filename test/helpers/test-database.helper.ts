import { Pool } from "pg";
import { AppConfig } from "@/infrastructure/config/app.config";
import { PostgresDatabaseClient } from "@/infrastructure/db/database.client";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";

/**
 * Crea una base de datos de prueba y ejecuta las migraciones
 * Usa Docker Compose para levantar una instancia de PostgreSQL
 */
export async function setupTestDatabase(config: AppConfig): Promise<void> {
  // Esperar a que la base de datos esté lista
  const maxRetries = 30;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const testPool = new Pool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        connectionTimeoutMillis: 2000,
      });

      // Intentar conectar
      await testPool.query("SELECT 1");
      await testPool.end();

      // Si llegamos aquí, la conexión funciona
      break;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw new Error(
          `Failed to connect to test database after ${maxRetries} retries. ` +
            `Make sure Docker Compose is running: docker-compose -f docker-compose.test.yml up -d`,
        );
      }
      // Esperar 1 segundo antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Conectar a la DB de prueba y ejecutar migraciones
  const testPool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  });

  try {
    // Verificar si las tablas ya existen
    const tableCheck = await testPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'metrics'
      );
    `);

    // Si las tablas ya existen, no ejecutar el schema de nuevo
    if (tableCheck.rows[0]?.exists) {
      return;
    }

    // Leer y ejecutar el schema
    const fs = require("fs/promises");
    const path = require("path");
    const schemaPath = path.join(
      process.cwd(),
      "migrations",
      "001_initial_schema.sql",
    );
    const schema = await fs.readFile(schemaPath, "utf-8");

    // Ejecutar el schema
    await testPool.query(schema);
  } finally {
    await testPool.end();
  }
}

/**
 * Limpia todas las tablas de la base de datos de prueba
 */
export async function cleanupTestDatabase(config: AppConfig): Promise<void> {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  });

  try {
    // Eliminar datos de todas las tablas (respetando foreign keys)
    await pool.query("TRUNCATE TABLE event_log CASCADE");
    await pool.query("TRUNCATE TABLE run_dataset_updates CASCADE");
    await pool.query("TRUNCATE TABLE metric_run_pending_datasets CASCADE");
    await pool.query("TRUNCATE TABLE metric_runs CASCADE");
    await pool.query("TRUNCATE TABLE dataset_updates CASCADE");
    await pool.query("TRUNCATE TABLE dataset_series CASCADE");
    await pool.query("TRUNCATE TABLE datasets CASCADE");
    await pool.query("TRUNCATE TABLE series CASCADE");
    await pool.query("TRUNCATE TABLE metrics CASCADE");
  } finally {
    await pool.end();
  }
}

/**
 * Crea un DatabaseClient para tests
 */
export function createTestDatabaseClient(
  config: AppConfig,
): PostgresDatabaseClient {
  return new PostgresDatabaseClient(config, defaultLogger);
}
