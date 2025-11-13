# Flujo de Procesamiento de Eventos de Actualización de Proyección

## Visión General

Este documento describe el flujo completo que se ejecuta cuando el sistema recibe un evento de actualización de proyección de un dataset. El sistema es reactivo y procesa métricas que dependen de múltiples datasets de manera asíncrona, esperando a que todos los datasets requeridos estén actualizados antes de ejecutar una métrica.

---

## Contratos de Comunicación Externa

### Eventos que Recibimos (Entrada)

El sistema recibe eventos de actualización de proyección desde sistemas externos (como el ingestor de datos) que notifican cuando un dataset ha sido actualizado.

#### Evento: `ProjectionUpdateEvent`

Este es el único evento que el sistema recibe como entrada para iniciar el procesamiento de métricas.

**Estructura:**
- `event`: Tipo de evento, siempre debe ser `"projection_update"`
- `dataset_id`: Identificador único del dataset que fue actualizado
- `bucket`: Nombre del bucket de almacenamiento donde están los archivos
- `version_manifest_path`: Ruta completa al archivo manifest que describe la versión del dataset
- `projections_path`: Ruta base donde se encuentran almacenadas las proyecciones del dataset

**Ejemplo:**
```json
{
  "event": "projection_update",
  "dataset_id": "sales_data_2024",
  "bucket": "ingestor-datasets",
  "version_manifest_path": "datasets/sales_data_2024/versions/v20240116_120000/manifest.json",
  "projections_path": "datasets/sales_data_2024/projections/"
}
```

**Descripción de Campos:**
- **`event`**: Identificador del tipo de evento. Permite al sistema enrutar correctamente el mensaje.
- **`dataset_id`**: Identificador único que permite al sistema saber qué dataset fue actualizado. Se usa para buscar métricas dependientes y actualizar runs pendientes.
- **`bucket`**: Indica en qué bucket de almacenamiento (S3, etc.) están los archivos. Puede ser útil para validaciones o acceso directo.
- **`version_manifest_path`**: Ruta completa al archivo manifest que contiene metadata sobre esta versión específica del dataset. El manifest describe qué series están disponibles, sus formatos, y otra información relevante.
- **`projections_path`**: Ruta base donde están almacenadas las proyecciones. Las proyecciones son los datos procesados y listos para ser consumidos por las métricas.

**Características:**
- Este evento debe ser idempotente: procesar el mismo evento múltiples veces no debe causar efectos secundarios
- El sistema valida la idempotencia usando una clave única basada en `dataset_id` y `version_manifest_path`
- Si el evento ya fue procesado, se omite silenciosamente

---

### Eventos que Publicamos (Salida)

El sistema publica eventos para solicitar la ejecución de métricas. Estos eventos son consumidos por el procesador de métricas (data plane).

#### Evento: `MetricRunRequestEvent`

Este evento se publica cuando el sistema determina que una métrica debe ejecutarse (ya sea inmediatamente o después de que todas las dependencias estén listas).

**Estructura:**
- `type`: Tipo de evento, siempre es `"metric_run_requested"`
- `runId`: Identificador único de esta ejecución de métrica
- `metricCode`: Código identificador de la métrica a ejecutar
- `expressionType`: Tipo de expresión de la métrica (`"series_math"`, `"window_op"`, o `"composite"`)
- `expressionJson`: Expresión completa de la métrica en formato JSON
- `inputs`: Lista de entradas que la métrica necesita (cada entrada especifica un dataset y una serie)
- `catalog`: Catálogo de datasets disponibles con sus rutas de manifest y proyecciones
- `output`: Configuración de salida que especifica dónde se almacenarán los resultados
- `messageGroupId`: (Opcional) Para colas FIFO, agrupa mensajes del mismo run
- `messageDeduplicationId`: (Opcional) Para colas FIFO, previene duplicados

