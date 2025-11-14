import { Metric } from '../entities/metric.entity';
import { TransactionClient } from '../interfaces/database-client.interface';

export interface MetricRepository {
  findById(id: string, client?: TransactionClient): Promise<Metric | null>;
  findByCode(code: string, client?: TransactionClient): Promise<Metric | null>;
  findAll(client?: TransactionClient): Promise<Metric[]>;
}

