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

  beforeEach(() => {
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

    config = new AppConfigBuilder().build();
    publisher = new AwsSnsPublisher(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("publishMetricRunRequest", () => {
    it("should publish event to SNS successfully", async () => {
      const event = new MetricRunRequestEventBuilder().build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await publisher.publishMetricRunRequest(event);

      expect(mockSnsClient.send).toHaveBeenCalledTimes(1);
      const command = mockSnsClient.send.mock.calls[0]?.[0] as PublishCommand;
      expect(command).toBeInstanceOf(PublishCommand);

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

    it("should include MessageGroupId and MessageDeduplicationId for FIFO topics", async () => {
      const fifoConfig = new AppConfigBuilder().withSnsFifo(true).build();
      const fifoPublisher = new AwsSnsPublisher(fifoConfig, mockLogger);

      const event = new MetricRunRequestEventBuilder()
        .asFifo("group-123", "dedup-123")
        .build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await fifoPublisher.publishMetricRunRequest(event);

      const command = mockSnsClient.send.mock.calls[0]?.[0] as PublishCommand;
      expect(command).toBeInstanceOf(PublishCommand);
    });

    it("should handle missing MessageGroupId and MessageDeduplicationId for FIFO topics", async () => {
      const fifoConfig = new AppConfigBuilder().withSnsFifo(true).build();
      const fifoPublisher = new AwsSnsPublisher(fifoConfig, mockLogger);

      const event = new MetricRunRequestEventBuilder().build();
      const mockResponse = { MessageId: "msg-123" };

      mockSnsClient.send.mockResolvedValue(mockResponse);

      await fifoPublisher.publishMetricRunRequest(event);

      const command = mockSnsClient.send.mock.calls[0]?.[0] as PublishCommand;
      expect(command).toBeInstanceOf(PublishCommand);
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
