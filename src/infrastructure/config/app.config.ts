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
    topicArn: string;
    isFifo: boolean;
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
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      name: process.env.DB_NAME ?? 'metrics_engine',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
    },
    aws: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    sns: {
      topicArn: process.env.SNS_TOPIC_ARN ?? '',
      isFifo: process.env.SNS_TOPIC_IS_FIFO === 'true',
    },
    s3: {
      bucket: process.env.S3_BUCKET ?? '',
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
  };
};

export const CONFIG_TOKEN = 'APP_CONFIG';

