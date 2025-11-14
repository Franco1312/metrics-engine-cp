# Plan de Implementación - Sistema de Orquestación de Métricas Reactivo

## Nota Importante sobre Testing

**Después de cada fase, se deben agregar tests:**
- **Tests unitarios**: Siempre que corresponda (mappers, servicios, use cases, etc.)
- **Tests e2e**: Solo cuando sea necesario (integración con servicios externos, flujos completos, etc.)

**Estructura de tests:**
```
carpeta/
  tests/
    unit/
      archivo.spec.ts
    e2e/          # Solo cuando corresponda
      archivo.e2e.spec.ts
```

**Patrón Builder para mocks:**
- Usar builders para crear mocks y evitar duplicación de código
- Los builders deben estar en `carpeta/tests/builders/`

---

## Fase 0: Setup Inicial ✅

### Objetivo
Configurar el proyecto base con NestJS y todas las dependencias necesarias.

### Tareas
- [x] Crear proyecto NestJS
- [x] Configurar TypeScript con modo estricto
- [x] Instalar dependencias (pg, pino, @aws-sdk/client-s3, @aws-sdk/client-sns)
- [x] Configurar estructura de carpetas según Clean Architecture
- [x] Configurar imports absolutos con `@/` prefix
- [x] Configurar Jest para reconocer paths absolutos

### Tests
- No aplica (setup inicial)

---

## Fase 1: Configuración e Infraestructura Base ✅

### Objetivo
Configurar la infraestructura básica: configuración, logger, y cliente de base de datos.

### Tareas
- [x] Crear `AppConfig` y función `loadConfig`
- [x] Implementar `Logger` interface y `MetricsLogger` con Pino
- [x] Crear interfaces de `DatabaseClient`, `TransactionClient`, `QueryClient`
- [x] Implementar `PostgresDatabaseClient` con soporte de transacciones
- [x] Crear providers de NestJS para config, logger y database

### Tests
- [ ] Tests unitarios para `MetricsLogger`
- [ ] Tests unitarios para `PostgresDatabaseClient` (mocks de pg)

---

## Fase 2: Migraciones de Base de Datos ✅

### Objetivo
Crear todas las tablas necesarias en PostgreSQL.

### Tareas
- [x] Crear migración `001_initial_schema.sql` con todas las tablas
- [x] Crear script de rollback `001_rollback.sql`
- [x] Documentar proceso de migración

### Tests
- No aplica (scripts SQL)

---

## Fase 3: Entidades y Puertos de Dominio ✅

### Objetivo
Definir todas las entidades de dominio, constantes, DTOs y puertos (interfaces de repositorios).

### Tareas
- [x] Crear constantes (`MetricRunStatus`, `ExpressionType`, `LOG_EVENTS`)
- [x] Crear entidades de dominio (Metric, Series, Dataset, DatasetUpdate, MetricRun, PendingDataset)
- [x] Crear DTOs de eventos (ProjectionUpdateEvent, MetricRunRequestEvent, etc.)
- [x] Crear interfaces de repositorios (ports)
- [x] Crear interfaces de servicios externos (SNS, S3)
- [x] Crear errores de dominio

### Tests
- [ ] Tests unitarios para validación de entidades (si hay lógica de validación)
- [ ] Tests unitarios para DTOs (validación de estructura)

---

## Fase 4: Mappers y Repositorios PostgreSQL ✅

### Objetivo
Implementar mappers y repositorios PostgreSQL para todas las entidades.

### Tareas
- [x] Crear mappers para convertir entre DB rows y entidades de dominio
- [x] Implementar repositorios PostgreSQL (Metric, Series, Dataset, DatasetUpdate, MetricRun, PendingDataset, EventLog)
- [x] Crear providers de repositorios para NestJS
- [x] Migrar todos los imports a absolutos

### Tests
- [x] Tests unitarios para todos los mappers
  - [x] MetricMapper
  - [x] DatasetUpdateMapper
  - [x] MetricRunMapper
  - [x] PendingDatasetMapper
