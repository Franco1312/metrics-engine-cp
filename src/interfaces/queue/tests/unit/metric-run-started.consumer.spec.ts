import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunStartedUseCase } from "@/application/use-cases/on-metric-run-started.use-case";
import { createMetricRunStartedConsumer } from "../../metric-run-started.consumer";
import { MetricRunStartedEventBuilder } from "@/application/use-cases/tests/builders/metric-run-started-event.builder";
import { SQSMessageBuilder } from "../builders/sqs-message.builder";

jest.mock("sqs-consumer", () => ({
  Consumer: {
    create: jest.fn(),
  },
}));

describe("createMetricRunStartedConsumer", () => {
  let mockConfig: AppConfig;
  let mockUseCase: jest.Mocked<OnMetricRunStartedUseCase>;
  let mockLogger: jest.Mocked<Logger>;
  let mockConsumer: jest.Mocked<Consumer>;

  beforeEach(() => {
    mockConfig = {
      aws: {
        region: "us-east-1",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      },
      sqs: {
        projectionUpdate: { queueUrl: "", enabled: false },
        metricRunStarted: {
          queueUrl:
            "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-started",
          enabled: true,
        },
        metricRunHeartbeat: { queueUrl: "", enabled: false },
        metricRunCompleted: { queueUrl: "", enabled: false },
      },
    } as AppConfig;

    mockUseCase = {
      execute: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    mockConsumer = {
      on: jest.fn(),
    } as any;

    (Consumer.create as jest.Mock).mockReturnValue(mockConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should parse and handle valid message", async () => {
    const event = new MetricRunStartedEventBuilder().build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    createMetricRunStartedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
  });

  it("should throw error for invalid event type", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({ type: "invalid_type" })
      .build();

    createMetricRunStartedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Invalid event type",
    );
  });

  it("should throw error for missing runId", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({
        type: "metric_run_started",
      })
      .build();

    createMetricRunStartedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Missing required field: runId",
    );
  });
});
