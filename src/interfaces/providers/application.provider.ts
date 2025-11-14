import { Provider } from "@nestjs/common";
import { DATABASE_CLIENT_TOKEN } from "@/infrastructure/db/database.client";
import { LOGGER_TOKEN } from "./logger.provider";
import { REPOSITORY_TOKENS } from "./repositories.provider";
import { EventLogRepository } from "@/domain/ports/event-log.repository";
import { SNS_PUBLISHER_TOKEN } from "@/infrastructure/aws/sns-publisher";
import { DatabaseClient } from "@/domain/interfaces/database-client.interface";
import { Logger } from "@/domain/interfaces/logger.interface";
import { MetricRepository } from "@/domain/ports/metric.repository";
import { SeriesRepository } from "@/domain/ports/series.repository";
import { DatasetRepository } from "@/domain/ports/dataset.repository";
import { DatasetUpdateRepository } from "@/domain/ports/dataset-update.repository";
import { MetricRunRepository } from "@/domain/ports/metric-run.repository";
import { PendingDatasetRepository } from "@/domain/ports/pending-dataset.repository";
import { SNSPublisher } from "@/domain/interfaces/sns-publisher.interface";
import { DatasetUpdateService } from "@/application/services/dataset-update.service";
import { PendingRunService } from "@/application/services/pending-run.service";
import { MetricDependencyResolverService } from "@/application/services/metric-dependency-resolver.service";
import { MetricRunOrchestratorService } from "@/application/services/metric-run-orchestrator.service";
import { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
import { OnMetricRunStartedUseCase } from "@/application/use-cases/on-metric-run-started.use-case";
import { OnMetricRunHeartbeatUseCase } from "@/application/use-cases/on-metric-run-heartbeat.use-case";
import { OnMetricRunCompletedUseCase } from "@/application/use-cases/on-metric-run-completed.use-case";

export const APPLICATION_SERVICE_TOKENS = {
  DATASET_UPDATE: "DatasetUpdateService",
  PENDING_RUN: "PendingRunService",
  METRIC_DEPENDENCY_RESOLVER: "MetricDependencyResolverService",
  METRIC_RUN_ORCHESTRATOR: "MetricRunOrchestratorService",
} as const;

export const USE_CASE_TOKENS = {
  ON_PROJECTION_UPDATE: "OnProjectionUpdateUseCase",
  ON_METRIC_RUN_STARTED: "OnMetricRunStartedUseCase",
  ON_METRIC_RUN_HEARTBEAT: "OnMetricRunHeartbeatUseCase",
  ON_METRIC_RUN_COMPLETED: "OnMetricRunCompletedUseCase",
} as const;

export const applicationServiceProviders: Provider[] = [
  {
    provide: APPLICATION_SERVICE_TOKENS.DATASET_UPDATE,
    inject: [REPOSITORY_TOKENS.DATASET_UPDATE, LOGGER_TOKEN],
    useFactory: (
      datasetUpdateRepository: DatasetUpdateRepository,
      logger: Logger,
    ): DatasetUpdateService => {
      return new DatasetUpdateService(datasetUpdateRepository, logger);
    },
  },
  {
    provide: APPLICATION_SERVICE_TOKENS.PENDING_RUN,
    inject: [
      REPOSITORY_TOKENS.PENDING_DATASET,
      REPOSITORY_TOKENS.METRIC_RUN,
      LOGGER_TOKEN,
    ],
    useFactory: (
      pendingDatasetRepository: PendingDatasetRepository,
      metricRunRepository: MetricRunRepository,
      logger: Logger,
    ): PendingRunService => {
      return new PendingRunService(
        pendingDatasetRepository,
        metricRunRepository,
        logger,
      );
    },
  },
  {
    provide: APPLICATION_SERVICE_TOKENS.METRIC_DEPENDENCY_RESOLVER,
    inject: [
      REPOSITORY_TOKENS.METRIC,
      REPOSITORY_TOKENS.SERIES,
      REPOSITORY_TOKENS.DATASET,
      LOGGER_TOKEN,
    ],
    useFactory: (
      metricRepository: MetricRepository,
      seriesRepository: SeriesRepository,
      datasetRepository: DatasetRepository,
      logger: Logger,
    ): MetricDependencyResolverService => {
      return new MetricDependencyResolverService(
        metricRepository,
        seriesRepository,
        datasetRepository,
        logger,
      );
    },
  },
  {
    provide: APPLICATION_SERVICE_TOKENS.METRIC_RUN_ORCHESTRATOR,
    inject: [
      REPOSITORY_TOKENS.METRIC_RUN,
      REPOSITORY_TOKENS.METRIC,
      REPOSITORY_TOKENS.PENDING_DATASET,
      REPOSITORY_TOKENS.DATASET_UPDATE,
      REPOSITORY_TOKENS.SERIES,
      REPOSITORY_TOKENS.DATASET,
      SNS_PUBLISHER_TOKEN,
      LOGGER_TOKEN,
    ],
    useFactory: (
      metricRunRepository: MetricRunRepository,
      metricRepository: MetricRepository,
      pendingDatasetRepository: PendingDatasetRepository,
      datasetUpdateRepository: DatasetUpdateRepository,
      seriesRepository: SeriesRepository,
      datasetRepository: DatasetRepository,
      snsPublisher: SNSPublisher,
      logger: Logger,
    ): MetricRunOrchestratorService => {
      return new MetricRunOrchestratorService(
        metricRunRepository,
        metricRepository,
        pendingDatasetRepository,
        datasetUpdateRepository,
        seriesRepository,
        datasetRepository,
        snsPublisher,
        logger,
      );
    },
  },
];

export const useCaseProviders: Provider[] = [
  {
    provide: USE_CASE_TOKENS.ON_PROJECTION_UPDATE,
    inject: [
      APPLICATION_SERVICE_TOKENS.DATASET_UPDATE,
      APPLICATION_SERVICE_TOKENS.METRIC_DEPENDENCY_RESOLVER,
      APPLICATION_SERVICE_TOKENS.METRIC_RUN_ORCHESTRATOR,
      APPLICATION_SERVICE_TOKENS.PENDING_RUN,
      REPOSITORY_TOKENS.EVENT_LOG,
      DATABASE_CLIENT_TOKEN,
      LOGGER_TOKEN,
    ],
    useFactory: (
      datasetUpdateService: DatasetUpdateService,
      metricDependencyResolverService: MetricDependencyResolverService,
      metricRunOrchestratorService: MetricRunOrchestratorService,
      pendingRunService: PendingRunService,
      eventLogRepository: EventLogRepository,
      databaseClient: DatabaseClient,
      logger: Logger,
    ): OnProjectionUpdateUseCase => {
      return new OnProjectionUpdateUseCase(
        datasetUpdateService,
        metricDependencyResolverService,
        metricRunOrchestratorService,
        pendingRunService,
        eventLogRepository,
        databaseClient,
        logger,
      );
    },
  },
  {
    provide: USE_CASE_TOKENS.ON_METRIC_RUN_STARTED,
    inject: [REPOSITORY_TOKENS.METRIC_RUN, DATABASE_CLIENT_TOKEN, LOGGER_TOKEN],
    useFactory: (
      metricRunRepository: MetricRunRepository,
      databaseClient: DatabaseClient,
      logger: Logger,
    ): OnMetricRunStartedUseCase => {
      return new OnMetricRunStartedUseCase(
        metricRunRepository,
        databaseClient,
        logger,
      );
    },
  },
  {
    provide: USE_CASE_TOKENS.ON_METRIC_RUN_HEARTBEAT,
    inject: [REPOSITORY_TOKENS.METRIC_RUN, DATABASE_CLIENT_TOKEN, LOGGER_TOKEN],
    useFactory: (
      metricRunRepository: MetricRunRepository,
      databaseClient: DatabaseClient,
      logger: Logger,
    ): OnMetricRunHeartbeatUseCase => {
      return new OnMetricRunHeartbeatUseCase(
        metricRunRepository,
        databaseClient,
        logger,
      );
    },
  },
  {
    provide: USE_CASE_TOKENS.ON_METRIC_RUN_COMPLETED,
    inject: [REPOSITORY_TOKENS.METRIC_RUN, DATABASE_CLIENT_TOKEN, LOGGER_TOKEN],
    useFactory: (
      metricRunRepository: MetricRunRepository,
      databaseClient: DatabaseClient,
      logger: Logger,
    ): OnMetricRunCompletedUseCase => {
      return new OnMetricRunCompletedUseCase(
        metricRunRepository,
        databaseClient,
        logger,
      );
    },
  },
];
