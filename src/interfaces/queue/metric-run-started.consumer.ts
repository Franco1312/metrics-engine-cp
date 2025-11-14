import { Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunStartedUseCase } from "@/application/use-cases/on-metric-run-started.use-case";
import { MetricRunStartedEvent } from "@/domain/dto/metric-run-started-event.dto";
import {
  createSqsConsumer,
  setupConsumerEventHandlers,
  SqsConsumerConfig,
} from "./sqs-consumer.helper";
import { LOG_EVENTS } from "@/domain/constants/log-events";

/**
 * Parsea un mensaje SQS a MetricRunStartedEvent
 */
function parseMetricRunStartedMessage(message: Message): MetricRunStartedEvent {
  if (!message.Body) {
    throw new Error("Message body is empty");
  }

  try {
    const body = JSON.parse(message.Body);

    // Si el mensaje viene de SNS, el evento está en body.Message
    const eventData = body.Message ? JSON.parse(body.Message) : body;

    if (eventData.type !== "metric_run_started") {
      throw new Error(
        `Invalid event type: expected 'metric_run_started', got '${eventData.type}'`,
      );
    }

    if (!eventData.runId) {
      throw new Error("Missing required field: runId");
    }

    return {
      type: "metric_run_started",
      runId: eventData.runId,
      startedAt: eventData.startedAt,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in message body: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Crea el consumidor de MetricRunStartedEvent
 */
export function createMetricRunStartedConsumer(
  config: AppConfig,
  useCase: OnMetricRunStartedUseCase,
  logger: Logger,
): Consumer {
  const sqsConfig: SqsConsumerConfig = {
    queueUrl: config.sqs.metricRunStartedQueueUrl,
    enabled: !!config.sqs.metricRunStartedQueueUrl,
    eventName: "METRIC_RUN_STARTED",
  };

  const consumer = createSqsConsumer<MetricRunStartedEvent>({
    config,
    sqsConfig,
    parseMessage: parseMetricRunStartedMessage,
    handler: async (event: MetricRunStartedEvent) => {
      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_RECEIVED,
        msg: "Processing metric run started event",
        data: {
          runId: event.runId,
        },
      });

      await useCase.execute(event);

      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_PROCESSED,
        msg: "Metric run started event processed successfully",
        data: {
          runId: event.runId,
        },
      });
    },
    logger,
  });

  setupConsumerEventHandlers(consumer, sqsConfig.eventName, logger);

  return consumer;
}
