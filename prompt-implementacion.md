# Prompt de Implementación: Sistema de Orquestación de Métricas Reactivo

## Objetivo

Implementar desde cero un sistema de orquestación de métricas que procesa eventos de actualización de datasets de manera reactiva, determinando automáticamente qué métricas deben ejecutarse y coordinando su ejecución cuando todas las dependencias están disponibles.

---

## Stack Tecnológico

### Framework y Lenguaje
- **NestJS** (v10+): Framework principal para la aplicación
- **TypeScript** (v5+): Lenguaje de programación
- **Node.js**: Runtime environment

### Base de Datos
- **PostgreSQL**: Base de datos relacional
- **pg**: Driver de PostgreSQL para Node.js

### Cloud y Mensajería
- **AWS S3**: Almacenamiento de archivos (manifests, proyecciones, resultados)
- **AWS SNS**: Publicación de eventos (métricas a ejecutar)
- **AWS SQS**: Consumo de eventos (actualizaciones de datasets, estados de ejecución)

### Logging y Observabilidad
- **Pino**: Logger estructurado de alto rendimiento
- **pino-pretty**: Formateo de logs para desarrollo

### Herramientas de Desarrollo
- **Jest**: Framework de testing
- **ESLint + Prettier**: Linting y formateo de código
- **TypeScript**: Compilador y type checking

---

## Arquitectura

### Clean Architecture

El proyecto debe seguir estrictamente los principios de Clean Architecture con las siguientes capas:

#### 1. Domain (Capa de Dominio)
**Ubicación**: `src/domain/`

**Responsabilidades:**
- Entidades de dominio (interfaces TypeScript que representan conceptos del negocio)
- Puertos (interfaces que definen contratos, no implementaciones)
- Servicios de dominio (lógica de negocio pura, sin dependencias externas)
- DTOs (Data Transfer Objects para transferencia de datos)
- Constantes y tipos de dominio
- Errores de dominio

**Reglas:**
- NO debe tener dependencias de otras capas
- NO debe conocer frameworks, bases de datos, o infraestructura
- Solo interfaces TypeScript, sin implementaciones concretas
- Debe ser completamente testeable sin mocks de infraestructura

**Estructura:**
```
domain/
  entities/        # Entidades de dominio (Metric, MetricRun, Dataset, etc.)
  ports/           # Interfaces de repositorios y servicios externos
  services/        # Servicios de dominio (lógica de negocio pura)
  dto/             # Data Transfer Objects
  constants/       # Constantes y enums
  errors/          # Errores de dominio
  interfaces/      # Interfaces compartidas (Logger, Database, etc.)
```

#### 2. Application (Capa de Aplicación)
**Ubicación**: `src/application/`

**Responsabilidades:**
- Use Cases (casos de uso que orquestan la lógica de negocio)
- Servicios de aplicación (servicios que coordinan entre múltiples repositorios)
- Validadores (validación de expresiones, métricas, etc.)

**Reglas:**
- Depende SOLO de la capa Domain
- Implementa la lógica de casos de uso
- Orquesta llamadas a repositorios y servicios
- NO debe conocer detalles de infraestructura (bases de datos, AWS, etc.)
- Usa los puertos (interfaces) definidos en Domain

**Estructura:**
```
application/
  use-cases/       # Casos de uso (OnProjectionUpdateUseCase, etc.)
  services/        # Servicios de aplicación (orquestadores, emisores, etc.)
  validation/      # Validadores de expresiones y métricas
```

#### 3. Infrastructure (Capa de Infraestructura)
**Ubicación**: `src/infrastructure/`

**Responsabilidades:**
- Implementaciones concretas de repositorios (PostgreSQL)
- Clientes de base de datos
- Implementaciones de servicios externos (AWS S3, SNS)
- Mappers (conversión entre entidades de dominio y modelos de base de datos)
- Configuración

**Reglas:**
- Depende de Domain (implementa los puertos)
- Depende de Application (proporciona implementaciones)
- Contiene TODAS las dependencias externas
- Implementaciones específicas de tecnologías

**Estructura:**
```
infrastructure/
  db/              # Repositorios PostgreSQL, mappers, clientes
  aws/             # Clientes AWS (SNS, S3)
  s3/              # Servicios relacionados con S3
  config/          # Configuración de la aplicación
  shared/          # Utilidades compartidas de infraestructura
```

#### 4. Interfaces (Capa de Presentación)
**Ubicación**: `src/interfaces/`

**Responsabilidades:**
- Controladores HTTP (REST API)
- Consumidores de colas (SQS consumers)
- Providers de inyección de dependencias (NestJS)
- Módulos de NestJS