**Ejemplo:**
```json
{
  "type": "metric_run_requested",
  "runId": "run-abc123",
  "metricCode": "revenue_cost_ratio",
  "expressionType": "series_math",
  "expressionJson": {
    "op": "ratio",
    "left": { "seriesCode": "total_revenue" },
    "right": { "seriesCode": "total_costs" },
    "scale": 1
  },
  "inputs": [
    { "datasetId": "financial_data", "seriesCode": "total_revenue" },
    { "datasetId": "financial_data", "seriesCode": "total_costs" }
  ],
  "catalog": {
    "datasets": {
      "financial_data": {
        "manifestPath": "datasets/financial_data/versions/v20240116_120000/manifest.json",
        "projectionsPath": "datasets/financial_data/projections/"
      }
    }
  },
  "output": {
    "basePath": "s3://metrics-bucket/metrics/revenue_cost_ratio/"
  },
  "messageGroupId": "run-abc123",
  "messageDeduplicationId": "run-abc123:metric_run_requested"
}
```

**Descripción de Campos:**

**`type`**: Identificador del tipo de evento. Permite al procesador de métricas saber qué hacer con el mensaje.

**`runId`**: Identificador único de esta ejecución específica. Se usa para:
- Rastrear el estado de la ejecución
- Correlacionar eventos relacionados (started, heartbeat, completed)
- Agrupar mensajes en colas FIFO

**`metricCode`**: Código identificador de la métrica. Es un identificador legible y único que permite identificar qué métrica se está ejecutando.

**`expressionType`**: Indica el tipo de expresión matemática que define la métrica:
- `"series_math"`: Operaciones matemáticas entre series (ratio, suma, resta, multiplicación)
- `"window_op"`: Operaciones de ventana sobre una serie (media móvil, suma acumulada, etc.)
- `"composite"`: Operaciones compuestas sobre múltiples series (suma, promedio, máximo, mínimo)

**`expressionJson`**: Contiene la expresión completa de la métrica en formato JSON. La estructura varía según el `expressionType`:

**Para `series_math`:**
- `op`: Operación (`"ratio"`, `"multiply"`, `"subtract"`, `"add"`)
- `left`: Operando izquierdo (puede ser una referencia a serie o otra expresión)
- `right`: Operando derecho (puede ser una referencia a serie o otra expresión)
- `scale`: (Opcional) Factor de escala numérico

**Para `window_op`:**
- `op`: Operación de ventana (`"sma"`, `"ema"`, `"sum"`, `"max"`, `"min"`, `"lag"`)
- `series`: Serie sobre la que se aplica la operación
- `window`: Tamaño de la ventana en períodos

**Para `composite`:**
- `op`: Operación compuesta (`"sum"`, `"avg"`, `"max"`, `"min"`)
- `operands`: Lista de referencias a series

**`inputs`**: Lista de entradas que la métrica necesita. Cada entrada especifica:
- `datasetId`: Identificador del dataset donde está la serie
- `seriesCode`: Código de la serie que se necesita

Esto permite al procesador saber exactamente qué datos debe cargar y de dónde.

**`catalog`**: Catálogo de todos los datasets disponibles para esta ejecución. Para cada dataset incluye:
- `manifestPath`: Ruta al archivo manifest que describe el dataset
- `projectionsPath`: Ruta base donde están las proyecciones del dataset

El catálogo permite al procesador:
- Validar que los datasets existen
- Cargar metadata de los datasets
- Acceder a las proyecciones necesarias

**`output`**: Configuración de dónde se almacenarán los resultados:
- `basePath`: Ruta base (típicamente en S3) donde se guardarán los resultados de la métrica

**`messageGroupId` y `messageDeduplicationId`**: Campos opcionales usados solo para colas FIFO:
- `messageGroupId`: Agrupa todos los mensajes relacionados con el mismo run
- `messageDeduplicationId`: Previene que se procesen mensajes duplicados

---

### Eventos que Recibimos de Vuelta (Feedback)

Después de publicar un `MetricRunRequestEvent`, el sistema recibe eventos de vuelta del procesador de métricas que indican el progreso y resultado de la ejecución.

