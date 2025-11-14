import pino from "pino";
import { Logger } from "@/domain/interfaces/logger.interface";

const isDevelopment = process.env.NODE_ENV === "development";

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

class MetricsLogger implements Logger {
  info(params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
  }): void {
    pinoLogger.info({
      event: params.event,
      msg: params.msg,
      ...(params.data && { data: params.data }),
    });
  }

  error(params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
    err: Error | unknown;
  }): void {
    const errorObj =
      params.err instanceof Error
        ? {
            message: params.err.message,
            stack: params.err.stack,
            name: params.err.name,
          }
        : { error: params.err };

    pinoLogger.error({
      event: params.event,
      msg: params.msg,
      ...(params.data && { data: params.data }),
      ...errorObj,
    });
  }
}

export const defaultLogger: Logger = new MetricsLogger();
