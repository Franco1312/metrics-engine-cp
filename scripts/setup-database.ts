#!/usr/bin/env node
/**
 * Script para configurar la base de datos desde cero
 * Ejecuta el schema inicial y luego el clean & seed
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// Cargar variables de entorno
config();

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "metrics_engine_cp",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  };
}

async function setupDatabase(): Promise<void> {
  const config = getDatabaseConfig();
  const isRDS =
    config.host.includes(".rds.amazonaws.com") || config.host.includes(".rds.");

  const poolConfig: DatabaseConfig & { ssl?: { rejectUnauthorized: boolean } } =
    {
      ...config,
    };

  // Enable SSL for RDS connections
  if (isRDS) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  const pool = new Pool(poolConfig);

  try {
    console.log("📦 Conectando a la base de datos...");
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);

    // Verificar conexión
    await pool.query("SELECT 1");
    console.log("✓ Conexión establecida\n");

    // Paso 1: Verificar/crear extensión (si el usuario tiene permisos)
    console.log(`📄 Paso 1: Verificando extensión uuid-ossp...`);
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log("✓ Extensión uuid-ossp verificada\n");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes("permission denied")
      ) {
        console.log(
          "⚠ Extensión uuid-ossp requiere permisos de superusuario, continuando...",
        );
        // Verificar si ya existe
        const extCheck = await pool.query(
          "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp')",
        );
        if (!extCheck.rows[0]?.exists) {
          console.error(
            "❌ La extensión uuid-ossp no existe y no se puede crear. Necesitas ejecutar como superusuario:",
          );
          console.error('   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
          throw new Error("Extensión uuid-ossp requerida pero no disponible");
        }
        console.log("✓ Extensión uuid-ossp ya existe\n");
      } else {
        throw error;
      }
    }

    // Paso 2: Ejecutar schema inicial
    const schemaPath = join(
      process.cwd(),
      "migrations",
      "001_initial_schema.sql",
    );
    console.log(`📄 Paso 2: Ejecutando schema inicial...`);
    console.log(`   Archivo: ${schemaPath}`);

    // Leer schema y remover la línea de CREATE EXTENSION (ya la manejamos arriba)
    let schema = readFileSync(schemaPath, "utf-8");
    schema = schema.replace(
      /CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi,
      "-- Extension already handled",
    );

    await pool.query(schema);
    console.log("✓ Schema inicial ejecutado\n");

    // Paso 3: Ejecutar clean & seed
    const seedPath = join(
      process.cwd(),
      "migrations",
      "004_clean_and_seed.sql",
    );
    console.log(`📄 Paso 3: Ejecutando clean & seed...`);
    console.log(`   Archivo: ${seedPath}`);

    const seed = readFileSync(seedPath, "utf-8");
    await pool.query(seed);
    console.log("✓ Clean & seed ejecutado\n");

    console.log("✅ Base de datos configurada exitosamente!");
  } catch (error) {
    console.error("\n❌ Error al configurar la base de datos:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar
setupDatabase().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