#### Evento: `MetricRunStartedEvent`

Se recibe cuando el procesador de métricas comienza a ejecutar la métrica.

**Estructura:**
- `type`: Tipo de evento, siempre es `"metric_run_started"`
- `runId`: Identificador del run que comenzó
- `startedAt`: (Opcional) Timestamp ISO de cuando comenzó la ejecución

**Propósito:**
- Actualizar el estado del run de "dispatched" a "running"
- Registrar el momento de inicio para métricas de tiempo de ejecución

---

#### Evento: `MetricRunHeartbeatEvent`

Se recibe periódicamente durante la ejecución para indicar que la métrica sigue ejecutándose.

**Estructura:**
- `type`: Tipo de evento, siempre es `"metric_run_heartbeat"`
- `runId`: Identificador del run que está ejecutándose
- `progress`: (Opcional) Porcentaje de progreso (0-100)
- `ts`: Timestamp ISO del heartbeat

**Propósito:**
- Mantener el run "vivo" para detectar timeouts
- Proporcionar información de progreso si está disponible
- Actualizar el último timestamp de actividad del run

---

#### Evento: `MetricRunCompletedEvent`

Se recibe cuando la ejecución de la métrica termina (exitosa o con error).

**Estructura:**
- `type`: Tipo de evento, siempre es `"metric_run_completed"`
- `runId`: Identificador del run que completó
- `metricCode`: Código de la métrica ejecutada
- `status`: Estado de finalización (`"SUCCESS"` o `"FAILURE"`)
- `versionTs`: (Opcional) Timestamp de versión de los resultados
- `outputManifest`: (Opcional) Ruta al manifest de salida con metadata de los resultados
- `rowCount`: (Opcional) Número de filas generadas en el resultado
- `error`: (Opcional) Mensaje de error si el status es `"FAILURE"`

**Propósito:**
- Actualizar el estado del run a "succeeded" o "failed"
- Registrar metadata de los resultados (manifest, cantidad de filas)
- Registrar errores si la ejecución falló
- Cerrar el ciclo de vida del run

**Ejemplo de éxito:**
```json
{
  "type": "metric_run_completed",
  "runId": "run-abc123",
  "metricCode": "revenue_cost_ratio",
  "status": "SUCCESS",
  "versionTs": "2024-01-16T12:00:00Z",
  "outputManifest": "s3://metrics-bucket/metrics/revenue_cost_ratio/v20240116_120000/manifest.json",
  "rowCount": 365
}
```

**Ejemplo de fallo:**
```json
{
  "type": "metric_run_completed",
  "runId": "run-abc123",
  "metricCode": "revenue_cost_ratio",
  "status": "FAILURE",
  "error": "Series 'total_costs' not found in dataset 'financial_data'"
}
```

---

## Flujo de Comunicación Completo

1. **Sistema externo** → Publica `ProjectionUpdateEvent` → **Control Plane**
2. **Control Plane** → Procesa el evento y determina métricas a ejecutar
3. **Control Plane** → Publica `MetricRunRequestEvent` → **Data Plane (Procesador de Métricas)**
4. **Data Plane** → Publica `MetricRunStartedEvent` → **Control Plane**
5. **Data Plane** → Publica `MetricRunHeartbeatEvent` (periódicamente) → **Control Plane**
6. **Data Plane** → Publica `MetricRunCompletedEvent` → **Control Plane**

Este flujo permite que el Control Plane mantenga un estado actualizado de todas las ejecuciones de métricas y pueda tomar decisiones basadas en el progreso y resultados.

---

## 1. Recepción del Evento

Cuando llega un evento de actualización de proyección, el sistema recibe la siguiente información:

- **Identificador del dataset**: Identifica qué dataset fue actualizado
- **Ruta del manifest de versión**: Ubicación del archivo manifest que describe la versión
- **Ruta de proyecciones**: Ubicación donde se encuentran las proyecciones del dataset
- **Bucket de almacenamiento**: Bucket donde están almacenados los archivos
- **Timestamp del evento**: Momento en que se generó la actualización

