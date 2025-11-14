import { Provider } from '@nestjs/common';
import { DATABASE_CLIENT_TOKEN } from '@/infrastructure/db/database.client';
import { DatabaseClient } from '@/domain/interfaces/database-client.interface';
import {
  MetricRepository,
  SeriesRepository,
  DatasetRepository,
  DatasetUpdateRepository,
  MetricRunRepository,
  PendingDatasetRepository,
  EventLogRepository,
} from '@/domain/ports';
import {
  PostgresMetricRepository,
  PostgresSeriesRepository,
  PostgresDatasetRepository,
  PostgresDatasetUpdateRepository,
  PostgresMetricRunRepository,
  PostgresPendingDatasetRepository,
  PostgresEventLogRepository,
} from '@/infrastructure/db/repositories';

export const REPOSITORY_TOKENS = {
  METRIC: 'MetricRepository',
  SERIES: 'SeriesRepository',
  DATASET: 'DatasetRepository',
  DATASET_UPDATE: 'DatasetUpdateRepository',
  METRIC_RUN: 'MetricRunRepository',
  PENDING_DATASET: 'PendingDatasetRepository',
  EVENT_LOG: 'EventLogRepository',
} as const;

export const repositoriesProviders: Provider[] = [
  {
    provide: REPOSITORY_TOKENS.METRIC,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): MetricRepository => {
      return new PostgresMetricRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.SERIES,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): SeriesRepository => {
      return new PostgresSeriesRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.DATASET,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): DatasetRepository => {
      return new PostgresDatasetRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.DATASET_UPDATE,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): DatasetUpdateRepository => {
      return new PostgresDatasetUpdateRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.METRIC_RUN,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): MetricRunRepository => {
      return new PostgresMetricRunRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.PENDING_DATASET,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): PendingDatasetRepository => {
      return new PostgresPendingDatasetRepository(dbClient);
    },
  },
  {
    provide: REPOSITORY_TOKENS.EVENT_LOG,
    inject: [DATABASE_CLIENT_TOKEN],
    useFactory: (dbClient: DatabaseClient): EventLogRepository => {
      return new PostgresEventLogRepository(dbClient);
    },
  },
];