**Reglas:**
- Depende de Application (usa los use cases)
- Depende de Infrastructure (configura las implementaciones)
- Punto de entrada de la aplicación
- Configuración de NestJS y providers

**Estructura:**
```
interfaces/
  http/            # Controladores REST
  queue/           # Consumidores de SQS
  providers/       # Providers de inyección de dependencias
```

---

## Principios y Guidelines de Código

### Principios Fundamentales

1. **SOLID**
   - **Single Responsibility**: Cada clase tiene UNA responsabilidad
   - **Open/Closed**: Abierto a extensión, cerrado a modificación
   - **Liskov Substitution**: Las implementaciones deben ser intercambiables
   - **Interface Segregation**: Interfaces pequeñas y específicas
   - **Dependency Inversion**: Depender de abstracciones, no de implementaciones

2. **Menor Código Posible**
   - Evitar código duplicado
   - Extraer lógica común a servicios reutilizables
   - Usar funciones pequeñas y enfocadas
   - Evitar abstracciones innecesarias
   - Preferir composición sobre herencia

3. **Menor Complejidad Posible**
   - Evitar anidamiento excesivo
   - Métodos cortos y legibles
   - Separar responsabilidades claramente
   - Evitar lógica compleja en use cases (mover a servicios)

4. **Legibilidad y Mantenibilidad**
   - Nombres descriptivos y claros
   - Código autodocumentado
   - Comentarios solo cuando sea necesario explicar "por qué", no "qué"
   - Estructura clara y predecible
   - TypeScript estricto con tipos explícitos

### Guidelines Específicos

#### Inyección de Dependencias

- Usar el patrón de Providers de NestJS
- Repositorios se inyectan usando strings como tokens (`'MetricRepository'`)
- Servicios de aplicación se inyectan usando clases directamente
- Configuración se inyecta usando tokens constantes (`CONFIG_TOKEN`)
- Los providers deben estar en `src/interfaces/providers/`

**Ejemplo de Provider:**
```typescript
// En interfaces/providers/repositories.provider.ts
{
  provide: 'MetricRepository',
  useClass: PostgresMetricRepository,
}
```

**Ejemplo de Inyección en Use Case:**
```typescript
constructor(
  @Inject('MetricRepository')
  private readonly metricRepository: MetricRepository,
) {}
```

#### Estructura de Use Cases

- Un use case = una responsabilidad
- Métodos privados para lógica auxiliar
- Logging en puntos clave del flujo
- Manejo de errores explícito
- Transacciones de base de datos cuando sea necesario

#### Estructura de Repositorios

- Implementar interfaces definidas en `domain/ports/`
- Usar mappers para convertir entre modelos de DB y entidades de dominio
- Queries SQL claras y legibles
- Manejo de errores de base de datos

#### Estructura de Servicios

- Servicios de aplicación: coordinan múltiples repositorios
- Servicios de dominio: lógica de negocio pura
- Un servicio = una responsabilidad específica

#### Logging

#### Implementación del Logger

El sistema debe usar **Pino** como logger estructurado con una interfaz específica definida en la capa de dominio.

**Interfaz del Logger (Domain Layer):**

```typescript
export interface Logger {
  info: (params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
  }) => void;
  
  error: (params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
    err: Error | unknown;
  }) => void;
}
```

**Características:**

1. **Estructura de Logs:**
   - Todos los logs deben incluir un `event` (tipo de evento, ej: "ON_PROJECTION_UPDATE")
   - Todos los logs deben incluir un `msg` (mensaje descriptivo)
   - Los logs pueden incluir `data` opcional con contexto adicional
   - Los logs de error deben incluir `err` con el error capturado

2. **Implementación con Pino:**
   - Usar Pino como logger base
   - En desarrollo local: usar `pino-pretty` para formateo legible con colores
   - En producción: usar formato JSON estándar de Pino
   - El nivel de log debe ser configurable (LOG_LEVEL en configuración)

3. **Estructura de Logs Info:**
   ```typescript
   logger.info({
     event: "ON_PROJECTION_UPDATE",
     msg: "Processing projection update event",
     data: { datasetId: "dataset-123", updateId: "update-456" }
   });
   ```
   
   **Salida JSON:**
   ```json
   {
     "level": 30,
     "time": 1234567890,
     "event": "ON_PROJECTION_UPDATE",
     "msg": "Processing projection update event",
     "data": {
       "datasetId": "dataset-123",
       "updateId": "update-456"
     }
   }
   ```

