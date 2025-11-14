# Diseño de Base de Datos - Metrics Engine Control Plane

Este documento describe el diseño completo de la base de datos del sistema de orquestación de métricas, incluyendo todas las tablas, sus campos, relaciones y propósito.

## 📋 Tabla de Contenidos

- [Visión General](#visión-general)
- [Diagrama de Relaciones](#diagrama-de-relaciones)
- [Tablas del Sistema](#tablas-del-sistema)
  - [Tablas de Catálogo](#tablas-de-catálogo)
  - [Tablas de Dependencias](#tablas-de-dependencias)
  - [Tablas de Ejecución](#tablas-de-ejecución)
  - [Tablas de Trazabilidad](#tablas-de-trazabilidad)
- [Flujo de Datos](#flujo-de-datos)
- [Índices y Optimizaciones](#índices-y-optimizaciones)

## 🎯 Visión General

La base de datos está diseñada para soportar un sistema **reactivo** de orquestación de métricas que:

1. **Escucha actualizaciones de datasets** desde sistemas externos
2. **Identifica métricas dependientes** automáticamente
3. **Gestiona dependencias** entre múltiples datasets requeridos por cada métrica
4. **Orquesta la ejecución** de métricas cuando todas las dependencias están listas
5. **Rastrea el estado** de cada ejecución de métrica
6. **Mantiene trazabilidad** completa de qué actualizaciones se usaron en cada ejecución

El diseño prioriza:
- **Idempotencia**: Evita procesar eventos duplicados
- **Integridad referencial**: Foreign keys con CASCADE para mantener consistencia
- **Performance**: Índices optimizados para consultas frecuentes
- **Trazabilidad**: Registro completo de eventos y actualizaciones usadas

## 🔗 Diagrama de Relaciones

```
┌─────────────┐
│   metrics   │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────────────────┐
│  metric_dependencies            │
│  (series requeridas)            │
└──────┬──────────────────────────┘
       │
       │ N:1
       │
┌──────▼──────┐         ┌──────────────┐
│   series    │◄────────┤ dataset_series│
└─────────────┘         └──────┬───────┘
                                │
                                │ N:1
                                │
                        ┌───────▼──────┐
                        │   datasets   │
                        └──────┬───────┘
                                │
                                │ 1:N
                                │
                        ┌───────▼──────────────┐
                        │  dataset_updates     │
                        │  (actualizaciones)   │
                        └──────┬───────────────┘
                                │
                                │ 1:N
                                │
┌─────────────┐         ┌───────▼──────────────────────────┐
│  metric_runs│◄────────┤ metric_run_pending_datasets     │
└──────┬──────┘         │  (dependencias pendientes)       │
       │                └───────────────────────────────────┘
       │
       │ 1:N
       │
┌──────▼──────────────────┐
│  run_dataset_updates    │
│  (trazabilidad)         │
└─────────────────────────┘

┌─────────────┐
│  event_log  │
│  (idempotencia) │
└─────────────┘
```

## 📊 Tablas del Sistema

### Tablas de Catálogo

Estas tablas almacenan las definiciones estáticas del sistema: métricas, series y datasets.

#### `metrics`

**Propósito**: Almacena las definiciones de todas las métricas disponibles en el sistema. Cada métrica tiene una expresión JSON que define cómo se calcula.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(255) | Identificador único de la métrica (PK) |
| `code` | VARCHAR(255) | Código único de la métrica (ej: `ratio.reserves_to_base`) |
| `expression_type` | VARCHAR(50) | Tipo de expresión: `series_math`, `window_op`, o `composite` |
| `expression_json` | JSONB | Expresión JSON que define cómo se calcula la métrica. Usa `seriesCode` (camelCase) para referencias a series |
| `frequency` | VARCHAR(50) | Frecuencia de la métrica (ej: `daily`, `monthly`) |
| `unit` | VARCHAR(50) | Unidad de medida (ej: `ratio`, `ARS_billions`) |
| `description` | TEXT | Descripción de la métrica |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Fecha de última actualización |

**Relaciones**:
- 1:N con `metric_dependencies` (una métrica tiene múltiples dependencias de series)
- 1:N con `metric_runs` (una métrica puede tener múltiples ejecuciones)

**Índices**:
- `idx_metrics_code`: Búsqueda rápida por código
- `idx_metrics_created_at`: Ordenamiento por fecha de creación

**Ejemplo de expresión JSON**:
```json
{
  "op": "ratio",
  "left": {
    "op": "multiply",
    "left": { "seriesCode": "BCRA_RESERVAS_USD_M_D" },
    "right": { "seriesCode": "BCRA_TC_OFICIAL_A3500_PESOSxUSD_D" },
    "scale": 1
  },
  "right": { "seriesCode": "BCRA_BASE_MONETARIA_TOTAL_ARS_BN_D" },
  "scale": 1
}
```

---

#### `series`

**Propósito**: Catálogo centralizado de todas las series de datos disponibles. Una serie representa una variable económica o financiera que puede ser usada en múltiples métricas.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `code` | VARCHAR(255) | Código único de la serie (PK, ej: `BCRA_RESERVAS_USD_M_D`) |
| `name` | VARCHAR(500) | Nombre descriptivo de la serie |
| `description` | TEXT | Descripción detallada de la serie |
| `unit` | VARCHAR(50) | Unidad de medida de la serie |
| `frequency` | VARCHAR(50) | Frecuencia de actualización (ej: `daily`, `monthly`) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Fecha de última actualización |

**Relaciones**:
- N:M con `datasets` a través de `dataset_series` (una serie puede estar en múltiples datasets)
- 1:N con `metric_dependencies` (una serie puede ser requerida por múltiples métricas)

**Índices**:
- `idx_series_code`: Búsqueda rápida por código

---

#### `datasets`

**Propósito**: Catálogo de datasets disponibles. Un dataset es una colección de series que se actualiza periódicamente desde fuentes externas.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(255) | Identificador único del dataset (PK, ej: `bcra_infomondia_series`) |
| `name` | VARCHAR(500) | Nombre descriptivo del dataset |
| `description` | TEXT | Descripción del dataset |
| `bucket` | VARCHAR(255) | Bucket de S3 donde se almacenan los datos del dataset |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Fecha de última actualización |

**Relaciones**:
- N:M con `series` a través de `dataset_series` (un dataset contiene múltiples series)
- 1:N con `dataset_updates` (un dataset tiene múltiples actualizaciones)
- 1:N con `metric_run_pending_datasets` (un dataset puede ser requerido por múltiples runs)

**Índices**:
- `idx_datasets_id`: Búsqueda rápida por ID

---

### Tablas de Dependencias

Estas tablas definen las relaciones entre métricas, series y datasets.

#### `dataset_series`

**Propósito**: Tabla de relación many-to-many entre datasets y series. Indica qué series están disponibles en cada dataset.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `dataset_id` | VARCHAR(255) | ID del dataset (FK → `datasets.id`) |
| `series_code` | VARCHAR(255) | Código de la serie (FK → `series.code`) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación de la relación |

**Clave Primaria**: `(dataset_id, series_code)`

**Relaciones**:
- N:1 con `datasets` (muchas relaciones pertenecen a un dataset)
- N:1 con `series` (muchas relaciones pertenecen a una serie)

**Índices**:
- `idx_dataset_series_dataset_id`: Búsqueda de series por dataset
- `idx_dataset_series_series_code`: Búsqueda de datasets por serie

**Uso**: Permite determinar qué datasets contienen una serie específica, necesario para resolver dependencias de métricas.

---

#### `metric_dependencies`

**Propósito**: Define qué series necesita cada métrica. Esta información se extrae automáticamente del `expression_json` de la métrica.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `metric_id` | VARCHAR(255) | ID de la métrica (FK → `metrics.id`) |
| `series_code` | VARCHAR(255) | Código de la serie requerida (FK → `series.code`) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación de la dependencia |

**Clave Primaria**: `(metric_id, series_code)`

**Relaciones**:
- N:1 con `metrics` (muchas dependencias pertenecen a una métrica)
- N:1 con `series` (muchas dependencias requieren una serie)

**Índices**:
- `idx_metric_dependencies_metric_id`: Búsqueda de dependencias por métrica
- `idx_metric_dependencies_series_code`: Búsqueda de métricas que requieren una serie

**Uso**: Permite identificar qué métricas dependen de un dataset cuando se actualiza, extrayendo las series requeridas y encontrando los datasets que las contienen.

---

### Tablas de Ejecución

Estas tablas gestionan el ciclo de vida de las ejecuciones de métricas.

#### `dataset_updates`

**Propósito**: Registra cada actualización de un dataset. Esta es la tabla central del sistema reactivo: cada vez que un dataset se actualiza, se crea un registro aquí y se dispara el procesamiento de métricas dependientes.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(255) | ID único de la actualización (PK, generado con `gen_random_uuid()`) |
| `dataset_id` | VARCHAR(255) | ID del dataset actualizado (FK → `datasets.id`) |
| `version_manifest_path` | VARCHAR(500) | Ruta al manifest de versión en S3 (ej: `datasets/bcra_infomondia_series/versions/v20251111_014138_730866/manifest.json`) |
| `projections_path` | VARCHAR(500) | Ruta base donde están las proyecciones en S3 |
| `bucket` | VARCHAR(255) | Bucket de S3 donde se almacenan los archivos |
| `event_key` | VARCHAR(500) | Clave única del evento (formato: `{dataset_id}:{version_manifest_path}`) para idempotencia |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora de la actualización |

**Relaciones**:
- N:1 con `datasets` (muchas actualizaciones pertenecen a un dataset)
- 1:N con `metric_run_pending_datasets` (una actualización puede satisfacer múltiples dependencias pendientes)
- 1:N con `run_dataset_updates` (una actualización puede ser usada en múltiples runs)

**Índices**:
- `idx_dataset_updates_dataset_id`: Búsqueda de actualizaciones por dataset
- `idx_dataset_updates_created_at DESC`: Obtener la última actualización de un dataset
- `idx_dataset_updates_event_key`: Verificación de idempotencia

**Uso**: 
- Cuando llega un evento de actualización, se crea un registro aquí
- El sistema busca métricas que dependen de este dataset
- Se crean o actualizan runs pendientes
- Se usa para construir el catálogo de datasets al emitir un run

---

#### `metric_runs`

**Propósito**: Registra cada ejecución de una métrica. Un run representa una instancia de cálculo de una métrica con un conjunto específico de actualizaciones de datasets.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | VARCHAR(255) | ID único del run (PK, generado con `gen_random_uuid()`) |
| `metric_id` | VARCHAR(255) | ID de la métrica a ejecutar (FK → `metrics.id`) |
| `metric_code` | VARCHAR(255) | Código de la métrica (duplicado para consultas rápidas) |
| `status` | VARCHAR(50) | Estado actual del run. Valores posibles: `pending_dependencies`, `queued`, `dispatched`, `running`, `succeeded`, `failed`, `timed_out`, `canceled` |
| `requested_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora en que se solicitó la ejecución |
| `started_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora en que comenzó la ejecución (NULL hasta que se inicia) |
| `finished_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora en que finalizó la ejecución (NULL hasta que termina) |
| `last_heartbeat_at` | TIMESTAMP WITH TIME ZONE | Última vez que se recibió un heartbeat (NULL hasta el primer heartbeat) |
| `error` | TEXT | Mensaje de error si el run falló (NULL si no hay error) |
| `version_ts` | VARCHAR(255) | Timestamp de versión del resultado (NULL hasta que se completa) |
| `manifest_path` | VARCHAR(500) | Ruta al manifest del resultado en S3 (NULL hasta que se completa) |
| `row_count` | INTEGER | Cantidad de filas generadas (NULL hasta que se completa) |

**Relaciones**:
- N:1 con `metrics` (muchos runs pertenecen a una métrica)
- 1:N con `metric_run_pending_datasets` (un run tiene múltiples dependencias pendientes)
- 1:N con `run_dataset_updates` (un run usa múltiples actualizaciones de datasets)

**Índices**:
- `idx_metric_runs_metric_id`: Búsqueda de runs por métrica
- `idx_metric_runs_status`: Búsqueda de runs por estado
- `idx_metric_runs_pending_dependencies`: Índice parcial para runs pendientes (optimiza consultas de runs listos para procesar)

**Estados del Run**:
- `pending_dependencies`: El run está esperando que se actualicen los datasets requeridos
- `queued`: Todas las dependencias están listas, el run está en cola para ejecutarse
- `dispatched`: El evento SNS fue publicado, esperando que el worker lo procese
- `running`: El worker está ejecutando la métrica
- `succeeded`: La ejecución completó exitosamente
- `failed`: La ejecución falló con un error
- `timed_out`: La ejecución excedió el tiempo máximo permitido
- `canceled`: La ejecución fue cancelada manualmente

---

#### `metric_run_pending_datasets`

**Propósito**: Gestiona las dependencias pendientes de cada run. Cuando se crea un run, se registran aquí todos los datasets que necesita. A medida que los datasets se actualizan, se marcan como recibidos.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `run_id` | VARCHAR(255) | ID del run (FK → `metric_runs.id`) |
| `dataset_id` | VARCHAR(255) | ID del dataset requerido (FK → `datasets.id`) |
| `required_days` | INTEGER | Días requeridos de datos (actualmente fijo en 7, futuro: configurable por métrica) |
| `received_update_id` | VARCHAR(255) | ID de la actualización recibida (FK → `dataset_updates.id`, NULL hasta que se recibe) |
| `received` | BOOLEAN | Indica si la dependencia ya fue recibida |
| `received_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora en que se recibió la actualización (NULL hasta que se recibe) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación de la dependencia |

**Clave Primaria**: `(run_id, dataset_id)`

**Relaciones**:
- N:1 con `metric_runs` (muchas dependencias pertenecen a un run)
- N:1 con `datasets` (muchas dependencias requieren un dataset)
- N:1 con `dataset_updates` (una dependencia puede estar satisfecha por una actualización específica)

**Índices**:
- `idx_metric_run_pending_datasets_run_id`: Búsqueda de dependencias por run
- `idx_metric_run_pending_datasets_dataset_id`: Búsqueda de runs pendientes por dataset
- `idx_metric_run_pending_datasets_pending`: Índice parcial para dependencias pendientes (optimiza verificación de runs listos)

**Uso**:
- Al crear un run, se insertan registros aquí para cada dataset requerido
- Cuando un dataset se actualiza, se buscan todos los runs pendientes que lo necesitan
- Se actualiza `received`, `received_update_id` y `received_at`
- Si todas las dependencias de un run están recibidas, el run se emite para ejecución

---

### Tablas de Trazabilidad

Estas tablas mantienen un registro completo de eventos y actualizaciones usadas.

#### `run_dataset_updates`

**Propósito**: Trazabilidad de qué actualizaciones de datasets se usaron en cada run. Permite saber exactamente qué versión de cada dataset se utilizó para calcular una métrica.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `run_id` | VARCHAR(255) | ID del run (FK → `metric_runs.id`) |
| `dataset_update_id` | VARCHAR(255) | ID de la actualización usada (FK → `dataset_updates.id`) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación de la relación |

**Clave Primaria**: `(run_id, dataset_update_id)`

**Relaciones**:
- N:1 con `metric_runs` (muchas relaciones pertenecen a un run)
- N:1 con `dataset_updates` (muchas relaciones usan una actualización)

**Índices**:
- `idx_run_dataset_updates_run_id`: Búsqueda de actualizaciones usadas por un run
- `idx_run_dataset_updates_dataset_update_id`: Búsqueda de runs que usaron una actualización

**Uso**:
- Se crea cuando un run se emite (cambia a `queued` o `dispatched`)
- Permite auditoría completa: saber exactamente qué datos se usaron para cada cálculo
- Facilita debugging y reproducción de resultados

---

#### `event_log`

**Propósito**: Registro de eventos procesados para garantizar idempotencia. Evita procesar el mismo evento múltiples veces.

**Campos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event_key` | VARCHAR(500) | Clave única del evento (PK, formato: `{dataset_id}:{version_manifest_path}`) |
| `event_type` | VARCHAR(100) | Tipo de evento (ej: `projection_update`) |
| `event_payload` | JSONB | Payload completo del evento (almacenado como JSON) |
| `processed_at` | TIMESTAMP WITH TIME ZONE | Fecha y hora en que se procesó el evento (NULL hasta que se procesa) |
| `run_id` | VARCHAR(255) | ID del run asociado (opcional, NULL si no aplica) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Fecha de creación del registro |

**Relaciones**:
- No tiene foreign keys (tabla independiente para idempotencia)

**Índices**:
- `idx_event_log_event_type`: Búsqueda de eventos por tipo
- `idx_event_log_processed_at`: Búsqueda de eventos procesados

**Uso**:
- Antes de procesar un evento, se verifica si ya existe en esta tabla con `processed_at` no NULL
- Si ya fue procesado, se omite el procesamiento
- Si no existe o no fue procesado, se crea/actualiza el registro
- Al finalizar el procesamiento, se actualiza `processed_at`

**Flujo de Idempotencia**:
1. Evento llega con `event_key = "bcra_infomondia_series:datasets/.../manifest.json"`
2. Se busca en `event_log` por `event_key`
3. Si existe y `processed_at IS NOT NULL` → se omite
4. Si no existe o `processed_at IS NULL` → se procesa
5. Al finalizar, se actualiza `processed_at = NOW()`

---

## 🔄 Flujo de Datos

### 1. Actualización de Dataset

```
Evento SQS (ProjectionUpdateEvent)
    ↓
OnProjectionUpdateUseCase.execute()
    ↓
1. Verificar idempotencia (event_log)
2. Registrar evento (event_log)
3. Crear dataset_update
    ↓
4. Buscar métricas dependientes (metric_dependencies → metrics)
    ↓
5. Para cada métrica:
   - Resolver datasets requeridos (metric_dependencies → series → dataset_series → datasets)
   - Crear metric_run (status: pending_dependencies)
   - Crear metric_run_pending_datasets para cada dataset requerido
   - Si todas las dependencias están listas → emitir run
    ↓
6. Actualizar runs pendientes existentes (metric_run_pending_datasets)
    ↓
7. Emitir runs listos (cambiar status a queued, publicar SNS)
8. Guardar run_dataset_updates
9. Marcar evento como procesado (event_log.processed_at)
```

### 2. Ejecución de Métrica

```
Evento SNS (MetricRunRequestEvent)
    ↓
Worker procesa la métrica
    ↓
1. Enviar MetricRunStartedEvent → actualizar metric_runs (status: running, started_at)
    ↓
2. Durante ejecución: enviar MetricRunHeartbeatEvent → actualizar metric_runs.last_heartbeat_at
    ↓
3. Al finalizar: enviar MetricRunCompletedEvent
   → actualizar metric_runs (status: succeeded/failed, finished_at, version_ts, manifest_path, row_count, error)
```

### 3. Resolución de Dependencias

```
Métrica necesita series: [A, B, C]
    ↓
Buscar en metric_dependencies → series requeridas
    ↓
Para cada serie, buscar en dataset_series → datasets que la contienen
    ↓
Resultado: datasets requeridos = [dataset_1, dataset_2]
    ↓
Crear metric_run_pending_datasets para cada dataset
    ↓
Cuando dataset_1 se actualiza:
   → Buscar runs pendientes que requieren dataset_1
   → Actualizar metric_run_pending_datasets (received = true, received_update_id, received_at)
   → Verificar si todas las dependencias están listas
   → Si sí, emitir run
```

---

## 📈 Índices y Optimizaciones

### Índices por Tabla

#### `metrics`
- `idx_metrics_code`: Búsqueda rápida por código (usado en validaciones y consultas)

#### `series`
- `idx_series_code`: Búsqueda rápida por código (usado en joins con metric_dependencies)

#### `datasets`
- `idx_datasets_id`: Búsqueda rápida por ID (usado en joins frecuentes)

#### `dataset_series`
- `idx_dataset_series_dataset_id`: Encontrar todas las series de un dataset
- `idx_dataset_series_series_code`: Encontrar todos los datasets que contienen una serie

#### `metric_dependencies`
- `idx_metric_dependencies_metric_id`: Encontrar todas las series requeridas por una métrica
- `idx_metric_dependencies_series_code`: Encontrar todas las métricas que requieren una serie

#### `dataset_updates`
- `idx_dataset_updates_dataset_id`: Encontrar todas las actualizaciones de un dataset
- `idx_dataset_updates_created_at DESC`: Obtener la última actualización (usado en `findLatestByDatasetId`)
- `idx_dataset_updates_event_key`: Verificación de idempotencia

#### `metric_runs`
- `idx_metric_runs_metric_id`: Encontrar todos los runs de una métrica
- `idx_metric_runs_status`: Filtrar runs por estado
- `idx_metric_runs_pending_dependencies`: **Índice parcial** para runs pendientes (optimiza consultas de runs listos)

#### `metric_run_pending_datasets`
- `idx_metric_run_pending_datasets_run_id`: Encontrar todas las dependencias de un run
- `idx_metric_run_pending_datasets_dataset_id`: Encontrar todos los runs que esperan un dataset
- `idx_metric_run_pending_datasets_pending`: **Índice parcial** para dependencias pendientes (optimiza verificación de runs listos)

#### `run_dataset_updates`
- `idx_run_dataset_updates_run_id`: Encontrar todas las actualizaciones usadas en un run
- `idx_run_dataset_updates_dataset_update_id`: Encontrar todos los runs que usaron una actualización

#### `event_log`
- `idx_event_log_event_type`: Filtrar eventos por tipo
- `idx_event_log_processed_at`: Consultas de eventos procesados

### Optimizaciones Clave

1. **Índices Parciales**: Los índices `idx_metric_runs_pending_dependencies` y `idx_metric_run_pending_datasets_pending` solo indexan registros con `status = 'pending_dependencies'` y `received = FALSE` respectivamente, reduciendo el tamaño del índice y mejorando performance.

2. **Foreign Keys con CASCADE**: Todas las foreign keys usan `ON DELETE CASCADE` para mantener integridad referencial automáticamente.

3. **Timestamps con Time Zone**: Todas las fechas usan `TIMESTAMP WITH TIME ZONE` para manejo correcto de zonas horarias.

4. **Claves Únicas**: `event_key` en `dataset_updates` y `event_log` garantiza idempotencia a nivel de base de datos.

---

## 🔍 Consultas Frecuentes

### ¿Cómo encontrar métricas que dependen de un dataset?

```sql
SELECT DISTINCT m.*
FROM metrics m
JOIN metric_dependencies md ON m.id = md.metric_id
JOIN dataset_series ds ON md.series_code = ds.series_code
WHERE ds.dataset_id = 'bcra_infomondia_series';
```

### ¿Cómo obtener la última actualización de un dataset?

```sql
SELECT *
FROM dataset_updates
WHERE dataset_id = 'bcra_infomondia_series'
ORDER BY created_at DESC
LIMIT 1;
```

### ¿Cómo verificar si un run está listo para ejecutarse?

```sql
SELECT run_id
FROM metric_run_pending_datasets
WHERE run_id = 'run-id-123'
  AND received = FALSE;
-- Si no hay resultados, el run está listo
```

### ¿Qué actualizaciones se usaron en un run?

```sql
SELECT du.*
FROM run_dataset_updates rdu
JOIN dataset_updates du ON rdu.dataset_update_id = du.id
WHERE rdu.run_id = 'run-id-123';
```

---

## 📝 Notas de Diseño

1. **Normalización**: El diseño está normalizado para evitar redundancia. Por ejemplo, `metric_code` en `metric_runs` es redundante pero mejora performance en consultas frecuentes.

2. **Idempotencia**: El sistema garantiza idempotencia a través de `event_key` único en `dataset_updates` y `event_log`.

3. **Trazabilidad Completa**: Cada run mantiene registro de exactamente qué actualizaciones se usaron, permitiendo reproducibilidad y auditoría.

4. **Sistema Reactivo**: El diseño está optimizado para procesamiento reactivo: cuando un dataset se actualiza, se dispara automáticamente el procesamiento de métricas dependientes.

5. **Escalabilidad**: Los índices están diseñados para soportar grandes volúmenes de datos y consultas frecuentes.