---

## 2. Verificación de Idempotencia

Antes de procesar cualquier cosa, el sistema verifica si este evento ya fue procesado anteriormente. Esto previene procesamiento duplicado en caso de reintentos o mensajes duplicados.

**Proceso:**
1. Se genera una clave única para el evento basada en el dataset y la ruta del manifest
2. Se intenta insertar esta clave en el registro de eventos procesados dentro de una transacción de base de datos
3. Si la clave ya existe, el evento se marca como duplicado y se omite todo el procesamiento
4. Si la clave no existe, se continúa con el procesamiento y la transacción se mantiene abierta

**Resultado:**
- Si es duplicado: El flujo termina aquí, no se procesa nada más
- Si es nuevo: Se continúa con el siguiente paso dentro de la misma transacción

---

## 3. Persistencia de la Actualización del Dataset

El sistema registra esta actualización en la base de datos para mantener un historial y permitir consultas futuras.

**Información almacenada:**
- Identificador único del registro de actualización
- Identificador del dataset actualizado
- Ruta del manifest de versión
- Ruta de proyecciones
- Bucket de almacenamiento
- Clave del evento (para idempotencia)
- Timestamp de creación

**Propósito:**
- Mantener un historial de todas las actualizaciones
- Permitir consultas sobre actualizaciones recientes
- Facilitar la construcción de catálogos para métricas que requieren múltiples datasets

---

## 4. Actualización de Runs Pendientes

El sistema busca si hay métricas que estaban esperando esta actualización específica del dataset para poder ejecutarse.

### 4.1. Búsqueda de Runs Pendientes

Se consultan todos los runs de métricas que tienen estado "pendiente de dependencias" y que están esperando este dataset específico.

### 4.2. Validación de Ventana de Tiempo

Para cada run pendiente encontrado, el sistema verifica si la actualización recibida es válida según la ventana de tiempo requerida:

- Cada run pendiente tiene configurado un número de días mínimo requerido
- Se calcula si la fecha de creación de la actualización está dentro de la ventana válida
- Si la actualización es muy antigua (fuera de la ventana), se omite para ese run específico
- Si la actualización es válida, se procede a marcarla como recibida

**Ejemplo:**
- Si un run requiere datos de los últimos 7 días
- Y la actualización tiene 10 días de antigüedad
- Esa actualización se considera inválida para ese run

### 4.3. Marcado de Dependencia como Recibida

Para cada run pendiente con una actualización válida:

1. Se marca la dependencia de ese dataset como "recibida"
2. Se registra el identificador de la actualización recibida
3. Se guarda el timestamp de cuando se recibió

### 4.4. Verificación de Completitud

Después de marcar una dependencia como recibida, el sistema verifica si todas las dependencias del run ya fueron recibidas:

- Se cuenta cuántas dependencias aún están pendientes
- Si el contador llega a cero, significa que todas las dependencias están listas
- Si aún hay dependencias pendientes, el run continúa esperando

### 4.5. Activación de Run Completo

Cuando todas las dependencias de un run están listas:

1. El estado del run cambia de "pendiente de dependencias" a "en cola"
2. Se procede a construir el evento de solicitud de ejecución de métrica
3. Se emite el evento para que la métrica sea procesada

---

## 5. Búsqueda de Métricas Dependientes

El sistema identifica qué métricas podrían necesitar ejecutarse como resultado de esta actualización.

### 5.1. Identificación de Series del Dataset

Primero, se consultan todas las series que pertenecen al dataset que fue actualizado. Esto se hace consultando la relación entre datasets y series.

### 5.2. Búsqueda de Métricas que Dependen de Esas Series

Para cada serie encontrada, se buscan todas las métricas que tienen esa serie como dependencia. Esto se hace consultando la tabla de dependencias de métricas.

### 5.3. Agrupación y Carga de Métricas

