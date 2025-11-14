-- Rollback: 001_rollback.sql
-- Description: Rollback script for initial schema migration
-- WARNING: This will drop all tables and data. Use with caution.

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS event_log CASCADE;
DROP TABLE IF EXISTS run_dataset_updates CASCADE;
DROP TABLE IF EXISTS metric_run_pending_datasets CASCADE;
DROP TABLE IF EXISTS metric_runs CASCADE;
DROP TABLE IF EXISTS dataset_updates CASCADE;
DROP TABLE IF EXISTS metric_dependencies CASCADE;
DROP TABLE IF EXISTS dataset_series CASCADE;
DROP TABLE IF EXISTS datasets CASCADE;
DROP TABLE IF EXISTS series CASCADE;
DROP TABLE IF EXISTS metrics CASCADE;

-- Note: We don't drop the uuid-ossp extension as it might be used by other schemas