4. **Estructura de Logs Error:**
   ```typescript
   logger.error({
     event: "ON_PROJECTION_UPDATE",
     msg: "Failed to create immediate run, marked as FAILED",
     data: { metricCode: "revenue_ratio", runId: "run-123" },
     err: error
   });
   ```
   
   **Salida JSON (con Error):**
   ```json
   {
     "level": 50,
     "time": 1234567890,
     "event": "ON_PROJECTION_UPDATE",
     "msg": "Failed to create immediate run, marked as FAILED",
     "data": {
       "metricCode": "revenue_ratio",
       "runId": "run-123"
     },
     "message": "Series not found",
     "stack": "Error: Series not found\n    at ...",
     "name": "Error"
   }
   ```

5. **Constantes de Eventos:**
   - Definir constantes para tipos de eventos en `domain/constants/log-events.ts`
   - Usar estas constantes en lugar de strings literales
   - Ejemplos: `ON_PROJECTION_UPDATE`, `ON_RUN_COMPLETED`, `ON_RUN_STARTED`, etc.

6. **Ubicación de la Implementación:**
   - **Interfaz**: `src/domain/interfaces/logger.interface.ts`
   - **Implementación**: `src/infrastructure/shared/metrics-logger.ts`
   - **Exportar**: `defaultLogger` como instancia por defecto

7. **Uso en el Código:**
   - Inyectar el logger como dependencia en constructores
   - Usar valor por defecto: `private readonly logger: Logger = defaultLogger`
   - Loggear en puntos clave del flujo (no excesivamente)
   - Incluir contexto relevante en `data` (runId, metricCode, datasetId, etc.)
   - No loggear información sensible (tokens, passwords, etc.)

8. **Puntos Clave para Logging:**
   - Inicio y fin de procesamiento de eventos
   - Cambios de estado importantes (runs pendientes → queued, etc.)
   - Errores y excepciones
   - Decisiones importantes (run inmediato vs pendiente)
   - Validaciones que afectan el flujo

9. **Configuración:**
   - El nivel de log debe venir de configuración (LOG_LEVEL)
   - Valores típicos: "debug", "info", "warn", "error"
   - En producción, usar "info" o superior

---

## Contratos de Comunicación

### Eventos que se Reciben

#### ProjectionUpdateEvent

El sistema recibe este evento cuando un dataset es actualizado.

**Estructura:**
```json
{
  "event": "projection_update",
  "dataset_id": "string",
  "bucket": "string",
  "version_manifest_path": "string",
  "projections_path": "string"
}
```

**Campos:**
- `event`: Siempre `"projection_update"`
- `dataset_id`: Identificador único del dataset actualizado
- `bucket`: Bucket de almacenamiento donde están los archivos
- `version_manifest_path`: Ruta completa al manifest de versión
- `projections_path`: Ruta base donde están las proyecciones

**Características:**
- Debe ser idempotente (procesar múltiples veces no causa efectos secundarios)
- Se consume desde una cola SQS

---

#### MetricRunStartedEvent

Se recibe cuando el procesador de métricas comienza a ejecutar una métrica.

**Estructura:**
```json
{
  "type": "metric_run_started",
  "runId": "string",
  "startedAt": "string (ISO timestamp, opcional)"
}
```

---

#### MetricRunHeartbeatEvent

Se recibe periódicamente durante la ejecución.

**Estructura:**
```json
{
  "type": "metric_run_heartbeat",
  "runId": "string",
  "progress": "number (0-100, opcional)",
  "ts": "string (ISO timestamp)"
}
```

---

#### MetricRunCompletedEvent

Se recibe cuando la ejecución termina.

**Estructura:**
```json
{
  "type": "metric_run_completed",
  "runId": "string",
  "metricCode": "string",
  "status": "SUCCESS" | "FAILURE",
  "versionTs": "string (ISO timestamp, opcional)",
  "outputManifest": "string (ruta, opcional)",
  "rowCount": "number (opcional)",
  "error": "string (opcional, solo si status es FAILURE)"
}
```

---

### Eventos que se Publican

#### MetricRunRequestEvent

Se publica cuando el sistema determina que una métrica debe ejecutarse.