- Se agrupan las métricas encontradas (puede haber duplicados si una métrica depende de múltiples series del mismo dataset)
- Se cargan los detalles completos de cada métrica única encontrada

---

## 6. Procesamiento de Cada Métrica Encontrada

Para cada métrica que depende de series del dataset actualizado, el sistema determina si puede ejecutarse inmediatamente o si necesita esperar más actualizaciones.

### 6.1. Resolución de Datasets Requeridos

Para cada métrica:

1. Se consultan todas las dependencias de la métrica (qué series necesita)
2. Para cada serie, se consulta en qué datasets está disponible
3. Se obtiene la lista única de todos los datasets que la métrica necesita

**Ejemplo:**
- Métrica A depende de las series: Serie1, Serie2, Serie3
- Serie1 está en Dataset1
- Serie2 está en Dataset1 y Dataset2
- Serie3 está en Dataset2
- La métrica A requiere: Dataset1 y Dataset2

### 6.2. Decisión: Run Inmediato vs Run Pendiente

El sistema compara los datasets requeridos con el dataset que acaba de actualizarse:

**Caso 1: Run Inmediato**
- Si la métrica solo requiere un dataset
- Y ese dataset es exactamente el que acaba de actualizarse
- Entonces se puede ejecutar inmediatamente

**Caso 2: Run Pendiente**
- Si la métrica requiere múltiples datasets
- O si requiere un dataset diferente al actualizado
- Entonces se crea un run pendiente que esperará todas las dependencias

---

## 7. Creación de Run Inmediato

Cuando una métrica puede ejecutarse inmediatamente:

### 7.1. Creación del Registro de Run

Se crea un registro de ejecución de métrica con:
- Identificador único del run
- Identificador de la métrica
- Código de la métrica
- Estado inicial: "en cola"

### 7.2. Construcción del Evento de Solicitud

Se construye un evento que contiene toda la información necesaria para ejecutar la métrica:

**Inputs (Entradas):**
- Para cada serie que la métrica necesita, se especifica:
  - El dataset donde está la serie
  - El código de la serie

**Catálogo:**
- Se incluye información sobre el dataset actualizado:
  - Ruta del manifest de versión
  - Ruta de proyecciones

**Salida:**
- Se especifica la ruta base donde se almacenarán los resultados de la métrica

**Metadatos:**
- Código de la métrica
- Tipo de expresión
- Expresión JSON completa

### 7.3. Emisión del Evento

El evento se publica en el sistema de mensajería para que el procesador de métricas lo tome y ejecute.

### 7.4. Actualización de Estado

El estado del run se actualiza a "despachado", indicando que el evento fue enviado exitosamente.

### 7.5. Manejo de Errores

Si algo falla durante la construcción o emisión del evento:
- El run se marca como "fallido"
- Se registra el mensaje de error
- Se registra el timestamp del fallo

---

## 8. Creación de Run Pendiente

Cuando una métrica requiere múltiples datasets o un dataset diferente:

### 8.1. Creación del Registro de Run

Se crea un registro de ejecución de métrica con:
- Identificador único del run
- Identificador de la métrica
- Código de la métrica
- Estado inicial: "pendiente de dependencias"

### 8.2. Consulta de Actualizaciones Existentes

Para cada dataset requerido, se consulta si existe una actualización reciente válida:
- Se obtiene la última actualización de cada dataset
- Se verifica si está dentro de la ventana de tiempo requerida

### 8.3. Creación de Registros de Dependencias Pendientes

Para cada dataset requerido, se crea un registro que indica:

- El run al que pertenece
- El dataset que se está esperando
- El número de días mínimo requerido (ventana de tiempo)
- Si ya fue recibido (inicialmente falso, excepto para el dataset actual)
- El identificador de la actualización recibida (si aplica)
- El timestamp de cuando se recibió (si aplica)

**Lógica especial para el dataset actual:**
- Si el dataset que acaba de actualizarse está en la lista de requeridos
- Y su actualización es válida según la ventana de tiempo
- Entonces ese dataset se marca como "recibido" inmediatamente
- Se registra el identificador de la actualización recibida

