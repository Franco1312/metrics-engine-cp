export interface AppConfig {
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  aws: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  sns: {
    metricRunRequest: {
      topic: string;
      enabled: boolean;
      region: string;
    };
  };
  sqs: {
    projectionUpdate: {
      queueUrl: string;
      enabled: boolean;
    };
    metricRunStarted: {
      queueUrl: string;
      enabled: boolean;
    };
    metricRunHeartbeat: {
      queueUrl: string;
      enabled: boolean;
    };
    metricRunCompleted: {
      queueUrl: string;
      enabled: boolean;
    };
  };
  s3: {
    bucket: string;
  };
  logging: {
    level: string;
  };
  app: {
    port: number;
    nodeEnv: string;
  };
}

export const loadConfig = (): AppConfig => {
  return {
    database: {
      host: process.env.DB_HOST ?? "localhost",
      port: parseInt(process.env.DB_PORT ?? "5432", 10),
      name: process.env.DB_NAME ?? "metrics_engine",
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
    },
    aws: {
      region: process.env.AWS_REGION ?? "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    sns: {
      metricRunRequest: {
        topic: "arn:aws:sns:us-east-1:706341500093:metrics-run-request.fifo",
        enabled: true,
        region: "us-east-1",
      },
    },
    sqs: {
      projectionUpdate: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/706341500093/metrics-engine-cp-projection-updates-consumer.fifo",
        enabled: true,
      },
      metricRunStarted: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/706341500093/metric-run-started-consumer.fifo",
        enabled: true,
      },
      metricRunHeartbeat: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/706341500093/metric-run-hearthbeat-consumer.fifo",
        enabled: true,
      },
      metricRunCompleted: {
        queueUrl:
          "https://sqs.us-east-1.amazonaws.com/706341500093/metric-run-completed.fifo",
        enabled: true,
      },
    },
    s3: {
      bucket: "ingestor-datasets",
    },
    logging: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    app: {
      port: parseInt(process.env.PORT ?? "3000", 10),
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
  };
};

export const CONFIG_TOKEN = "APP_CONFIG";
