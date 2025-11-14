-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for metrics engine control plane
-- Created: 2024

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLA: metrics
-- Almacena las definiciones de métricas
-- ============================================================================
CREATE TABLE metrics (
  id VARCHAR(255) PRIMARY KEY,
  code VARCHAR(255) NOT NULL UNIQUE,
  expression_type VARCHAR(50) NOT NULL CHECK (expression_type IN ('series_math', 'window_op', 'composite')),
  expression_json JSONB NOT NULL,
  frequency VARCHAR(50),
  unit VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_code ON metrics(code);
CREATE INDEX idx_metrics_created_at ON metrics(created_at);

-- ============================================================================
-- TABLA: series
-- Catálogo centralizado de todas las series disponibles
-- ============================================================================
CREATE TABLE series (
  code VARCHAR(255) PRIMARY KEY,
  name VARCHAR(500),
  description TEXT,
  unit VARCHAR(50),
  frequency VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_series_code ON series(code);

-- ============================================================================
-- TABLA: datasets
-- Catálogo de datasets disponibles
-- ============================================================================
CREATE TABLE datasets (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(500),
  description TEXT,
  bucket VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_datasets_id ON datasets(id);

-- ============================================================================
-- TABLA: dataset_series
-- Relación many-to-many entre datasets y series
-- ============================================================================
CREATE TABLE dataset_series (
  dataset_id VARCHAR(255) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  series_code VARCHAR(255) NOT NULL REFERENCES series(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dataset_id, series_code)
);

CREATE INDEX idx_dataset_series_dataset_id ON dataset_series(dataset_id);
CREATE INDEX idx_dataset_series_series_code ON dataset_series(series_code);

-- ============================================================================
-- TABLA: metric_dependencies
-- Dependencias de métricas (qué series necesita cada métrica)
-- ============================================================================
CREATE TABLE metric_dependencies (
  metric_id VARCHAR(255) NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  series_code VARCHAR(255) NOT NULL REFERENCES series(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric_id, series_code)
);

CREATE INDEX idx_metric_dependencies_metric_id ON metric_dependencies(metric_id);
CREATE INDEX idx_metric_dependencies_series_code ON metric_dependencies(series_code);

-- ============================================================================
-- TABLA: dataset_updates
-- Actualizaciones de datasets (tabla central para sistema reactivo)
-- ============================================================================
CREATE TABLE dataset_updates (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dataset_id VARCHAR(255) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  version_manifest_path VARCHAR(500) NOT NULL,
  projections_path VARCHAR(500) NOT NULL,
  bucket VARCHAR(255),
  event_key VARCHAR(500) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dataset_updates_dataset_id ON dataset_updates(dataset_id);
CREATE INDEX idx_dataset_updates_created_at ON dataset_updates(created_at DESC);
CREATE INDEX idx_dataset_updates_event_key ON dataset_updates(event_key);

-- ============================================================================
-- TABLA: metric_runs
-- Ejecuciones de métricas
-- ============================================================================
CREATE TABLE metric_runs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  metric_id VARCHAR(255) NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  metric_code VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'pending_dependencies',
    'queued',
    'dispatched',
    'running',
    'succeeded',
    'failed',
    'timed_out',
    'canceled'
  )),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  version_ts VARCHAR(255),
  manifest_path VARCHAR(500),
  row_count INTEGER
);

CREATE INDEX idx_metric_runs_metric_id ON metric_runs(metric_id);
CREATE INDEX idx_metric_runs_status ON metric_runs(status);
CREATE INDEX idx_metric_runs_pending_dependencies 
  ON metric_runs(status) 
  WHERE status = 'pending_dependencies';

-- ============================================================================
-- TABLA: metric_run_pending_datasets
-- Dependencias pendientes de cada run
-- ============================================================================
CREATE TABLE metric_run_pending_datasets (
  run_id VARCHAR(255) NOT NULL REFERENCES metric_runs(id) ON DELETE CASCADE,
  dataset_id VARCHAR(255) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  required_days INTEGER NOT NULL DEFAULT 1,
  received_update_id VARCHAR(255) REFERENCES dataset_updates(id) ON DELETE SET NULL,
  received BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, dataset_id)
);

CREATE INDEX idx_metric_run_pending_datasets_run_id 
  ON metric_run_pending_datasets(run_id);
CREATE INDEX idx_metric_run_pending_datasets_dataset_id 
  ON metric_run_pending_datasets(dataset_id);
CREATE INDEX idx_metric_run_pending_datasets_pending 
  ON metric_run_pending_datasets(run_id, received) 
  WHERE received = FALSE;

-- ============================================================================
-- TABLA: run_dataset_updates
-- Trazabilidad de qué actualizaciones de datasets se usaron en cada run
-- ============================================================================
CREATE TABLE run_dataset_updates (
  run_id VARCHAR(255) NOT NULL REFERENCES metric_runs(id) ON DELETE CASCADE,
  dataset_update_id VARCHAR(255) NOT NULL REFERENCES dataset_updates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, dataset_update_id)
);

CREATE INDEX idx_run_dataset_updates_run_id ON run_dataset_updates(run_id);
CREATE INDEX idx_run_dataset_updates_dataset_update_id 
  ON run_dataset_updates(dataset_update_id);

-- ============================================================================
-- TABLA: event_log
-- Registro de eventos procesados para idempotencia
-- ============================================================================
CREATE TABLE event_log (
  event_key VARCHAR(500) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  run_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_log_event_type ON event_log(event_type);
CREATE INDEX idx_event_log_processed_at ON event_log(processed_at);

