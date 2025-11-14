import { Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunHeartbeatUseCase } from "@/application/use-cases/on-metric-run-heartbeat.use-case";
import { MetricRunHeartbeatEvent } from "@/domain/dto/metric-run-heartbeat-event.dto";
import {
  createSqsConsumer,
  setupConsumerEventHandlers,
  SqsConsumerConfig,
} from "./sqs-consumer.helper";
import { LOG_EVENTS } from "@/domain/constants/log-events";

/**
 * Parsea un mensaje SQS a MetricRunHeartbeatEvent
 */
function parseMetricRunHeartbeatMessage(
  message: Message,
): MetricRunHeartbeatEvent {
  if (!message.Body) {
    throw new Error("Message body is empty");
  }

  try {
    const body = JSON.parse(message.Body);

    // Si el mensaje viene de SNS, el evento está en body.Message
    const eventData = body.Message ? JSON.parse(body.Message) : body;

    if (eventData.type !== "metric_run_heartbeat") {
      throw new Error(
        `Invalid event type: expected 'metric_run_heartbeat', got '${eventData.type}'`,
      );
    }

    if (!eventData.runId) {
      throw new Error("Missing required field: runId");
    }

    if (!eventData.ts) {
      throw new Error("Missing required field: ts");
    }

    return {
      type: "metric_run_heartbeat",
      runId: eventData.runId,
      progress: eventData.progress,
      ts: eventData.ts,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in message body: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Crea el consumidor de MetricRunHeartbeatEvent
 */
export function createMetricRunHeartbeatConsumer(
  config: AppConfig,
  useCase: OnMetricRunHeartbeatUseCase,
  logger: Logger,
): Consumer {
  const sqsConfig: SqsConsumerConfig = {
    queueUrl: config.sqs.metricRunHeartbeatQueueUrl,
    enabled: !!config.sqs.metricRunHeartbeatQueueUrl,
    eventName: "METRIC_RUN_HEARTBEAT",
  };

  const consumer = createSqsConsumer<MetricRunHeartbeatEvent>({
    config,
    sqsConfig,
    parseMessage: parseMetricRunHeartbeatMessage,
    handler: async (event: MetricRunHeartbeatEvent) => {
      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_RECEIVED,
        msg: "Processing metric run heartbeat event",
        data: {
          runId: event.runId,
          progress: event.progress,
        },
      });

      await useCase.execute(event);

      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_PROCESSED,
        msg: "Metric run heartbeat event processed successfully",
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
