-- Migration: 002_insert_bcra_infomondia_dataset.sql
-- Description: Insert bcra_infomondia_series dataset
-- Created: 2025

-- Insertar el dataset bcra_infomondia_series si no existe
INSERT INTO datasets (id, name, bucket, description)
VALUES ('bcra_infomondia_series', 'BCRA Infomondia Series', 'ingestor-datasets', '')
ON CONFLICT (id) DO NOTHING;

