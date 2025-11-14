import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SNSPublisher } from "@/domain/interfaces/sns-publisher.interface";
import { MetricRunRequestEvent } from "@/domain/dto/metric-run-request-event.dto";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";
import { AppConfig } from "@/infrastructure/config/app.config";

export class AwsSnsPublisher implements SNSPublisher {
  private readonly snsClient: SNSClient;
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor(config: AppConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.snsClient = new SNSClient({
      region: config.aws.region,
      credentials:
        config.aws.accessKeyId && config.aws.secretAccessKey
          ? {
              accessKeyId: config.aws.accessKeyId,
              secretAccessKey: config.aws.secretAccessKey,
            }
          : undefined,
    });
  }

  async publishMetricRunRequest(event: MetricRunRequestEvent): Promise<void> {
    const snsConfig = this.config.sns.metricRunRequest;

    if (!snsConfig.enabled) {
      this.logger.info({
        event: LOG_EVENTS.SNS_MESSAGE_PUBLISHED,
        msg: "SNS publishing is disabled for metricRunRequest, skipping",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
        },
      });
      return;
    }

    try {
      const snsClient =
        snsConfig.region !== this.config.aws.region
          ? new SNSClient({
              region: snsConfig.region,
              credentials:
                this.config.aws.accessKeyId && this.config.aws.secretAccessKey
                  ? {
                      accessKeyId: this.config.aws.accessKeyId,
                      secretAccessKey: this.config.aws.secretAccessKey,
                    }
                  : undefined,
            })
          : this.snsClient;

      const messageBody = JSON.stringify(event);

      const command = new PublishCommand({
        TopicArn: snsConfig.topic,
        Message: messageBody,
        MessageGroupId: event.messageGroupId,
        MessageDeduplicationId: event.messageDeduplicationId,
      });

      const response = await snsClient.send(command);

      this.logger.info({
        event: LOG_EVENTS.SNS_MESSAGE_PUBLISHED,
        msg: "Metric run request event published to SNS",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
          messageId: response.MessageId,
        },
      });
    } catch (error) {
      this.logger.error({
        event: LOG_EVENTS.SNS_PUBLISH_ERROR,
        msg: "Failed to publish metric run request to SNS",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
        },
        err: error,
      });
      throw error;
    }
  }
}

export const SNS_PUBLISHER_TOKEN = "SNS_PUBLISHER";
