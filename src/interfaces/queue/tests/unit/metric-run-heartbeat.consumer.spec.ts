import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnMetricRunHeartbeatUseCase } from "@/application/use-cases/on-metric-run-heartbeat.use-case";
import { createMetricRunHeartbeatConsumer } from "../../metric-run-heartbeat.consumer";
import { MetricRunHeartbeatEventBuilder } from "@/application/use-cases/tests/builders/metric-run-heartbeat-event.builder";
import { SQSMessageBuilder } from "../builders/sqs-message.builder";

jest.mock("sqs-consumer", () => ({
  Consumer: {
    create: jest.fn(),
  },
}));

describe("createMetricRunHeartbeatConsumer", () => {
  let mockConfig: AppConfig;
  let mockUseCase: jest.Mocked<OnMetricRunHeartbeatUseCase>;
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
        metricRunHeartbeat: {
          queueUrl:
            "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-heartbeat",
          enabled: true,
        },
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
    const event = new MetricRunHeartbeatEventBuilder().build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    createMetricRunHeartbeatConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
  });

  it("should throw error for missing ts field", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({
        type: "metric_run_heartbeat",
        runId: "run-123",
      })
      .build();

    createMetricRunHeartbeatConsumer(mockConfig, mockUseCase, mockLogger);

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Missing required field: ts",
    );
  });
});