### 8.4. Verificación Inmediata de Completitud

Después de crear todos los registros de dependencias:

- Se cuenta cuántas dependencias aún están pendientes
- Si todas las dependencias ya están recibidas (contador = 0):
  - Se procede inmediatamente a emitir el run
  - No es necesario esperar más eventos
- Si aún hay dependencias pendientes:
  - El run queda esperando
  - Se registra cuántas dependencias faltan

---

## 9. Emisión de Run Pendiente Completado

Cuando todas las dependencias de un run pendiente están listas (ya sea inmediatamente o después de recibir eventos adicionales):

### 9.1. Verificación del Estado

Se verifica que el run aún esté en estado "pendiente de dependencias" (por si acaso fue procesado por otro flujo).

### 9.2. Carga de Información de la Métrica

Se carga la información completa de la métrica asociada al run.

### 9.3. Obtención de Actualizaciones Recibidas

Para cada dependencia marcada como recibida:
- Se obtiene el identificador de la actualización recibida
- Se cargan los detalles completos de cada actualización

### 9.4. Construcción del Catálogo

Se construye un catálogo que incluye información de todos los datasets recibidos:
- Para cada dataset, se incluye:
  - Ruta del manifest de versión
  - Ruta de proyecciones

### 9.5. Construcción de Inputs

Para cada serie que la métrica necesita:
- Se consulta en qué datasets está disponible esa serie
- Se selecciona el dataset que está en el catálogo (el que tiene actualización válida)
- Se crea un input con el dataset y el código de la serie

### 9.6. Cambio de Estado

El estado del run cambia de "pendiente de dependencias" a "en cola".

### 9.7. Construcción y Emisión del Evento

Se construye el evento de solicitud de ejecución de métrica con:
- Todos los inputs construidos
- El catálogo completo
- La información de la métrica
- La ruta de salida

El evento se publica en el sistema de mensajería.

### 9.8. Actualización Final

- El run se marca como "despachado"
- Los registros de dependencias pendientes se eliminan (opcional, pueden mantenerse para auditoría)

### 9.9. Manejo de Errores

Si algo falla durante el proceso:
- El run se marca como "fallido"
- Se registra el error
- Los registros de dependencias se mantienen para diagnóstico

---

## 10. Finalización de la Transacción

Al finalizar todos los pasos anteriores:

1. Si todo fue exitoso:
   - Se marca el evento como "procesado" en el registro de eventos
   - Se confirma la transacción de base de datos
   - Todos los cambios se hacen permanentes

2. Si hubo algún error:
   - Se revierte toda la transacción
   - No se registra el evento como procesado
   - El evento puede ser reintentado desde la cola de mensajes
   - No quedan datos inconsistentes en la base de datos

---

## Esquemas de Base de Datos Relevantes

### Tabla: `dataset_updates`
Almacena cada actualización de un dataset.

**Campos principales:**
- `id`: Identificador único de la actualización
- `dataset_id`: Identificador del dataset actualizado
- `version_manifest_path`: Ruta del manifest de versión
- `projections_path`: Ruta de proyecciones
- `bucket`: Bucket de almacenamiento
- `event_key`: Clave única para idempotencia
- `created_at`: Timestamp de creación

### Tabla: `metric_runs`
Almacena las ejecuciones de métricas.

**Campos principales:**
- `id`: Identificador único del run
- `metric_id`: Identificador de la métrica
- `metric_code`: Código de la métrica (denormalizado)
- `status`: Estado del run (pendiente_dependencies, queued, dispatched, running, succeeded, failed, etc.)
- `requested_at`: Timestamp de cuando se solicitó
- `started_at`: Timestamp de cuando comenzó
- `finished_at`: Timestamp de cuando terminó

### Tabla: `metric_run_pending_datasets`
Almacena las dependencias pendientes de cada run.

