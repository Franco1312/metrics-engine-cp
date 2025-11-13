import { DomainError } from './domain-error';

export class MetricRunNotFoundError extends DomainError {
  constructor(runId: string) {
    super(`Metric run not found: ${runId}`);
  }
}

