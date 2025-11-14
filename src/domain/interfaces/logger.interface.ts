export interface Logger {
  info: (params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
  }) => void;

  error: (params: {
    event: string;
    msg: string;
    data?: Record<string, unknown>;
    err: Error | unknown;
  }) => void;
}
