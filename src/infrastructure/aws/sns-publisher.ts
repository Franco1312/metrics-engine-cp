import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SNSPublisher } from '@/domain/interfaces/sns-publisher.interface';
import { MetricRunRequestEvent } from '@/domain/dto/metric-run-request-event.dto';
import { Logger } from '@/domain/interfaces/logger.interface';
import { LOG_EVENTS } from '@/domain/constants/log-events';
import { AppConfig } from '@/infrastructure/config/app.config';

export class AwsSnsPublisher implements SNSPublisher {
  private readonly snsClient: SNSClient;
  private readonly topicArn: string;
  private readonly isFifo: boolean;

  constructor(
    config: AppConfig,
    private readonly logger: Logger,
  ) {
    this.snsClient = new SNSClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          }
        : undefined,
    });
    this.topicArn = config.sns.topicArn;
    this.isFifo = config.sns.isFifo;
  }

  async publishMetricRunRequest(event: MetricRunRequestEvent): Promise<void> {
    try {
      const messageBody = JSON.stringify(event);

      const command = new PublishCommand({
        TopicArn: this.topicArn,
        Message: messageBody,
        MessageGroupId: this.isFifo ? event.messageGroupId : undefined,
        MessageDeduplicationId: this.isFifo
          ? event.messageDeduplicationId
          : undefined,
      });

      const response = await this.snsClient.send(command);

      this.logger.info({
        event: LOG_EVENTS.SNS_MESSAGE_PUBLISHED,
        msg: 'Metric run request event published to SNS',
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
          messageId: response.MessageId,
        },
      });
    } catch (error) {
      this.logger.error({
        event: LOG_EVENTS.SNS_PUBLISH_ERROR,
        msg: 'Failed to publish metric run request to SNS',
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

export const SNS_PUBLISHER_TOKEN = 'SNS_PUBLISHER';

