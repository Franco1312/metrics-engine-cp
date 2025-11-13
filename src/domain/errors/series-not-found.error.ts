import { DomainError } from './domain-error';

export class SeriesNotFoundError extends DomainError {
  constructor(seriesCode: string) {
    super(`Series not found: ${seriesCode}`);
  }
}

