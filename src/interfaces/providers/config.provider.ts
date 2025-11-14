import { Provider } from '@nestjs/common';
import { CONFIG_TOKEN, loadConfig } from '@/infrastructure/config/app.config';

export const configProvider: Provider = {
  provide: CONFIG_TOKEN,
  useValue: loadConfig(),
};

