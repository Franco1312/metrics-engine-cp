import { Provider } from '@nestjs/common';
import { CONFIG_TOKEN } from '@/infrastructure/config/app.config';
import { PostgresDatabaseClient, DATABASE_CLIENT_TOKEN } from '@/infrastructure/db/database.client';
import { DatabaseClient } from '@/domain/interfaces/database-client.interface';
import { AppConfig } from '@/infrastructure/config/app.config';
import { Logger } from '@/domain/interfaces/logger.interface';
import { LOGGER_TOKEN } from './logger.provider';

export const databaseProvider: Provider<DatabaseClient> = {
  provide: DATABASE_CLIENT_TOKEN,
  inject: [CONFIG_TOKEN, LOGGER_TOKEN],
  useFactory: (config: AppConfig, logger: Logger): DatabaseClient => {
    return new PostgresDatabaseClient(config, logger);
  },
};

