/**
 * Setup global para tests e2e
 * Se ejecuta antes de cada test suite
 */

// Configurar variables de entorno para tests
process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "metrics_engine_test";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5433"; // Puerto de Docker Compose
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
process.env.LOG_LEVEL = "error"; // Reducir logs en tests

// Timeout global para tests e2e (más largo que unitarios)
jest.setTimeout(30000);
