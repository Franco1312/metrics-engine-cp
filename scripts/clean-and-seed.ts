#!/usr/bin/env node
/**
 * Script para limpiar y re-seedear la base de datos
 * Limpia todos los datos y vuelve a insertar los datos iniciales
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

async function cleanAndSeed(): Promise<void> {
  const config = getDatabaseConfig();
  const pool = new Pool(config);

  try {
    console.log("📦 Conectando a la base de datos...");
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}`);

    // Verificar conexión
    await pool.query("SELECT 1");

    const migrationPath = join(
      process.cwd(),
      "migrations",
      "004_clean_and_seed.sql",
    );
    console.log(`\n📄 Leyendo archivo: ${migrationPath}`);

    const sql = readFileSync(migrationPath, "utf-8");

    console.log("\n🚀 Ejecutando clean & seed...");
    await pool.query(sql);

    console.log("\n✅ Clean & seed ejecutado exitosamente!");
  } catch (error) {
    console.error("\n❌ Error al ejecutar clean & seed:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar
cleanAndSeed().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