- [x] Builders para mocks de rows de DB
- [ ] Tests unitarios para repositorios (mocks de DatabaseClient)

---

## Fase 5: Clientes AWS (SNS y S3)

### Objetivo
Implementar clientes para AWS SNS y S3.

### Tareas
- [ ] Implementar `SnsPublisher` que implementa `SnsPublisherInterface`
- [ ] Implementar `S3Client` que implementa `S3ClientInterface`
- [ ] Crear providers para SNS y S3

### Tests
- [ ] Tests unitarios para `SnsPublisher` (mocks de AWS SDK)
- [ ] Tests unitarios para `S3Client` (mocks de AWS SDK)

---

## Fase 6: Servicios de Dominio

### Objetivo
Implementar servicios de dominio con lógica de negocio pura.

### Tareas
- [ ] Crear servicios de dominio necesarios
- [ ] Implementar lógica de negocio sin dependencias externas

### Tests
- [ ] Tests unitarios para todos los servicios de dominio

---

## Fase 7: Servicios de Aplicación

### Objetivo
Implementar servicios de aplicación que orquestan la lógica de negocio.

### Tareas
- [ ] Implementar `DatasetUpdateService`
- [ ] Implementar `PendingRunService`
- [ ] Implementar `MetricDependencyResolver`
- [ ] Implementar `MetricRunOrchestrator`

### Tests
- [ ] Tests unitarios para todos los servicios de aplicación (mocks de repositorios)

---

## Fase 8: Use Cases

### Objetivo
Implementar los casos de uso principales.

### Tareas
- [ ] Implementar `OnProjectionUpdateUseCase`
- [ ] Implementar `OnMetricRunStartedUseCase`
- [ ] Implementar `OnMetricRunHeartbeatUseCase`
- [ ] Implementar `OnMetricRunCompletedUseCase`

### Tests
- [ ] Tests unitarios para todos los use cases (mocks de servicios y repositorios)
- [ ] Tests e2e para flujos completos (opcional, si es necesario)

---

## Fase 9: Validadores

### Objetivo
Implementar validadores de expresiones y métricas.

### Tareas
- [ ] Implementar validador de expresiones de métricas
- [ ] Implementar validación de ventanas de tiempo
- [ ] Implementar validación de dependencias

### Tests
- [ ] Tests unitarios para todos los validadores

---

## Fase 10: Consumidores de SQS

### Objetivo
Implementar consumidores de colas SQS para eventos de entrada.

### Tareas
- [ ] Implementar consumidor de `ProjectionUpdateEvent`
- [ ] Implementar consumidor de `MetricRunStartedEvent`
- [ ] Implementar consumidor de `MetricRunHeartbeatEvent`
- [ ] Implementar consumidor de `MetricRunCompletedEvent`
- [ ] Configurar manejo de errores y reintentos

### Tests
- [ ] Tests unitarios para consumidores (mocks de SQS y use cases)
- [ ] Tests e2e para consumo de eventos (opcional)

---

## Fase 11: Módulos NestJS

### Objetivo
Configurar módulos de NestJS para organizar la aplicación.

### Tareas
- [ ] Crear módulo de Database
- [ ] Crear módulo de AWS
- [ ] Crear módulo de Application
- [ ] Configurar módulo principal `AppModule`

### Tests
- [ ] Tests de integración para módulos (opcional)

---

## Fase 12: Controladores HTTP (Opcional)

### Objetivo
Implementar endpoints REST para administración y monitoreo.

### Tareas
- [ ] Crear controladores HTTP para métricas
- [ ] Crear controladores HTTP para runs
- [ ] Implementar validación de requests
- [ ] Documentar endpoints

### Tests
- [ ] Tests unitarios para controladores (mocks de use cases)
- [ ] Tests e2e para endpoints HTTP

---

## Notas Finales

- Cada fase debe completarse antes de pasar a la siguiente
- Los tests deben escribirse inmediatamente después de cada fase
- Usar builders para mocks y evitar duplicación de código
- Mantener la estructura de tests dentro de la carpeta correspondiente
- Seguir principios SOLID y Clean Architecture en todo momento

