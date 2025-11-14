import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunCompletedUseCase } from "@/application/use-cases/on-metric-run-completed.use-case";
import { createMetricRunCompletedConsumer } from "../../metric-run-completed.consumer";
import { MetricRunCompletedEventBuilder } from "@/application/use-cases/tests/builders/metric-run-completed-event.builder";
import { SQSMessageBuilder } from "../builders/sqs-message.builder";

jest.mock("sqs-consumer", () => ({
  Consumer: {
    create: jest.fn(),
  },
}));

describe("createMetricRunCompletedConsumer", () => {
  let mockConfig: AppConfig;
  let mockUseCase: jest.Mocked<OnMetricRunCompletedUseCase>;
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
        metricRunStarted: { queueUrl: "", enabled: false },
        metricRunHeartbeat: { queueUrl: "", enabled: false },
        metricRunCompleted: {
          queueUrl:
            "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-completed",
          enabled: true,
        },
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

  it("should parse and handle valid success message", async () => {
    const event = new MetricRunCompletedEventBuilder().asSuccess().build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    createMetricRunCompletedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
  });

  it("should parse and handle valid failure message", async () => {
    const event = new MetricRunCompletedEventBuilder()
      .asFailure("Test error")
      .build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    createMetricRunCompletedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
  });

  it("should throw error for invalid status", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({
        type: "metric_run_completed",
        runId: "run-123",
        metricCode: "metric-1",
        status: "INVALID_STATUS",
      })
      .build();

    createMetricRunCompletedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Invalid status",
    );
  });

  it("should throw error for missing required fields", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({
        type: "metric_run_completed",
        runId: "run-123",
      })
      .build();

    createMetricRunCompletedConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Missing required field",
    );
  });
});
