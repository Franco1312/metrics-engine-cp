import { Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunCompletedUseCase } from "@/application/use-cases/on-metric-run-completed.use-case";
import { MetricRunCompletedEvent } from "@/domain/dto/metric-run-completed-event.dto";
import {
  createSqsConsumer,
  setupConsumerEventHandlers,
  SqsConsumerConfig,
} from "./sqs-consumer.helper";
import { LOG_EVENTS } from "@/domain/constants/log-events";

/**
 * Parsea un mensaje SQS a MetricRunCompletedEvent
 */
function parseMetricRunCompletedMessage(
  message: Message,
): MetricRunCompletedEvent {
  if (!message.Body) {
    throw new Error("Message body is empty");
  }

  try {
    const body = JSON.parse(message.Body);

    // Si el mensaje viene de SNS, el evento está en body.Message
    const eventData = body.Message ? JSON.parse(body.Message) : body;

    if (eventData.type !== "metric_run_completed") {
      throw new Error(
        `Invalid event type: expected 'metric_run_completed', got '${eventData.type}'`,
      );
    }

    if (!eventData.runId) {
      throw new Error("Missing required field: runId");
    }

    if (!eventData.metricCode) {
      throw new Error("Missing required field: metricCode");
    }

    if (!eventData.status) {
      throw new Error("Missing required field: status");
    }

    if (eventData.status !== "SUCCESS" && eventData.status !== "FAILURE") {
      throw new Error(
        `Invalid status: expected 'SUCCESS' or 'FAILURE', got '${eventData.status}'`,
      );
    }

    return {
      type: "metric_run_completed",
      runId: eventData.runId,
      metricCode: eventData.metricCode,
      status: eventData.status,
      versionTs: eventData.versionTs,
      outputManifest: eventData.outputManifest,
      rowCount: eventData.rowCount,
      error: eventData.error,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in message body: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Crea el consumidor de MetricRunCompletedEvent
 */
export function createMetricRunCompletedConsumer(
  config: AppConfig,
  useCase: OnMetricRunCompletedUseCase,
  logger: Logger,
): Consumer {
  const sqsConfig: SqsConsumerConfig = {
    queueUrl: config.sqs.metricRunCompletedQueueUrl,
    enabled: !!config.sqs.metricRunCompletedQueueUrl,
    eventName: "METRIC_RUN_COMPLETED",
  };

  const consumer = createSqsConsumer<MetricRunCompletedEvent>({
    config,
    sqsConfig,
    parseMessage: parseMetricRunCompletedMessage,
    handler: async (event: MetricRunCompletedEvent) => {
      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_RECEIVED,
        msg: "Processing metric run completed event",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
          status: event.status,
        },
      });

      await useCase.execute(event);

      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_PROCESSED,
        msg: "Metric run completed event processed successfully",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
        },
      });
    },
    logger,
  });

  setupConsumerEventHandlers(consumer, sqsConfig.eventName, logger);

  return consumer;
}
