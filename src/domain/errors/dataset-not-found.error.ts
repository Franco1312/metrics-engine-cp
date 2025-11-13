import { DomainError } from './domain-error';

export class DatasetNotFoundError extends DomainError {
  constructor(datasetId: string) {
    super(`Dataset not found: ${datasetId}`);
  }
}

