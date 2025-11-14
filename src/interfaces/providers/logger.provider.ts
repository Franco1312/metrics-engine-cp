import { Provider } from "@nestjs/common";
import { Logger } from "@/domain/interfaces/logger.interface";
import { defaultLogger } from "@/infrastructure/shared/metrics-logger";

export const LOGGER_TOKEN = "LOGGER";

export const loggerProvider: Provider<Logger> = {
  provide: LOGGER_TOKEN,
  useValue: defaultLogger,
};