**Estructura:**
```json
{
  "type": "metric_run_requested",
  "runId": "string",
  "metricCode": "string",
  "expressionType": "series_math" | "window_op" | "composite",
  "expressionJson": {
    // Estructura varía según expressionType
    // Para series_math:
    "op": "ratio" | "multiply" | "subtract" | "add",
    "left": { "seriesCode": "string" } | ExpressionJson,
    "right": { "seriesCode": "string" } | ExpressionJson,
    "scale": "number (opcional)"
    // Para window_op:
    "op": "sma" | "ema" | "sum" | "max" | "min" | "lag",
    "series": { "seriesCode": "string" } | ExpressionJson,
    "window": "number"
    // Para composite:
    "op": "sum" | "avg" | "max" | "min",
    "operands": [{ "seriesCode": "string" }]
  },
  "inputs": [
    {
      "datasetId": "string",
      "seriesCode": "string"
    }
  ],
  "catalog": {
    "datasets": {
      "datasetId": {
        "manifestPath": "string",
        "projectionsPath": "string"
      }
    }
  },
  "output": {
    "basePath": "string (S3 path)"
  },
  "messageGroupId": "string (opcional, para FIFO)",
  "messageDeduplicationId": "string (opcional, para FIFO)"
}
```

**Características:**
- Se publica a un topic SNS
- Puede ser topic FIFO o estándar
- Los campos `messageGroupId` y `messageDeduplicationId` solo se incluyen si el topic es FIFO

---

## Esquema de Base de Datos

### Tabla: `metrics`

Almacena las definiciones de métricas.

```sql
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
```

### Tabla: `series`

Catálogo centralizado de todas las series disponibles.

```sql
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
```

### Tabla: `datasets`

Catálogo de datasets disponibles.

```sql
CREATE TABLE datasets (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(500),
  description TEXT,
  bucket VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_datasets_id ON datasets(id);
```

### Tabla: `dataset_series`

Relación many-to-many entre datasets y series.

```sql
CREATE TABLE dataset_series (
  dataset_id VARCHAR(255) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  series_code VARCHAR(255) NOT NULL REFERENCES series(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dataset_id, series_code)
);

CREATE INDEX idx_dataset_series_dataset_id ON dataset_series(dataset_id);
CREATE INDEX idx_dataset_series_series_code ON dataset_series(series_code);
```

### Tabla: `metric_dependencies`

Dependencias de métricas (qué series necesita cada métrica).

```sql
CREATE TABLE metric_dependencies (
  metric_id VARCHAR(255) NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  series_code VARCHAR(255) NOT NULL REFERENCES series(code) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric_id, series_code)
);

CREATE INDEX idx_metric_dependencies_metric_id ON metric_dependencies(metric_id);
CREATE INDEX idx_metric_dependencies_series_code ON metric_dependencies(series_code);
```

### Tabla: `dataset_updates`

Actualizaciones de datasets (tabla central para sistema reactivo).

```sql
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
```

### Tabla: `metric_runs`

Ejecuciones de métricas.

```sql
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
```

### Tabla: `metric_run_pending_datasets`

Dependencias pendientes de cada run.

```sql
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
```

### Tabla: `run_dataset_updates`

Trazabilidad de qué actualizaciones de datasets se usaron en cada run.

```sql
CREATE TABLE run_dataset_updates (
  run_id VARCHAR(255) NOT NULL REFERENCES metric_runs(id) ON DELETE CASCADE,
  dataset_update_id VARCHAR(255) NOT NULL REFERENCES dataset_updates(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, dataset_update_id)
);

CREATE INDEX idx_run_dataset_updates_run_id ON run_dataset_updates(run_id);
CREATE INDEX idx_run_dataset_updates_dataset_update_id 
  ON run_dataset_updates(dataset_update_id);
```

### Tabla: `event_log`

Registro de eventos procesados para idempotencia.

```sql
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
```

---

## Flujo de Procesamiento

### Flujo Principal: Procesamiento de ProjectionUpdateEvent

El flujo completo está documentado en `docs/flujo-projection-update.md`. Resumen:

1. **Recepción del Evento**: El sistema recibe un `ProjectionUpdateEvent` desde SQS
2. **Verificación de Idempotencia**: Se verifica si el evento ya fue procesado usando `event_log`
3. **Persistencia de Actualización**: Se guarda la actualización en `dataset_updates`
4. **Actualización de Runs Pendientes**: Se buscan runs que esperan este dataset y se actualizan si la actualización es válida
5. **Búsqueda de Métricas Dependientes**: Se encuentran métricas que dependen de series de este dataset
6. **Procesamiento de Métricas**: Para cada métrica:
   - Se resuelven los datasets requeridos
   - Si solo necesita este dataset: se crea run inmediato y se emite
   - Si necesita múltiples datasets: se crea run pendiente
7. **Emisión de Runs Completados**: Cuando todas las dependencias de un run pendiente están listas, se emite el `MetricRunRequestEvent`

