import { Consumer } from "sqs-consumer";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";
import { OnProjectionUpdateUseCase } from "@/application/use-cases/on-projection-update.use-case";
import { createProjectionUpdateConsumer } from "../../projection-update.consumer";
import { ProjectionUpdateEventBuilder } from "@/application/services/tests/builders/projection-update-event.builder";
import { SQSMessageBuilder } from "../builders/sqs-message.builder";
import { LOG_EVENTS } from "@/domain/constants/log-events";

// Mock sqs-consumer
jest.mock("sqs-consumer", () => ({
  Consumer: {
    create: jest.fn(),
  },
}));

describe("createProjectionUpdateConsumer", () => {
  let mockConfig: AppConfig;
  let mockUseCase: jest.Mocked<OnProjectionUpdateUseCase>;
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
        projectionUpdateQueueUrl:
          "https://sqs.us-east-1.amazonaws.com/123456789/projection-update",
        metricRunStartedQueueUrl: "",
        metricRunHeartbeatQueueUrl: "",
        metricRunCompletedQueueUrl: "",
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

  it("should create consumer with correct configuration", () => {
    createProjectionUpdateConsumer(mockConfig, mockUseCase, mockLogger);

    expect(Consumer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sqs: expect.any(Object),
        queueUrl: mockConfig.sqs.projectionUpdateQueueUrl,
        batchSize: 10,
        suppressFifoWarning: true,
      }),
    );
  });

  it("should parse and handle valid message", async () => {
    const event = new ProjectionUpdateEventBuilder().build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    const consumer = createProjectionUpdateConsumer(
      mockConfig,
      mockUseCase,
      mockLogger,
    );

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
    expect(mockLogger.info).toHaveBeenCalledWith({
      event: LOG_EVENTS.SQS_MESSAGE_RECEIVED,
      msg: "Processing projection update event",
      data: {
        datasetId: event.dataset_id,
        bucket: event.bucket,
      },
    });
    expect(mockLogger.info).toHaveBeenCalledWith({
      event: LOG_EVENTS.SQS_MESSAGE_PROCESSED,
      msg: "Projection update event processed successfully",
      data: {
        datasetId: event.dataset_id,
      },
    });
  });

  it("should parse message from SNS format", async () => {
    const event = new ProjectionUpdateEventBuilder().build();
    const message = new SQSMessageBuilder().withSnsMessage(event).build();

    const consumer = createProjectionUpdateConsumer(
      mockConfig,
      mockUseCase,
      mockLogger,
    );

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];
    await createCall.handleMessageBatch([message]);

    expect(mockUseCase.execute).toHaveBeenCalledWith(event);
  });

  it("should throw error for invalid event type", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({ event: "invalid_event" })
      .build();

    const consumer = createProjectionUpdateConsumer(
      mockConfig,
      mockUseCase,
      mockLogger,
    );

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Invalid event type",
    );
  });

  it("should throw error for missing required fields", async () => {
    const message = new SQSMessageBuilder()
      .withEvent({
        event: "projection_update",
        dataset_id: "dataset-123",
      })
      .build();

    const consumer = createProjectionUpdateConsumer(
      mockConfig,
      mockUseCase,
      mockLogger,
    );

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Missing required field",
    );
  });

  it("should handle use case errors", async () => {
    const event = new ProjectionUpdateEventBuilder().build();
    const message = new SQSMessageBuilder().withEvent(event).build();

    const error = new Error("Use case failed");
    mockUseCase.execute.mockRejectedValue(error);

    const consumer = createProjectionUpdateConsumer(
      mockConfig,
      mockUseCase,
      mockLogger,
    );

    const createCall = (Consumer.create as jest.Mock).mock.calls[0][0];

    await expect(createCall.handleMessageBatch([message])).rejects.toThrow(
      "Use case failed",
    );

    expect(mockLogger.error).toHaveBeenCalledWith({
      event: "PROJECTION_UPDATE_ERROR",
      msg: "PROJECTION_UPDATE message processed with errors",
      data: { message: message.Body },
      err: error,
    });
  });

  it("should setup event handlers", () => {
    createProjectionUpdateConsumer(mockConfig, mockUseCase, mockLogger);

    expect(mockConsumer.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockConsumer.on).toHaveBeenCalledWith(
      "processing_error",
      expect.any(Function),
    );
    expect(mockConsumer.on).toHaveBeenCalledWith(
      "timeout_error",
      expect.any(Function),
    );
  });
});
