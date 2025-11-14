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
      metricRunRequest: {
        topic: "arn:aws:sns:us-east-1:123456789012:test-topic",
        enabled: true,
        region: "us-east-1",
      },
    },
    sqs: {
      projectionUpdate: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/123456789/projection-update",
        enabled: true,
      },
      metricRunStarted: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-started",
        enabled: true,
      },
      metricRunHeartbeat: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-heartbeat",
        enabled: true,
      },
      metricRunCompleted: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/123456789/metric-run-completed",
        enabled: true,
      },
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
    this.data.sns = {
      ...this.data.sns!,
      metricRunRequest: {
        ...this.data.sns!.metricRunRequest,
        topic: topicArn,
      },
    };
    return this;
  }

  withSnsMetricRunRequest(config: {
    topic?: string;
    enabled?: boolean;
    region?: string;
  }): this {
    this.data.sns = {
      ...this.data.sns!,
      metricRunRequest: {
        ...this.data.sns!.metricRunRequest,
        ...config,
      },
    };
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
