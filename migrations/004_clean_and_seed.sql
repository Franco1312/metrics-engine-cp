-- Migration: 004_clean_and_seed.sql
-- Description: Clean all data and re-seed with initial data
-- WARNING: This will delete all data from the database
-- Created: 2025

-- Limpiar datos en orden inverso de dependencias (para respetar foreign keys)
-- Primero las tablas que tienen foreign keys, luego las que no

-- Tablas con dependencias (eliminar primero)
DELETE FROM run_dataset_updates;
DELETE FROM metric_run_pending_datasets;
DELETE FROM metric_runs;
DELETE FROM dataset_updates;
DELETE FROM metric_dependencies;
DELETE FROM dataset_series;

-- Tablas base (eliminar después)
DELETE FROM metrics;
DELETE FROM series;
DELETE FROM datasets;
DELETE FROM event_log;

-- Re-ejecutar migraciones de seed
-- 1. Insertar dataset bcra_infomondia_series
INSERT INTO datasets (id, name, bucket, description)
VALUES ('bcra_infomondia_series', 'BCRA Infomondia Series', 'ingestor-datasets', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar series BCRA
INSERT INTO series (code, name, description, unit, frequency)
VALUES
  ('BCRA_RESERVAS_USD_M_D', 'BCRA Reservas USD', 'Reservas internacionales del BCRA en millones de USD', 'USD_millions', 'daily'),
  ('BCRA_TC_OFICIAL_A3500_PESOSxUSD_D', 'Tipo de Cambio Oficial', 'Tipo de cambio oficial pesos por USD', 'ARS_per_USD', 'daily'),
  ('BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D', 'Base Monetaria Total', 'Base monetaria total en millones de ARS', 'ARS_billions', 'daily'),
  ('BCRA_LELIQ_NOTALIQ_ARS_BN_D', 'LELIQ No Taliquidables', 'LELIQ no taliquidables en millones de ARS', 'ARS_billions', 'daily'),
  ('BCRA_PASES_PASIVOS_ARS_BN_D', 'Pases Pasivos', 'Pases pasivos en millones de ARS', 'ARS_billions', 'daily')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  frequency = EXCLUDED.frequency,
  updated_at = NOW();

-- 3. Insertar métricas
INSERT INTO metrics (id, code, expression_type, expression_json, frequency, unit, description)
VALUES
  (
    'metric-reserves-to-base',
    'ratio.reserves_to_base',
    'series_math',
    '{
      "op": "ratio",
      "left": {
        "op": "multiply",
        "left": { "series_code": "BCRA_RESERVAS_USD_M_D" },
        "right": { "series_code": "BCRA_TC_OFICIAL_A3500_PESOSxUSD_D" },
        "scale": 1
      },
      "right": { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
      "scale": 1
    }'::jsonb,
    'daily',
    'ratio',
    'Ratio de reservas a base monetaria'
  ),
  (
    'metric-base-ampliada',
    'mon.base_ampliada_ars',
    'composite',
    '{
      "op": "sum",
      "operands": [
        { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
        { "series_code": "BCRA_LELIQ_NOTALIQ_ARS_BN_D" },
        { "series_code": "BCRA_PASES_PASIVOS_ARS_BN_D" }
      ]
    }'::jsonb,
    'daily',
    'ARS_billions',
    'Base monetaria ampliada'
  ),
  (
    'metric-pasivos-rem',
    'mon.pasivos_rem_ars',
    'composite',
    '{
      "op": "sum",
      "operands": [
        { "series_code": "BCRA_LELIQ_NOTALIQ_ARS_BN_D" },
        { "series_code": "BCRA_PASES_PASIVOS_ARS_BN_D" }
      ]
    }'::jsonb,
    'daily',
    'ARS_billions',
    'Pasivos remunerados'
  ),
  (
    'metric-respaldo-real',
    'mon.respaldo_real',
    'series_math',
    '{
      "op": "ratio",
      "left": {
        "op": "multiply",
        "left": { "series_code": "BCRA_RESERVAS_USD_M_D" },
        "right": { "series_code": "BCRA_TC_OFICIAL_A3500_PESOSxUSD_D" },
        "scale": 1
      },
      "right": {
        "op": "sum",
        "operands": [
          { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
          { "series_code": "BCRA_LELIQ_NOTALIQ_ARS_BN_D" },
          { "series_code": "BCRA_PASES_PASIVOS_ARS_BN_D" }
        ]
      },
      "scale": 1
    }'::jsonb,
    'daily',
    'ratio',
    'Respaldo real'
  ),
  (
    'metric-delta-base-30d',
    'delta.base_30d',
    'series_math',
    '{
      "op": "ratio",
      "left": {
        "op": "subtract",
        "left": { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
        "right": {
          "op": "lag",
          "series": { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
          "window": 30
        }
      },
      "right": {
        "op": "lag",
        "series": { "series_code": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
        "window": 30
      },
      "scale": 1
    }'::jsonb,
    'daily',
    'pct',
    'Delta de base monetaria a 30 días'
  ),
  (
    'metric-delta-reserves-7d',
    'delta.reserves_7d',
    'series_math',
    '{
      "op": "ratio",
      "left": {
        "op": "subtract",
        "left": { "series_code": "BCRA_RESERVAS_USD_M_D" },
        "right": {
          "op": "lag",
          "series": { "series_code": "BCRA_RESERVAS_USD_M_D" },
          "window": 7
        }
      },
      "right": {
        "op": "lag",
        "series": { "series_code": "BCRA_RESERVAS_USD_M_D" },
        "window": 7
      },
      "scale": 1
    }'::jsonb,
    'daily',
    'pct',
    'Delta de reservas a 7 días'
  )
ON CONFLICT (id) DO UPDATE
SET
  code = EXCLUDED.code,
  expression_type = EXCLUDED.expression_type,
  expression_json = EXCLUDED.expression_json,
  frequency = EXCLUDED.frequency,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. Insertar dependencias de métricas
INSERT INTO metric_dependencies (metric_id, series_code)
VALUES
  ('metric-reserves-to-base', 'BCRA_RESERVAS_USD_M_D'),
  ('metric-reserves-to-base', 'BCRA_TC_OFICIAL_A3500_PESOSxUSD_D'),
  ('metric-reserves-to-base', 'BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D'),
  ('metric-base-ampliada', 'BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D'),
  ('metric-base-ampliada', 'BCRA_LELIQ_NOTALIQ_ARS_BN_D'),
  ('metric-base-ampliada', 'BCRA_PASES_PASIVOS_ARS_BN_D'),
  ('metric-pasivos-rem', 'BCRA_LELIQ_NOTALIQ_ARS_BN_D'),
  ('metric-pasivos-rem', 'BCRA_PASES_PASIVOS_ARS_BN_D'),
  ('metric-respaldo-real', 'BCRA_RESERVAS_USD_M_D'),
  ('metric-respaldo-real', 'BCRA_TC_OFICIAL_A3500_PESOSxUSD_D'),
  ('metric-respaldo-real', 'BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D'),
  ('metric-respaldo-real', 'BCRA_LELIQ_NOTALIQ_ARS_BN_D'),
  ('metric-respaldo-real', 'BCRA_PASES_PASIVOS_ARS_BN_D'),
  ('metric-delta-base-30d', 'BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D'),
  ('metric-delta-reserves-7d', 'BCRA_RESERVAS_USD_M_D')
ON CONFLICT (metric_id, series_code) DO NOTHING;

-- 5. Insertar relaciones dataset_series
INSERT INTO dataset_series (dataset_id, series_code)
VALUES
  ('bcra_infomondia_series', 'BCRA_RESERVAS_USD_M_D'),
  ('bcra_infomondia_series', 'BCRA_TC_OFICIAL_A3500_PESOSxUSD_D'),
  ('bcra_infomondia_series', 'BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D'),
  ('bcra_infomondia_series', 'BCRA_LELIQ_NOTALIQ_ARS_BN_D'),
  ('bcra_infomondia_series', 'BCRA_PASES_PASIVOS_ARS_BN_D')
ON CONFLICT (dataset_id, series_code) DO NOTHING;

