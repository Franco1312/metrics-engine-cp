import { Message } from "@aws-sdk/client-sqs";
import { Consumer } from "sqs-consumer";
import { Logger } from "@/domain/interfaces/logger.interface";
import { AppConfig } from "@/infrastructure/config/app.config";

export interface SqsConsumerConfig {
  queueUrl: string;
  enabled: boolean;
  eventName: string;
}

export interface CreateSqsConsumerOptions<T> {
  config: AppConfig;
  sqsConfig: SqsConsumerConfig;
  parseMessage: (message: Message) => T;
  handler: (event: T) => Promise<void>;
  logger?: Logger;
}

/**
 * Crea un consumidor SQS genérico
 */
export function createSqsConsumer<T>(
  options: CreateSqsConsumerOptions<T>,
): Consumer {
  const { config, sqsConfig, parseMessage, handler, logger } = options;

  return Consumer.create({
    region: config.aws.region,
    queueUrl: sqsConfig.queueUrl,
    credentials:
      config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          }
        : undefined,
    suppressFifoWarning: true,
    batchSize: 10,
    handleMessageBatch: async (messages: Message[]) => {
      for (const message of messages) {
        try {
          const event = parseMessage(message);
          await handler(event);
        } catch (error) {
          logger?.error({
            event: `${sqsConfig.eventName}_ERROR`,
            msg: `${sqsConfig.eventName} message processed with errors`,
            data: { message: message?.Body },
            err: error,
          });
          throw error;
        }
      }
      return messages;
    },
  });
}

/**
 * Configura los event handlers para un consumidor SQS
 */
export function setupConsumerEventHandlers(
  consumer: Consumer,
  eventName: string,
  logger: Logger,
): void {
  consumer.on("error", (err: Error) => {
    logger.error({
      event: `${eventName}_ERROR`,
      msg: `Error while interacting with queue: ${err.message}`,
      err,
    });
  });

  consumer.on("processing_error", (err: Error) => {
    logger.error({
      event: `${eventName}_PROCESSING_ERROR`,
      msg: `Error while processing message: ${err.message}`,
      err,
    });
  });

  consumer.on("timeout_error", (err: Error) => {
    logger.error({
      event: `${eventName}_TIMEOUT_ERROR`,
      msg: `Handle message timed out: ${err.message}`,
      err,
    });
  });
}