### Características del Flujo

- **Reactivo**: No hay schedulers, cada evento dispara el procesamiento inmediatamente
- **Idempotente**: Procesar el mismo evento múltiples veces no causa efectos secundarios
- **Transaccional**: Todo el procesamiento está dentro de una transacción de base de datos
- **Ventana de Tiempo**: Cada run puede tener una ventana de tiempo diferente para validar actualizaciones

---

## Estructura de Servicios de Aplicación

El flujo debe estar dividido en servicios especializados con responsabilidades claras:

### DatasetUpdateService
- Responsabilidad: Persistir actualizaciones de datasets
- Métodos: `persistUpdate(event: ProjectionUpdateEvent)`

### PendingRunService
- Responsabilidad: Gestionar runs pendientes
- Métodos: 
  - `updatePendingRunsForDataset(datasetId, updateId, updateCreatedAt)`
  - `completePendingRun(runId)`

### MetricDependencyResolver
- Responsabilidad: Resolver dependencias de métricas
- Métodos:
  - `findMetricsForDataset(datasetId)`
  - `resolveRequiredDatasets(metricId)`

### MetricRunOrchestrator
- Responsabilidad: Orquestar la creación y emisión de runs
- Métodos:
  - `createRunForMetric(metric, currentDatasetId, currentUpdate, requiredDatasetIds)`
  - `emitPendingRun(runId)`

### MetricRunEventEmitter
- Responsabilidad: Construir y publicar eventos de solicitud de ejecución
- Métodos: `emit(data: MetricRunEventData)`

---

## Validaciones y Reglas de Negocio

### Validación de Ventana de Tiempo

- Cada run pendiente tiene un `required_days` (días mínimos requeridos)
- Una actualización es válida si: `update.created_at >= NOW() - required_days días`
- Si una actualización es muy antigua, se omite para ese run

### Resolución de Dependencias

- Las métricas dependen de **series**, no de datasets directamente
- Para encontrar qué datasets necesita una métrica:
  1. Obtener todas las series que la métrica necesita
  2. Para cada serie, encontrar en qué datasets está disponible
  3. Obtener la lista única de datasets

### Decisión: Run Inmediato vs Pendiente

- **Run Inmediato**: Si la métrica solo requiere un dataset Y ese dataset es el que acaba de actualizarse
- **Run Pendiente**: Si la métrica requiere múltiples datasets O requiere un dataset diferente

---

## Consideraciones de Implementación

### Transacciones

- Todo el procesamiento de un `ProjectionUpdateEvent` debe estar en una transacción
- Si algo falla, se revierte todo
- Los repositorios deben poder trabajar con un cliente de transacción

### Logging

- Logs en puntos clave del flujo
- Incluir contexto relevante (datasetId, runId, metricCode)
- No loggear información sensible
- Usar logger estructurado (Pino)

### Manejo de Errores

- Errores de dominio deben ser tipos específicos
- Errores de infraestructura deben ser capturados y loggeados
- Si un run falla al emitirse, marcarlo como "failed" con el error

### Testing

- Tests unitarios para servicios y use cases
- Tests de integración para repositorios
- Mocks de infraestructura (AWS, DB) en tests

---

## Entregables Esperados

1. **Estructura de Carpetas**: Seguir la estructura de Clean Architecture descrita
2. **Implementación Completa**: Todos los use cases, servicios, repositorios necesarios
3. **Migraciones de Base de Datos**: Scripts SQL para crear todas las tablas
4. **Providers de NestJS**: Configuración completa de inyección de dependencias
5. **Consumidores de Colas**: SQS consumers para todos los eventos de entrada
6. **Publicador de Eventos**: Implementación para publicar a SNS
7. **Logging**: Implementación de logging estructurado en puntos clave
8. **Manejo de Errores**: Manejo apropiado de errores en todas las capas

---

## Notas Finales

- **Prioridad**: Legibilidad y mantenibilidad sobre optimización prematura
- **Simplicidad**: Menor código posible, menor complejidad posible
- **SOLID**: Respetar todos los principios SOLID
- **Clean Architecture**: Separación estricta de capas
- **Contratos**: Respetar exactamente los contratos de eventos documentados
- **Flujo**: Seguir exactamente el flujo documentado en `docs/flujo-projection-update.md`

---

## Referencias

- Documento de flujo completo: `docs/flujo-projection-update.md`
- Contratos de eventos: Sección "Contratos de Comunicación Externa" en el documento de flujo
- Esquema de base de datos: Migración `007_redesign_database_schema.sql`

