# Migraciones de Base de Datos

Este directorio contiene los scripts de migración para la base de datos del sistema de orquestación de métricas.

## Estructura

- `001_initial_schema.sql` - Script de migración inicial que crea todas las tablas, índices y constraints
- `001_rollback.sql` - Script de rollback que elimina todas las tablas (usar con precaución)

## Aplicar Migraciones

### Usando psql

```bash
# Aplicar migración
psql -U postgres -d metrics_engine -f migrations/001_initial_schema.sql

# Rollback (CUIDADO: elimina todos los datos)
psql -U postgres -d metrics_engine -f migrations/001_rollback.sql
```

### Usando variables de entorno

```bash
# Configurar variables de entorno
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=metrics_engine
export PGUSER=postgres
export PGPASSWORD=postgres

# Aplicar migración
psql -f migrations/001_initial_schema.sql
```

## Esquema de Base de Datos

El esquema incluye las siguientes tablas:

1. **metrics** - Definiciones de métricas
2. **series** - Catálogo de series disponibles
3. **datasets** - Catálogo de datasets
4. **dataset_series** - Relación many-to-many entre datasets y series
5. **metric_dependencies** - Dependencias de métricas (qué series necesita cada métrica)
6. **dataset_updates** - Actualizaciones de datasets (tabla central para sistema reactivo)
7. **metric_runs** - Ejecuciones de métricas
8. **metric_run_pending_datasets** - Dependencias pendientes de cada run
9. **run_dataset_updates** - Trazabilidad de actualizaciones usadas en cada run
10. **event_log** - Registro de eventos procesados para idempotencia

## Notas

- Todas las tablas usan `TIMESTAMP WITH TIME ZONE` para manejo correcto de zonas horarias
- Los IDs se generan usando `gen_random_uuid()::text` (PostgreSQL 13+)
- Las foreign keys tienen `ON DELETE CASCADE` para mantener integridad referencial
- Los índices están optimizados para las consultas más frecuentes del sistema

## Validación

Después de aplicar la migración, puedes validar que todas las tablas se crearon correctamente:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

