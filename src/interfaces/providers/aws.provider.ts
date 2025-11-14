import { Provider } from "@nestjs/common";
import {
  AwsSnsPublisher,
  SNS_PUBLISHER_TOKEN,
} from "@/infrastructure/aws/sns-publisher";
import { AwsS3Client, S3_CLIENT_TOKEN } from "@/infrastructure/aws/s3-client";
import { CONFIG_TOKEN } from "@/infrastructure/config/app.config";
import { LOGGER_TOKEN } from "@/interfaces/providers/logger.provider";
import { AppConfig } from "@/infrastructure/config/app.config";
import { Logger } from "@/domain/interfaces/logger.interface";

export const snsPublisherProvider: Provider = {
  provide: SNS_PUBLISHER_TOKEN,
  useFactory: (config: AppConfig, logger: Logger) => {
    return new AwsSnsPublisher(config, logger);
  },
  inject: [CONFIG_TOKEN, LOGGER_TOKEN],
};

export const s3ClientProvider: Provider = {
  provide: S3_CLIENT_TOKEN,
  useFactory: (config: AppConfig, logger: Logger) => {
    return new AwsS3Client(config, logger);
  },
  inject: [CONFIG_TOKEN, LOGGER_TOKEN],
};

export const awsProviders: Provider[] = [
  snsPublisherProvider,
  s3ClientProvider,
];
