# Metrics Engine Control Plane

Sistema de orquestación de métricas reactivo basado en Clean Architecture, diseñado para gestionar la ejecución de métricas basadas en actualizaciones de datasets.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [Testing](#testing)
- [Base de Datos](#base-de-datos)
- [Diseño de Base de Datos](./docs/database-design.md)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Scripts Disponibles](#scripts-disponibles)

## 🎯 Descripción

El Metrics Engine Control Plane es un sistema que orquesta la ejecución de métricas cuando se actualizan los datasets de los que dependen. El sistema:

- Escucha eventos de actualización de proyecciones desde SQS
- Identifica métricas que dependen de los datasets actualizados
- Crea runs de métricas pendientes o listos para ejecutarse
- Gestiona dependencias entre datasets y métricas
- Publica eventos SNS para ejecutar métricas cuando todas las dependencias están listas
- Rastrea el estado de ejecución de métricas (started, heartbeat, completed)

## 🏗️ Arquitectura

El proyecto sigue los principios de **Clean Architecture**, organizando el código en capas bien definidas:

```
src/
├── domain/              # Capa de dominio (entidades, interfaces, servicios de dominio)
│   ├── entities/        # Entidades de negocio
│   ├── dto/            # Data Transfer Objects
│   ├── ports/          # Interfaces (repositorios, servicios externos)
│   ├── services/       # Servicios de dominio (lógica pura de negocio)
│   └── constants/      # Constantes del dominio
├── application/         # Capa de aplicación (casos de uso, servicios de aplicación)
│   ├── use-cases/      # Casos de uso
│   ├── services/       # Servicios de aplicación (orquestación)
│   └── validation/    # Validadores
├── infrastructure/      # Capa de infraestructura (implementaciones concretas)
│   ├── db/            # Base de datos (repositorios, mappers, cliente)
│   ├── aws/           # Clientes AWS (S3, SNS)
│   └── config/        # Configuración
└── interfaces/         # Capa de interfaces (adaptadores externos)
    ├── queue/         # Consumers SQS
    ├── modules/       # Módulos NestJS
    └── providers/     # Providers NestJS
```

### Principios de Diseño

- **Separación de responsabilidades**: Cada capa tiene una responsabilidad clara
- **Inversión de dependencias**: Las capas internas no dependen de las externas
- **Testabilidad**: Cada componente es fácilmente testeable de forma aislada
- **Transacciones**: Operaciones críticas se ejecutan dentro de transacciones de base de datos

## 🛠️ Tecnologías

- **NestJS**: Framework para aplicaciones Node.js
- **TypeScript**: Lenguaje de programación
- **PostgreSQL**: Base de datos relacional
- **AWS SDK v3**: Clientes para S3, SNS, SQS
- **sqs-consumer**: Biblioteca para consumir mensajes de SQS
- **pg**: Driver de PostgreSQL
- **Pino**: Logger estructurado
- **Jest**: Framework de testing
- **Docker Compose**: Para base de datos de pruebas

## 📁 Estructura del Proyecto

```
metrics-engine-cp/
├── src/
│   ├── domain/                    # Capa de dominio
│   ├── application/               # Capa de aplicación
│   ├── infrastructure/            # Capa de infraestructura
│   ├── interfaces/                # Capa de interfaces
│   └── app.module.ts              # Módulo principal de NestJS
├── migrations/                    # Migraciones de base de datos
│   └── 001_initial_schema.sql
├── test/                          # Configuración de tests e2e
│   ├── helpers/                   # Helpers para tests
│   └── setup-e2e.ts               # Setup global para e2e
├── docker-compose.test.yml        # Docker Compose para tests
├── package.json
├── tsconfig.json
└── README.md
```

## 📦 Requisitos

- Node.js >= 18.x
- PostgreSQL >= 14
- Docker y Docker Compose (para tests e2e)
- npm o yarn

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd metrics-engine-cp

# Instalar dependencias
npm install

# Configurar variables de entorno (ver sección Configuración)
cp .env.example .env
```

## ⚙️ Configuración

El proyecto utiliza variables de entorno para la configuración. Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=metrics_engine
DB_USER=postgres
DB_PASSWORD=postgres

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# SNS
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:metric-run-requests
SNS_TOPIC_IS_FIFO=false

# SQS - Projection Update
SQS_PROJECTION_UPDATE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/projection-update
SQS_PROJECTION_UPDATE_ENABLED=true

# SQS - Metric Run Started
SQS_METRIC_RUN_STARTED_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/metric-run-started
SQS_METRIC_RUN_STARTED_ENABLED=true

# SQS - Metric Run Heartbeat
SQS_METRIC_RUN_HEARTBEAT_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/metric-run-heartbeat
SQS_METRIC_RUN_HEARTBEAT_ENABLED=true

# SQS - Metric Run Completed
SQS_METRIC_RUN_COMPLETED_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/metric-run-completed
SQS_METRIC_RUN_COMPLETED_ENABLED=true

# S3
S3_BUCKET=my-metrics-bucket

# Aplicación
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### Configuración de Consumers

Cada consumer de SQS puede habilitarse o deshabilitarse individualmente usando las variables `SQS_*_ENABLED`:
- `SQS_PROJECTION_UPDATE_ENABLED=true` - Habilita el consumer de actualizaciones de proyección
- `SQS_METRIC_RUN_STARTED_ENABLED=true` - Habilita el consumer de inicio de ejecución
- `SQS_METRIC_RUN_HEARTBEAT_ENABLED=true` - Habilita el consumer de heartbeat
- `SQS_METRIC_RUN_COMPLETED_ENABLED=true` - Habilita el consumer de finalización

## 🏃 Ejecución

### Desarrollo

```bash
npm run start:dev
```

### Producción

```bash
# Compilar
npm run build

# Ejecutar
npm run start:prod
```

### Debug

```bash
npm run start:debug
```

## 🧪 Testing

### Tests Unitarios

```bash
# Ejecutar todos los tests unitarios
npm test

# Ejecutar en modo watch
npm run test:watch

# Con coverage
npm run test:cov
```

### Tests E2E

Los tests e2e requieren una base de datos PostgreSQL. El proyecto incluye Docker Compose para facilitar esto:

```bash
# Opción 1: Setup manual
npm run test:e2e:setup    # Levanta la DB de prueba
npm run test:e2e          # Ejecuta los tests
npm run test:e2e:teardown # Detiene la DB

# Opción 2: Todo en uno
npm run test:e2e:full     # Setup + tests + teardown
```

Los tests e2e se ejecutan contra una base de datos PostgreSQL real en Docker, usando el puerto `5433` para evitar conflictos con una base de datos local.

### Estructura de Tests

```
src/
├── [component]/
│   ├── tests/
│   │   ├── unit/              # Tests unitarios
│   │   │   └── *.spec.ts
│   │   ├── e2e/               # Tests e2e (cuando corresponda)
│   │   │   └── *.e2e-spec.ts
│   │   └── builders/          # Builders para mocks
│   │       └── *.builder.ts
```

## 🗄️ Base de Datos

Para una documentación completa del diseño de la base de datos, incluyendo todas las tablas, campos, relaciones y flujos de datos, consulta el **[Diseño de Base de Datos](./docs/database-design.md)**.

### Esquema General

El sistema utiliza las siguientes tablas principales:

- **Catálogo**: `metrics`, `series`, `datasets`
- **Dependencias**: `metric_dependencies`, `dataset_series`
- **Ejecución**: `metric_runs`, `metric_run_pending_datasets`, `dataset_updates`
- **Trazabilidad**: `run_dataset_updates`, `event_log`

### Migraciones

Las migraciones se encuentran en `migrations/`:

- `001_initial_schema.sql`: Schema inicial con todas las tablas
- `002_insert_bcra_infomondia_dataset.sql`: Dataset inicial BCRA
- `003_insert_bcra_metrics.sql`: Métricas iniciales BCRA
- `004_clean_and_seed.sql`: Script de limpieza y re-seed

### Aplicar Migraciones

```bash
# Usando el script de migración
npm run migrate:up

# Limpiar y re-seed la base de datos
npm run migrate:clean-seed
```

## 🔄 Flujo de Trabajo

### 1. Actualización de Proyección

1. Se recibe un evento `ProjectionUpdateEvent` desde SQS
2. El sistema persiste la actualización del dataset (con idempotencia)
3. Identifica métricas que dependen del dataset actualizado
4. Para cada métrica:
   - Resuelve todos los datasets requeridos
   - Crea un run pendiente con sus dependencias
   - Si todas las dependencias están listas, emite el run inmediatamente
   - Si faltan dependencias, marca el run como pendiente

### 2. Ejecución de Métrica

1. El sistema publica un evento SNS con la solicitud de ejecución
2. El worker de métricas procesa la ejecución
3. El worker envía eventos de progreso:
   - `MetricRunStartedEvent`: Cuando inicia la ejecución
   - `MetricRunHeartbeatEvent`: Heartbeats periódicos
   - `MetricRunCompletedEvent`: Cuando finaliza (éxito o error)

### 3. Seguimiento de Estado

El sistema actualiza el estado de los runs según los eventos recibidos:
- `RUNNING`: Cuando se recibe `MetricRunStartedEvent`
- `SUCCEEDED`/`FAILED`: Cuando se recibe `MetricRunCompletedEvent`
- `lastHeartbeatAt`: Se actualiza con cada `MetricRunHeartbeatEvent`

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run start              # Inicia la aplicación
npm run start:dev          # Inicia en modo desarrollo (watch)
npm run start:debug       # Inicia en modo debug
npm run start:prod        # Inicia en modo producción

# Build
npm run build             # Compila TypeScript

# Testing
npm test                  # Tests unitarios
npm run test:watch        # Tests en modo watch
npm run test:cov          # Tests con coverage
npm run test:e2e          # Tests e2e
npm run test:e2e:setup    # Levanta DB de prueba
npm run test:e2e:teardown # Detiene DB de prueba
npm run test:e2e:full     # Setup + tests + teardown

# Code Quality
npm run lint              # Ejecuta ESLint
npm run format            # Formatea código con Prettier
```

## 🔐 Pre-commit Hooks

El proyecto incluye pre-commit hooks configurados con Husky y lint-staged que:
- Ejecutan ESLint en archivos modificados
- Formatean código con Prettier
- Previenen commits con código que no cumple los estándares

## 📊 Logging

El sistema utiliza logging estructurado con Pino. Los logs incluyen:
- **Eventos**: Identificadores de eventos para facilitar el filtrado
- **Mensajes**: Descripciones legibles
- **Datos**: Información contextual relevante
- **Errores**: Stack traces cuando aplica

### Niveles de Log

Configurable mediante `LOG_LEVEL`:
- `error`: Solo errores
- `warn`: Advertencias y errores
- `info`: Información, advertencias y errores (recomendado)
- `debug`: Todo incluyendo información de debug

## 🏛️ Arquitectura de Datos

### Tipos de Expresiones de Métricas

El sistema soporta tres tipos de expresiones:

1. **series_math**: Operaciones matemáticas entre series
   - Operaciones: `ratio`, `multiply`, `subtract`, `add`
   - Soporta expresiones anidadas

2. **window_op**: Operaciones de ventana sobre series
   - Operaciones: `sma`, `ema`, `sum`, `max`, `min`, `lag`
   - Requiere parámetro `window`

3. **composite**: Operaciones sobre múltiples series
   - Operaciones: `sum`, `avg`, `max`, `min`
   - Requiere array de `operands`

### Estados de Ejecución

- `PENDING_DEPENDENCIES`: Esperando que lleguen todas las dependencias
- `QUEUED`: Listo para ejecutarse, evento publicado
- `RUNNING`: En ejecución
- `SUCCEEDED`: Completado exitosamente
- `FAILED`: Falló durante la ejecución

## 🔧 Desarrollo

### Imports Absolutos

El proyecto utiliza imports absolutos con el prefijo `@/`:

```typescript
import { Metric } from "@/domain/entities/metric.entity";
import { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
```

### Builders para Tests

Los tests utilizan builders para crear mocks de forma consistente:

```typescript
const metric = new MetricBuilder()
  .withId("metric-1")
  .withCode("test_metric")
  .withSeriesMathExpression(SERIES_MATH_OPS.RATIO)
  .build();
```

### Transacciones

Las operaciones críticas se ejecutan dentro de transacciones:

```typescript
await databaseClient.transaction(async (client) => {
  // Operaciones atómicas
});
```

## 📝 Contribución

1. Crear una rama desde `master`
2. Realizar cambios siguiendo los principios de Clean Architecture
3. Agregar tests (unitarios y e2e cuando corresponda)
4. Asegurar que todos los tests pasen
5. Ejecutar linter y formatter
6. Crear Pull Request

## 📄 Licencia

UNLICENSED
