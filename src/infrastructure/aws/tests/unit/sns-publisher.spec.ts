import { AwsSnsPublisher } from "../../sns-publisher";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { AppConfigBuilder } from "../builders/app-config.builder";
import { MetricRunRequestEventBuilder } from "../builders/metric-run-request-event.builder";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";

// Mock AWS SDK
jest.mock("@aws-sdk/client-sns");

describe("AwsSnsPublisher", () => {
  let publisher: AwsSnsPublisher;
  let mockLogger: jest.Mocked<Logger>;
  let mockSnsClient: {
    send: jest.Mock<Promise<{ MessageId?: string }>, [command: PublishCommand]>;
  };
  let config: ReturnType<AppConfigBuilder["build"]>;
  let publishCommandInstances: Array<{ input: any }>;

  beforeEach(() => {
    publishCommandInstances = [];

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    mockSnsClient = {
      send: jest.fn<
        Promise<{ MessageId?: string }>,
        [command: PublishCommand]
      >(),
    };

    // Mock SNSClient constructor
    (SNSClient as jest.MockedClass<typeof SNSClient>).mockImplementation(
      () => mockSnsClient as unknown as SNSClient,
    );

    (
      PublishCommand as jest.MockedClass<typeof PublishCommand>
    ).mockImplementation((input: any) => {
      const instance = { input } as PublishCommand;
      publishCommandInstances.push(instance);
      return instance;
    });

    config = new AppConfigBuilder().build();
    publisher = new AwsSnsPublisher(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    publishCommandInstances = [];
  });

  describe("publishMetricRunRequest", () => {
    it("should publish event to SNS successfully", async () => {
      const event = new MetricRunRequestEventBuilder().build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await publisher.publishMetricRunRequest(event);

      expect(mockSnsClient.send).toHaveBeenCalledTimes(1);

      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.SNS_MESSAGE_PUBLISHED,
        msg: "Metric run request event published to SNS",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
          messageId: mockResponse.MessageId,
        },
      });
    });

    it("should include MessageGroupId and MessageDeduplicationId when event has them", async () => {
      const fifoConfig = new AppConfigBuilder()
        .withSnsTopicArn("arn:aws:sns:us-east-1:123456789012:test-topic.fifo")
        .build();
      const fifoPublisher = new AwsSnsPublisher(fifoConfig, mockLogger);

      const event = new MetricRunRequestEventBuilder()
        .asFifo("group-123", "dedup-123")
        .build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await fifoPublisher.publishMetricRunRequest(event);

      expect(mockSnsClient.send).toHaveBeenCalledTimes(1);
      const commandInput = publishCommandInstances[0]?.input;
      expect(commandInput).toBeDefined();
      expect(commandInput.TopicArn).toBe(
        "arn:aws:sns:us-east-1:123456789012:test-topic.fifo",
      );
      expect(commandInput.MessageGroupId).toBe("group-123");
      expect(commandInput.MessageDeduplicationId).toBe("dedup-123");
    });

    it("should publish without MessageGroupId and MessageDeduplicationId when event doesn't have them", async () => {
      const config = new AppConfigBuilder()
        .withSnsTopicArn("arn:aws:sns:us-east-1:123456789012:test-topic")
        .build();
      const publisher = new AwsSnsPublisher(config, mockLogger);

      const event = new MetricRunRequestEventBuilder().build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await publisher.publishMetricRunRequest(event);

      expect(mockSnsClient.send).toHaveBeenCalledTimes(1);
      const commandInput = publishCommandInstances[0]?.input;
      expect(commandInput).toBeDefined();
      expect(commandInput.MessageGroupId).toBeUndefined();
      expect(commandInput.MessageDeduplicationId).toBeUndefined();
    });

    it("should log error and throw when SNS publish fails", async () => {
      const event = new MetricRunRequestEventBuilder().build();
      const error = new Error("SNS publish failed");

      mockSnsClient.send.mockRejectedValue(error);

      await expect(publisher.publishMetricRunRequest(event)).rejects.toThrow(
        "SNS publish failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.SNS_PUBLISH_ERROR,
        msg: "Failed to publish metric run request to SNS",
        data: {
          runId: event.runId,
          metricCode: event.metricCode,
        },
        err: error,
      });
    });

    it("should use credentials from config when provided", () => {
      const configWithCreds = new AppConfigBuilder()
        .withAwsCredentials("access-key", "secret-key")
        .build();

      new AwsSnsPublisher(configWithCreds, mockLogger);

      expect(SNSClient).toHaveBeenCalledWith({
        region: configWithCreds.aws.region,
        credentials: {
          accessKeyId: "access-key",
          secretAccessKey: "secret-key",
        },
      });
    });

    it("should not use credentials when not provided", () => {
      const configWithoutCreds = new AppConfigBuilder()
        .withoutAwsCredentials()
        .build();

      new AwsSnsPublisher(configWithoutCreds, mockLogger);

      expect(SNSClient).toHaveBeenCalledWith({
        region: configWithoutCreds.aws.region,
        credentials: undefined,
      });
    });
  });
});
