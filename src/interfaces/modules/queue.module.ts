import { Module, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";
import type { AppConfig } from "@/infrastructure/config/app.config";
import type { Logger } from "@/domain/interfaces/logger.interface";
import { Consumer } from "sqs-consumer";
import { CONFIG_TOKEN } from "@/infrastructure/config/app.config";
import { LOGGER_TOKEN } from "@/interfaces/providers/logger.provider";
import { USE_CASE_TOKENS } from "@/interfaces/providers/application.provider";
import type { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
import type { OnMetricRunStartedUseCase } from "@/application/use-cases/on-metric-run-started.use-case";
import type { OnMetricRunHeartbeatUseCase } from "@/application/use-cases/on-metric-run-heartbeat.use-case";
import type { OnMetricRunCompletedUseCase } from "@/application/use-cases/on-metric-run-completed.use-case";
import { createProjectionUpdateConsumer } from "@/interfaces/queue/projection-update.consumer";
import { createMetricRunStartedConsumer } from "@/interfaces/queue/metric-run-started.consumer";
import { createMetricRunHeartbeatConsumer } from "@/interfaces/queue/metric-run-heartbeat.consumer";
import { createMetricRunCompletedConsumer } from "@/interfaces/queue/metric-run-completed.consumer";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { ApplicationModule } from "./application.module";

@Module({
  imports: [ApplicationModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private consumers: Consumer[] = [];

  constructor(
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
    @Inject(LOGGER_TOKEN) private readonly logger: Logger,
    @Inject(USE_CASE_TOKENS.ON_PROJECTION_UPDATE)
    private readonly onProjectionUpdateUseCase: OnProjectionUpdateUseCase,
    @Inject(USE_CASE_TOKENS.ON_METRIC_RUN_STARTED)
    private readonly onMetricRunStartedUseCase: OnMetricRunStartedUseCase,
    @Inject(USE_CASE_TOKENS.ON_METRIC_RUN_HEARTBEAT)
    private readonly onMetricRunHeartbeatUseCase: OnMetricRunHeartbeatUseCase,
    @Inject(USE_CASE_TOKENS.ON_METRIC_RUN_COMPLETED)
    private readonly onMetricRunCompletedUseCase: OnMetricRunCompletedUseCase,
  ) {}

  onModuleInit() {
    this.logger.info({
      event: LOG_EVENTS.SQS_CONSUMERS_INITIALIZING,
      msg: "Initializing SQS consumers",
    });

    // Inicializar ProjectionUpdate consumer
    if (this.config.sqs.projectionUpdate.enabled) {
      try {
        const consumer = createProjectionUpdateConsumer(
          this.config,
          this.onProjectionUpdateUseCase,
          this.logger,
        );
        consumer.start();
        this.consumers.push(consumer);
        this.logger.info({
          event: LOG_EVENTS.SQS_CONSUMER_STARTED,
          msg: "ProjectionUpdate consumer started",
          data: {
            queueUrl: this.config.sqs.projectionUpdate.queueUrl,
          },
        });
      } catch (error) {
        this.logger.error({
          event: LOG_EVENTS.SQS_CONSUMER_ERROR,
          msg: "Failed to start ProjectionUpdate consumer",
          err: error,
        });
      }
    } else {
      this.logger.info({
        event: LOG_EVENTS.SQS_CONSUMER_STARTED,
        msg: "ProjectionUpdate consumer disabled",
      });
    }

    // Inicializar MetricRunStarted consumer
    if (this.config.sqs.metricRunStarted.enabled) {
      try {
        const consumer = createMetricRunStartedConsumer(
          this.config,
          this.onMetricRunStartedUseCase,
          this.logger,
        );
        consumer.start();
        this.consumers.push(consumer);
        this.logger.info({
          event: LOG_EVENTS.SQS_CONSUMER_STARTED,
          msg: "MetricRunStarted consumer started",
          data: {
            queueUrl: this.config.sqs.metricRunStarted.queueUrl,
          },
        });
      } catch (error) {
        this.logger.error({
          event: LOG_EVENTS.SQS_CONSUMER_ERROR,
          msg: "Failed to start MetricRunStarted consumer",
          err: error,
        });
      }
    } else {
      this.logger.info({
        event: LOG_EVENTS.SQS_CONSUMER_STARTED,
        msg: "MetricRunStarted consumer disabled",
      });
    }

    // Inicializar MetricRunHeartbeat consumer
    if (this.config.sqs.metricRunHeartbeat.enabled) {
      try {
        const consumer = createMetricRunHeartbeatConsumer(
          this.config,
          this.onMetricRunHeartbeatUseCase,
          this.logger,
        );
        consumer.start();
        this.consumers.push(consumer);
        this.logger.info({
          event: LOG_EVENTS.SQS_CONSUMER_STARTED,
          msg: "MetricRunHeartbeat consumer started",
          data: {
            queueUrl: this.config.sqs.metricRunHeartbeat.queueUrl,
          },
        });
      } catch (error) {
        this.logger.error({
          event: LOG_EVENTS.SQS_CONSUMER_ERROR,
          msg: "Failed to start MetricRunHeartbeat consumer",
          err: error,
        });
      }
    } else {
      this.logger.info({
        event: LOG_EVENTS.SQS_CONSUMER_STARTED,
        msg: "MetricRunHeartbeat consumer disabled",
      });
    }

    // Inicializar MetricRunCompleted consumer
    if (this.config.sqs.metricRunCompleted.enabled) {
      try {
        const consumer = createMetricRunCompletedConsumer(
          this.config,
          this.onMetricRunCompletedUseCase,
          this.logger,
        );
        consumer.start();
        this.consumers.push(consumer);
        this.logger.info({
          event: LOG_EVENTS.SQS_CONSUMER_STARTED,
          msg: "MetricRunCompleted consumer started",
          data: {
            queueUrl: this.config.sqs.metricRunCompleted.queueUrl,
          },
        });
      } catch (error) {
        this.logger.error({
          event: LOG_EVENTS.SQS_CONSUMER_ERROR,
          msg: "Failed to start MetricRunCompleted consumer",
          err: error,
        });
      }
    } else {
      this.logger.info({
        event: LOG_EVENTS.SQS_CONSUMER_STARTED,
        msg: "MetricRunCompleted consumer disabled",
      });
    }

    this.logger.info({
      event: LOG_EVENTS.SQS_CONSUMERS_INITIALIZED,
      msg: "SQS consumers initialization completed",
      data: {
        activeConsumers: this.consumers.length,
      },
    });
  }

  onModuleDestroy() {
    this.logger.info({
      event: LOG_EVENTS.SQS_CONSUMERS_STOPPING,
      msg: "Stopping SQS consumers",
      data: {
        activeConsumers: this.consumers.length,
      },
    });

    for (const consumer of this.consumers) {
      try {
        consumer.stop();
      } catch (error) {
        this.logger.error({
          event: LOG_EVENTS.SQS_CONSUMER_ERROR,
          msg: "Error stopping consumer",
          err: error,
        });
      }
    }

    this.logger.info({
      event: LOG_EVENTS.SQS_CONSUMERS_STOPPED,
      msg: "All SQS consumers stopped",
    });
  }
}