**Campos principales:**
- `run_id`: Identificador del run
- `dataset_id`: Identificador del dataset que se está esperando
- `required_days`: Ventana de tiempo mínima requerida (en días)
- `received_update_id`: Identificador de la actualización recibida (si aplica)
- `received`: Indica si ya fue recibido
- `received_at`: Timestamp de cuando se recibió (si aplica)
- `created_at`: Timestamp de creación

### Tabla: `metric_dependencies`
Almacena las dependencias de cada métrica (qué series necesita).

**Campos principales:**
- `metric_id`: Identificador de la métrica
- `series_code`: Código de la serie que la métrica necesita

### Tabla: `dataset_series`
Relaciona datasets con sus series.

**Campos principales:**
- `dataset_id`: Identificador del dataset
- `series_code`: Código de la serie

### Tabla: `event_log`
Registro de eventos procesados para idempotencia.

**Campos principales:**
- `event_key`: Clave única del evento
- `event_type`: Tipo de evento
- `processed_at`: Timestamp de cuando se procesó exitosamente

---

## Flujo de Estados de un Run

1. **Pendiente de Dependencias** → El run está esperando que lleguen actualizaciones de todos los datasets requeridos
2. **En Cola** → Todas las dependencias están listas, el run está listo para ser procesado
3. **Despachado** → El evento de solicitud fue enviado al procesador de métricas
4. **Ejecutando** → El procesador está ejecutando la métrica
5. **Completado** → La métrica se ejecutó exitosamente
6. **Fallido** → Ocurrió un error durante la ejecución

---

## Consideraciones Importantes

### Ventana de Tiempo
- Cada run pendiente puede tener una ventana de tiempo diferente
- Esto permite que algunas métricas requieran datos más recientes que otras
- Las actualizaciones fuera de la ventana se consideran inválidas para ese run específico

### Idempotencia
- Todo el proceso está envuelto en una transacción de base de datos
- Si algo falla, todo se revierte
- El evento puede ser reintentado sin causar duplicados
- La clave de idempotencia previene procesamiento duplicado

### Reactividad
- El sistema no usa schedulers o polling
- Cada evento de actualización dispara inmediatamente la verificación de dependencias
- Los runs se activan tan pronto como todas sus dependencias están listas

### Escalabilidad
- Cada dataset puede tener múltiples series
- Cada serie puede estar en múltiples datasets
- Cada métrica puede depender de múltiples series
- Cada serie puede estar en múltiples datasets
- El sistema maneja estas relaciones complejas de manera eficiente

---

## Ejemplo de Flujo Completo

**Escenario:** Una métrica que calcula el ratio entre dos series que están en datasets diferentes.

1. Llega actualización del Dataset A
2. Se persiste la actualización
3. Se busca si hay runs pendientes esperando Dataset A (no hay)
4. Se buscan métricas que dependen de series de Dataset A
5. Se encuentra la métrica del ratio
6. Se resuelve que la métrica necesita Dataset A y Dataset B
7. Se crea un run pendiente con dos dependencias:
   - Dataset A: marcado como recibido (acaba de llegar)
   - Dataset B: marcado como pendiente
8. El run queda esperando Dataset B
9. Llega actualización del Dataset B
10. Se persiste la actualización
11. Se busca si hay runs pendientes esperando Dataset B
12. Se encuentra el run de la métrica del ratio
13. Se valida que la actualización de Dataset B es válida
14. Se marca Dataset B como recibido
15. Se verifica que todas las dependencias están listas (sí, ambas)
16. Se cambia el estado del run a "en cola"
17. Se construye el evento con inputs de ambos datasets
18. Se construye el catálogo con ambos datasets
19. Se emite el evento de solicitud de ejecución
20. El run se marca como "despachado"
21. La métrica se ejecuta con datos de ambos datasets

---

## Conclusión

Este flujo permite que el sistema maneje de manera reactiva y eficiente métricas que dependen de múltiples datasets, asegurando que solo se ejecuten cuando todos los datos necesarios están disponibles y son válidos según las ventanas de tiempo requeridas.

