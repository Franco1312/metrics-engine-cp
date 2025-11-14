import { AppConfig } from "@/infrastructure/config/app.config";

interface AppConfigData {
  database?: AppConfig["database"];
  aws?: AppConfig["aws"];
  sns?: AppConfig["sns"];
  sqs?: AppConfig["sqs"];
  s3?: AppConfig["s3"];
  logging?: AppConfig["logging"];
  app?: AppConfig["app"];
}

export class AppConfigBuilder {
  private data: AppConfigData = {
    database: {
      host: "localhost",
      port: 5432,
      name: "test_db",
      user: "test_user",
      password: "test_password",
    },
    aws: {
      region: "us-east-1",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
    sns: {
      topicArn: "arn:aws:sns:us-east-1:123456789012:test-topic",
      isFifo: false,
    },
    sqs: {
      projectionUpdateQueueUrl:
        "https://sqs.us-east-1.amazonaws.com/123456789/projection-update",
      metricRunStartedQueueUrl:
        "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-started",
      metricRunHeartbeatQueueUrl:
        "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-heartbeat",
      metricRunCompletedQueueUrl:
        "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-completed",
    },
    s3: {
      bucket: "test-bucket",
    },
    logging: {
      level: "info",
    },
    app: {
      port: 3000,
      nodeEnv: "test",
    },
  };

  withAwsRegion(region: string): this {
    this.data.aws = { ...this.data.aws!, region };
    return this;
  }

  withAwsCredentials(accessKeyId: string, secretAccessKey: string): this {
    this.data.aws = {
      ...this.data.aws!,
      accessKeyId,
      secretAccessKey,
    };
    return this;
  }

  withoutAwsCredentials(): this {
    this.data.aws = {
      ...this.data.aws!,
      accessKeyId: undefined,
      secretAccessKey: undefined,
    };
    return this;
  }

  withSnsTopicArn(topicArn: string): this {
    this.data.sns = { ...this.data.sns!, topicArn };
    return this;
  }

  withSnsFifo(isFifo: boolean): this {
    this.data.sns = { ...this.data.sns!, isFifo };
    return this;
  }

  withS3Bucket(bucket: string): this {
    this.data.s3 = { ...this.data.s3!, bucket };
    return this;
  }

  build(): AppConfig {
    return {
      database: this.data.database!,
      aws: this.data.aws!,
      sns: this.data.sns!,
      sqs: this.data.sqs!,
      s3: this.data.s3!,
      logging: this.data.logging!,
      app: this.data.app!,
    };
  }
}
