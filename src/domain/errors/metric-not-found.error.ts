import { DomainError } from "./domain-error";

export class MetricNotFoundError extends DomainError {
  constructor(metricIdOrCode: string) {
    super(`Metric not found: ${metricIdOrCode}`);
  }
}
