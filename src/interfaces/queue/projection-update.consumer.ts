import { Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
import { ProjectionUpdateEvent } from "@/domain/dto/projection-update-event.dto";
import {
  createSqsConsumer,
  setupConsumerEventHandlers,
  SqsConsumerConfig,
} from "./sqs-consumer.helper";
import { LOG_EVENTS } from "@/domain/constants/log-events";

/**
 * Parsea un mensaje SQS a ProjectionUpdateEvent
 */
function parseProjectionUpdateMessage(message: Message): ProjectionUpdateEvent {
  if (!message.Body) {
    throw new Error("Message body is empty");
  }

  try {
    const body = JSON.parse(message.Body);

    // Si el mensaje viene de SNS, el evento está en body.Message
    const eventData = body.Message ? JSON.parse(body.Message) : body;

    if (eventData.event !== "projection_update") {
      throw new Error(
        `Invalid event type: expected 'projection_update', got '${eventData.event}'`,
      );
    }

    if (!eventData.dataset_id) {
      throw new Error("Missing required field: dataset_id");
    }

    if (!eventData.version_manifest_path) {
      throw new Error("Missing required field: version_manifest_path");
    }

    if (!eventData.projections_path) {
      throw new Error("Missing required field: projections_path");
    }

    return {
      event: "projection_update",
      dataset_id: eventData.dataset_id,
      bucket: eventData.bucket || "",
      version_manifest_path: eventData.version_manifest_path,
      projections_path: eventData.projections_path,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in message body: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Crea el consumidor de ProjectionUpdateEvent
 */
export function createProjectionUpdateConsumer(
  config: AppConfig,
  useCase: OnProjectionUpdateUseCase,
  logger: Logger,
): Consumer {
  const sqsConfig: SqsConsumerConfig = {
    queueUrl: config.sqs.projectionUpdate.queueUrl,
    enabled: config.sqs.projectionUpdate.enabled,
    eventName: "PROJECTION_UPDATE",
  };

  const consumer = createSqsConsumer<ProjectionUpdateEvent>({
    config,
    sqsConfig,
    parseMessage: parseProjectionUpdateMessage,
    handler: async (event: ProjectionUpdateEvent) => {
      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_RECEIVED,
        msg: "Processing projection update event",
        data: {
          datasetId: event.dataset_id,
          bucket: event.bucket,
        },
      });

      await useCase.execute(event);

      logger.info({
        event: LOG_EVENTS.SQS_MESSAGE_PROCESSED,
        msg: "Projection update event processed successfully",
        data: {
          datasetId: event.dataset_id,
        },
      });
    },
    logger,
  });

  setupConsumerEventHandlers(consumer, sqsConfig.eventName, logger);

  return consumer;
}
