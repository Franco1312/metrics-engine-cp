import { AwsS3Client } from "../../s3-client";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { AppConfigBuilder } from "../builders/app-config.builder";
import { Logger } from "@/domain/interfaces/logger.interface";
import { LOG_EVENTS } from "@/domain/constants/log-events";

// Mock AWS SDK
jest.mock("@aws-sdk/client-s3");

describe("AwsS3Client", () => {
  let s3Client: AwsS3Client;
  let mockLogger: jest.Mocked<Logger>;
  let mockS3Client: {
    send: jest.Mock<
      Promise<{ Body?: unknown } | Record<string, never>>,
      [command: GetObjectCommand | HeadObjectCommand]
    >;
  };
  let config: ReturnType<AppConfigBuilder["build"]>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    mockS3Client = {
      send: jest.fn<
        Promise<{ Body?: unknown } | Record<string, never>>,
        [command: GetObjectCommand | HeadObjectCommand]
      >(),
    };

    // Mock S3Client constructor
    (S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(
      () => mockS3Client as unknown as S3Client,
    );

    config = new AppConfigBuilder().build();
    s3Client = new AwsS3Client(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getObject", () => {
    it("should read object from S3 successfully", async () => {
      const bucket = "test-bucket";
      const key = "test-key";
      const buffer = Buffer.from("test content");

      // Mock the stream-like response
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield buffer;
        },
      };

      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await s3Client.getObject(bucket, key);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      const command = mockS3Client.send.mock.calls[0]?.[0] as GetObjectCommand;
      expect(command).toBeInstanceOf(GetObjectCommand);

      expect(result).toEqual(buffer);
      expect(mockLogger.info).toHaveBeenCalledWith({
        event: LOG_EVENTS.S3_OBJECT_READ,
        msg: "Object read from S3",
        data: {
          bucket,
          key,
          size: buffer.length,
        },
      });
    });

    it("should handle multiple chunks in stream", async () => {
      const bucket = "test-bucket";
      const key = "test-key";
      const chunk1 = Buffer.from("chunk1");
      const chunk2 = Buffer.from("chunk2");
      const expectedBuffer = Buffer.concat([chunk1, chunk2]);

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield chunk1;
          yield chunk2;
        },
      };

      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await s3Client.getObject(bucket, key);

      expect(result).toEqual(expectedBuffer);
    });

    it("should throw error when object body is missing", async () => {
      const bucket = "test-bucket";
      const key = "test-key";

      mockS3Client.send.mockResolvedValue({
        Body: null,
      });

      await expect(s3Client.getObject(bucket, key)).rejects.toThrow(
        `Object ${key} not found in bucket ${bucket}`,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LOG_EVENTS.S3_READ_ERROR,
          msg: "Failed to read object from S3",
          data: {
            bucket,
            key,
          },
        }),
      );
    });

    it("should log error and throw when S3 read fails", async () => {
      const bucket = "test-bucket";
      const key = "test-key";
      const error = new Error("S3 read failed");

      mockS3Client.send.mockRejectedValue(error);

      await expect(s3Client.getObject(bucket, key)).rejects.toThrow(
        "S3 read failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.S3_READ_ERROR,
        msg: "Failed to read object from S3",
        data: {
          bucket,
          key,
        },
        err: error,
      });
    });
  });

  describe("objectExists", () => {
    it("should return true when object exists", async () => {
      const bucket = "test-bucket";
      const key = "test-key";

      mockS3Client.send.mockResolvedValue({});

      const result = await s3Client.objectExists(bucket, key);

      expect(result).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      const command = mockS3Client.send.mock.calls[0]?.[0] as HeadObjectCommand;
      expect(command).toBeInstanceOf(HeadObjectCommand);
    });

    it("should return false when object does not exist (404)", async () => {
      const bucket = "test-bucket";
      const key = "test-key";

      const error: any = new Error("Not found");
      error.name = "NotFound";
      mockS3Client.send.mockRejectedValue(error);

      const result = await s3Client.objectExists(bucket, key);

      expect(result).toBe(false);
    });

    it("should return false when object does not exist (httpStatusCode 404)", async () => {
      const bucket = "test-bucket";
      const key = "test-key";

      const error: any = new Error("Not found");
      error.$metadata = { httpStatusCode: 404 };
      mockS3Client.send.mockRejectedValue(error);

      const result = await s3Client.objectExists(bucket, key);

      expect(result).toBe(false);
    });

    it("should log error and throw for non-404 errors", async () => {
      const bucket = "test-bucket";
      const key = "test-key";
      const error = new Error("Access denied");

      mockS3Client.send.mockRejectedValue(error);

      await expect(s3Client.objectExists(bucket, key)).rejects.toThrow(
        "Access denied",
      );

      expect(mockLogger.error).toHaveBeenCalledWith({
        event: LOG_EVENTS.S3_READ_ERROR,
        msg: "Failed to check if object exists in S3",
        data: {
          bucket,
          key,
        },
        err: error,
      });
    });
  });

  describe("constructor", () => {
    it("should use credentials from config when provided", () => {
      const configWithCreds = new AppConfigBuilder()
        .withAwsCredentials("access-key", "secret-key")
        .build();

      new AwsS3Client(configWithCreds, mockLogger);

      expect(S3Client).toHaveBeenCalledWith({
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

      new AwsS3Client(configWithoutCreds, mockLogger);

      expect(S3Client).toHaveBeenCalledWith({
        region: configWithoutCreds.aws.region,
        credentials: undefined,
      });
    });
  });
});
