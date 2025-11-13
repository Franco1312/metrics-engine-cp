# Plan de Implementación Gradual: Sistema de Orquestación de Métricas Reactivo

Este documento describe un plan paso a paso para implementar el sistema completo, dividido en fases incrementales que permiten validar cada componente antes de continuar.

---

## Fase 0: Configuración Inicial del Proyecto

### Objetivo
Configurar la estructura base del proyecto NestJS con todas las dependencias necesarias.

### Tareas
1. **Inicializar proyecto NestJS**
   - Crear proyecto con `nest new`
   - Configurar TypeScript estricto
   - Configurar ESLint y Prettier

2. **Instalar dependencias**
   - `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
   - `pg` (PostgreSQL driver)
   - `@aws-sdk/client-s3`, `@aws-sdk/client-sns`
   - `pino`, `pino-pretty`
   - `jest` y dependencias de testing

3. **Crear estructura de carpetas**
   ```
   src/
     domain/
       entities/
       ports/
       services/
       dto/
       constants/
       errors/
       interfaces/
     application/
       use-cases/
       services/
       validation/
     infrastructure/
       db/
       aws/
       s3/
       config/
       shared/
     interfaces/
       http/
       queue/
       providers/
   ```

4. **Configurar scripts en package.json**
   - `start:dev`, `start:prod`
   - `test`, `test:watch`
   - `build`

### Criterio de Éxito
- Proyecto NestJS inicializado
- Todas las dependencias instaladas
- Estructura de carpetas creada
- Proyecto compila sin errores

---

## Fase 1: Infraestructura Base y Configuración

### Objetivo
Implementar la configuración, logging y conexión a base de datos.

### Tareas
1. **Configuración de la aplicación**
   - Crear `infrastructure/config/app.config.ts`
   - Variables de entorno: DB, AWS, LOG_LEVEL
   - Token de configuración: `CONFIG_TOKEN`
   - Provider de configuración

2. **Logger estructurado (Pino)**
   - Crear interfaz `domain/interfaces/logger.interface.ts`
   - Implementar `infrastructure/shared/metrics-logger.ts`
   - Exportar `defaultLogger`
   - Configurar `pino-pretty` para desarrollo

3. **Constantes de eventos de log**
   - Crear `domain/constants/log-events.ts`
   - Definir constantes: `ON_PROJECTION_UPDATE`, `ON_RUN_COMPLETED`, etc.

4. **Cliente de base de datos PostgreSQL**
   - Crear `infrastructure/db/database.client.ts`
   - Pool de conexiones configurable
   - Métodos para transacciones
   - Provider de cliente de DB

5. **Errores de dominio**
   - Crear `domain/errors/` con errores específicos
   - Ejemplos: `MetricNotFoundError`, `DatasetNotFoundError`, etc.

### Criterio de Éxito
- Configuración cargada desde variables de entorno
- Logger funcionando con formato estructurado
- Cliente de DB puede conectarse y ejecutar queries simples
- Tests básicos de configuración y logger pasan

---

## Fase 2: Esquema de Base de Datos y Migraciones

### Objetivo
Crear todas las tablas necesarias en PostgreSQL.

### Tareas
1. **Script de migración completo**
   - Crear `migrations/001_initial_schema.sql`
   - Incluir todas las tablas:
     - `metrics`
     - `series`
     - `datasets`
     - `dataset_series`
     - `metric_dependencies`
     - `dataset_updates`
     - `metric_runs`
     - `metric_run_pending_datasets`
     - `run_dataset_updates`
     - `event_log`
   - Incluir todos los índices
   - Incluir constraints y foreign keys

2. **Script de rollback** (opcional)
   - `migrations/001_rollback.sql`

3. **Validación**
   - Verificar que todas las tablas se crean correctamente
   - Verificar índices y constraints

### Criterio de Éxito
- Todas las tablas creadas en la base de datos
- Índices y constraints aplicados correctamente
- Schema validado contra el documento de especificación

---

## Fase 3: Entidades y Puertos del Dominio

### Objetivo
Definir todas las entidades de dominio, DTOs y puertos (interfaces).

### Tareas
1. **Entidades de dominio**
   - `domain/entities/metric.entity.ts` (Metric)
   - `domain/entities/series.entity.ts` (Series)
   - `domain/entities/dataset.entity.ts` (Dataset)
   - `domain/entities/dataset-update.entity.ts` (DatasetUpdate)
   - `domain/entities/metric-run.entity.ts` (MetricRun)
   - `domain/entities/pending-dataset.entity.ts` (PendingDataset)

2. **DTOs**
   - `domain/dto/projection-update-event.dto.ts` (ProjectionUpdateEvent)
   - `domain/dto/metric-run-request-event.dto.ts` (MetricRunRequestEvent)
   - `domain/dto/metric-run-started-event.dto.ts` (MetricRunStartedEvent)
   - `domain/dto/metric-run-heartbeat-event.dto.ts` (MetricRunHeartbeatEvent)
   - `domain/dto/metric-run-completed-event.dto.ts` (MetricRunCompletedEvent)

3. **Puertos (Interfaces de repositorios)**
   - `domain/ports/metric.repository.ts` (MetricRepository)
   - `domain/ports/series.repository.ts` (SeriesRepository)
   - `domain/ports/dataset.repository.ts` (DatasetRepository)
   - `domain/ports/dataset-update.repository.ts` (DatasetUpdateRepository)
   - `domain/ports/metric-run.repository.ts` (MetricRunRepository)
   - `domain/ports/pending-dataset.repository.ts` (PendingDatasetRepository)
   - `domain/ports/event-log.repository.ts` (EventLogRepository)

4. **Interfaces de servicios externos**
   - `domain/interfaces/sns-publisher.interface.ts` (SNSPublisher)
   - `domain/interfaces/s3-client.interface.ts` (S3Client) - si es necesario

5. **Constantes y tipos**
   - `domain/constants/metric-status.ts` (estados de runs)
   - `domain/constants/expression-types.ts` (tipos de expresiones)
   - Tipos para `ExpressionJson` según tipo de expresión

### Criterio de Éxito
- Todas las entidades definidas con sus propiedades
- Todos los puertos definidos con sus métodos
- DTOs con validación básica
- Código compila sin errores
- Tests unitarios básicos de entidades pasan

---

## Fase 4: Mappers y Repositorios PostgreSQL

### Objetivo
Implementar los repositorios concretos que interactúan con PostgreSQL.

### Tareas
1. **Mappers**
   - `infrastructure/db/mappers/metric.mapper.ts`
   - `infrastructure/db/mappers/dataset-update.mapper.ts`
   - `infrastructure/db/mappers/metric-run.mapper.ts`
   - `infrastructure/db/mappers/pending-dataset.mapper.ts`
   - Conversión entre modelos de DB (rows) y entidades de dominio

2. **Repositorios PostgreSQL**
   - `infrastructure/db/repositories/postgres-metric.repository.ts`
   - `infrastructure/db/repositories/postgres-series.repository.ts`
   - `infrastructure/db/repositories/postgres-dataset.repository.ts`
   - `infrastructure/db/repositories/postgres-dataset-update.repository.ts`
   - `infrastructure/db/repositories/postgres-metric-run.repository.ts`
   - `infrastructure/db/repositories/postgres-pending-dataset.repository.ts`
   - `infrastructure/db/repositories/postgres-event-log.repository.ts`

3. **Queries SQL**
   - Implementar todas las queries necesarias
   - Soporte para transacciones (recibir cliente de transacción)
   - Manejo de errores de base de datos

4. **Providers de repositorios**
   - Crear `interfaces/providers/repositories.provider.ts`
   - Configurar todos los repositorios con tokens string

### Criterio de Éxito
- Todos los repositorios implementados
- Mappers funcionando correctamente
- Tests de integración de repositorios pasan
- Soporte de transacciones verificado
- Queries optimizadas con índices

---

## Fase 5: Clientes AWS (SNS y S3)

### Objetivo
Implementar los clientes para publicar eventos y acceder a S3.

### Tareas
1. **Cliente SNS**
   - `infrastructure/aws/sns-client.ts`
   - Implementar `SNSPublisher` interface
   - Método para publicar `MetricRunRequestEvent`
   - Soporte para topics FIFO y estándar
   - Manejo de errores y retries

2. **Cliente S3** (si es necesario para leer manifests)
   - `infrastructure/aws/s3-client.ts`
   - Métodos básicos de lectura
   - Implementar interface si se necesita

3. **Providers de AWS**
   - `interfaces/providers/aws.provider.ts`
   - Configurar clientes con credenciales

### Criterio de Éxito
- Cliente SNS puede publicar eventos
- Formato de eventos correcto según especificación
- Tests con mocks de AWS SDK pasan
- Manejo de errores implementado

---

## Fase 6: Servicios de Aplicación Base

### Objetivo
Implementar los servicios de aplicación que orquestan la lógica.

### Tareas
1. **DatasetUpdateService**
   - `application/services/dataset-update.service.ts`
   - Método: `persistUpdate(event: ProjectionUpdateEvent)`
   - Generar `event_key` para idempotencia
   - Persistir en `dataset_updates`

2. **MetricDependencyResolver**
   - `application/services/metric-dependency-resolver.service.ts`
   - Método: `findMetricsForDataset(datasetId: string)`
   - Método: `resolveRequiredDatasets(metricId: string)`
   - Lógica para resolver series → datasets

3. **PendingRunService**
   - `application/services/pending-run.service.ts`
   - Método: `updatePendingRunsForDataset(datasetId, updateId, updateCreatedAt)`
   - Método: `completePendingRun(runId: string)`
   - Validación de ventana de tiempo (`required_days`)
   - Verificación de completitud de dependencias

4. **MetricRunOrchestrator**
   - `application/services/metric-run-orchestrator.service.ts`
   - Método: `createRunForMetric(metric, currentDatasetId, currentUpdate, requiredDatasetIds)`
   - Decisión: run inmediato vs pendiente
   - Construcción de inputs y catálogo

5. **MetricRunEventEmitter**
   - `application/services/metric-run-event-emitter.service.ts`
   - Método: `emit(data: MetricRunEventData)`
   - Construcción de `MetricRunRequestEvent`
   - Publicación a SNS

### Criterio de Éxito
- Todos los servicios implementados
- Lógica de negocio correcta según especificación
- Tests unitarios de servicios pasan
- Integración entre servicios funciona

---

## Fase 7: Use Case Principal: OnProjectionUpdateUseCase

### Objetivo
Implementar el use case que orquesta todo el flujo de procesamiento de eventos.

### Tareas
1. **OnProjectionUpdateUseCase**
   - `application/use-cases/on-projection-update.use-case.ts`
   - Implementar flujo completo:
     1. Verificar idempotencia
     2. Persistir actualización
     3. Actualizar runs pendientes
     4. Buscar métricas dependientes
     5. Procesar cada métrica (inmediato vs pendiente)
     6. Emitir runs completados
   - Manejo de transacciones
   - Logging en puntos clave
   - Manejo de errores

2. **Validaciones**
   - Validar estructura del evento recibido
   - Validar que el dataset existe
   - Validar expresiones de métricas (opcional en esta fase)

### Criterio de Éxito
- Use case implementa todo el flujo documentado
- Transacciones funcionan correctamente
- Idempotencia verificada
- Tests end-to-end del flujo pasan
- Logging estructurado en puntos clave

---

## Fase 8: Consumidores de Colas SQS

### Objetivo
Implementar los consumidores que reciben eventos desde SQS.

### Tareas
1. **Consumidor de ProjectionUpdateEvent**
   - `interfaces/queue/projection-update.consumer.ts`
   - Consumir mensajes de SQS
   - Parsear JSON del evento
   - Llamar a `OnProjectionUpdateUseCase`
   - Manejo de errores y dead letter queue

2. **Consumidor de MetricRunStartedEvent**
   - `interfaces/queue/metric-run-started.consumer.ts`
   - Actualizar estado del run a "running"
   - Registrar `started_at`

3. **Consumidor de MetricRunHeartbeatEvent**
   - `interfaces/queue/metric-run-heartbeat.consumer.ts`
   - Actualizar `last_heartbeat_at`
   - Opcional: actualizar progreso

4. **Consumidor de MetricRunCompletedEvent**
   - `interfaces/queue/metric-run-completed.consumer.ts`
   - Actualizar estado a "succeeded" o "failed"
   - Registrar metadata (manifest, rowCount, error)

5. **Use Cases para eventos de feedback**
   - `application/use-cases/on-metric-run-started.use-case.ts`
   - `application/use-cases/on-metric-run-heartbeat.use-case.ts`
   - `application/use-cases/on-metric-run-completed.use-case.ts`

### Criterio de Éxito
- Todos los consumidores implementados
- Eventos se procesan correctamente
- Manejo de errores y reintentos
- Tests de consumidores con mocks de SQS pasan

---

## Fase 9: Módulos NestJS y Providers

### Objetivo
Configurar todos los módulos de NestJS y providers de inyección de dependencias.

### Tareas
1. **Módulo de Domain** (si es necesario)
   - Exportar constantes y tipos

2. **Módulo de Infrastructure**
   - `infrastructure/infrastructure.module.ts`
   - Configurar providers de:
     - Configuración
     - Logger
     - Cliente de DB
     - Repositorios
     - Clientes AWS

3. **Módulo de Application**
   - `application/application.module.ts`
   - Configurar providers de:
     - Servicios de aplicación
     - Use cases

4. **Módulo de Interfaces**
   - `interfaces/interfaces.module.ts`
   - Configurar:
     - Consumidores de colas
     - Controladores HTTP (si los hay)
   - Importar módulos de Application e Infrastructure

5. **Módulo principal (AppModule)**
   - `app.module.ts`
   - Importar todos los módulos
   - Configuración global

### Criterio de Éxito
- Todos los módulos configurados
- Inyección de dependencias funciona
- Aplicación inicia sin errores
- Todos los providers resueltos correctamente

---

## Fase 10: Controladores HTTP (Opcional)

### Objetivo
Implementar endpoints REST para consultas y administración.

### Tareas
1. **Controlador de Métricas**
   - `interfaces/http/metrics.controller.ts`
   - Endpoints: GET /metrics, GET /metrics/:code

2. **Controlador de Runs**
   - `interfaces/http/runs.controller.ts`
   - Endpoints: GET /runs/:id, GET /runs?status=...

3. **Controlador de Datasets**
   - `interfaces/http/datasets.controller.ts`
   - Endpoints: GET /datasets/:id

4. **Health check**
   - `interfaces/http/health.controller.ts`
   - Endpoint: GET /health

### Criterio de Éxito
- Endpoints funcionan correctamente
- Respuestas en formato JSON
- Validación de parámetros
- Tests de controladores pasan

---

## Fase 11: Validaciones y Reglas de Negocio

### Objetivo
Implementar validaciones de expresiones y reglas de negocio adicionales.

### Tareas
1. **Validador de expresiones**
   - `application/validation/expression.validator.ts`
   - Validar estructura de `ExpressionJson`
   - Validar según `expressionType`
   - Validar referencias a series existentes

2. **Validaciones de ventana de tiempo**
   - Mejorar lógica en `PendingRunService`
   - Validar que `required_days` es positivo
   - Validar timestamps

3. **Validaciones de estado de runs**
   - Validar transiciones de estado válidas
   - Prevenir cambios de estado inválidos

### Criterio de Éxito
- Validaciones implementadas
- Tests de validaciones pasan
- Errores descriptivos cuando fallan validaciones

---

## Fase 12: Testing Completo y Documentación

### Objetivo
Completar tests, documentación y preparar para producción.

### Tareas
1. **Tests unitarios**
   - Cobertura > 80% en servicios y use cases
   - Tests de todos los repositorios
   - Tests de mappers

2. **Tests de integración**
   - Tests end-to-end del flujo completo
   - Tests con base de datos real (test DB)
   - Tests de consumidores con mocks

3. **Tests de carga** (opcional)
   - Validar rendimiento con múltiples eventos

4. **Documentación**
   - README.md actualizado
   - Documentación de API (si hay controladores)
   - Guía de deployment
   - Variables de entorno documentadas

5. **Scripts de utilidad**
   - Script para crear datos de prueba
   - Script para limpiar base de datos de test

### Criterio de Éxito
- Cobertura de tests adecuada
- Todos los tests pasan
- Documentación completa
- Proyecto listo para deployment

---

## Orden de Implementación Recomendado

1. **Fase 0** → Configuración inicial
2. **Fase 1** → Infraestructura base
3. **Fase 2** → Base de datos
4. **Fase 3** → Entidades y puertos
5. **Fase 4** → Repositorios
6. **Fase 5** → Clientes AWS
7. **Fase 6** → Servicios de aplicación
8. **Fase 7** → Use case principal
9. **Fase 8** → Consumidores
10. **Fase 9** → Módulos NestJS
11. **Fase 10** → Controladores (opcional)
12. **Fase 11** → Validaciones
13. **Fase 12** → Testing y documentación

---

## Notas Importantes

- **Cada fase debe ser completada y validada antes de continuar**
- **Los tests deben escribirse junto con el código, no después**
- **Seguir estrictamente Clean Architecture y SOLID**
- **Mantener código simple y legible**
- **Logging estructurado en puntos clave**
- **Manejo de errores apropiado en cada capa**

---

## Puntos de Validación

Después de cada fase, validar:
- ✅ Código compila sin errores
- ✅ Tests pasan
- ✅ No hay dependencias circulares
- ✅ Principios SOLID respetados
- ✅ Separación de capas mantenida
- ✅ Logging implementado donde corresponde

