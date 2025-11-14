import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Client as IS3Client } from '@/domain/interfaces/s3-client.interface';
import { Logger } from '@/domain/interfaces/logger.interface';
import { LOG_EVENTS } from '@/domain/constants/log-events';
import { AppConfig } from '@/infrastructure/config/app.config';

export class AwsS3Client implements IS3Client {
  private readonly s3Client: S3Client;
  private readonly defaultBucket: string;

  constructor(
    config: AppConfig,
    private readonly logger: Logger,
  ) {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          }
        : undefined,
    });
    this.defaultBucket = config.s3.bucket;
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`Object ${key} not found in bucket ${bucket}`);
      }

      // Convert stream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      this.logger.info({
        event: LOG_EVENTS.S3_OBJECT_READ,
        msg: 'Object read from S3',
        data: {
          bucket,
          key,
          size: buffer.length,
        },
      });

      return buffer;
    } catch (error) {
      this.logger.error({
        event: LOG_EVENTS.S3_READ_ERROR,
        msg: 'Failed to read object from S3',
        data: {
          bucket,
          key,
        },
        err: error,
      });
      throw error;
    }
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }

      this.logger.error({
        event: LOG_EVENTS.S3_READ_ERROR,
        msg: 'Failed to check if object exists in S3',
        data: {
          bucket,
          key,
        },
        err: error,
      });
      throw error;
    }
  }
}

export const S3_CLIENT_TOKEN = 'S3_CLIENT';

