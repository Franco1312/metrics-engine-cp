import { MetricRun } from '../entities/metric-run.entity';
import { MetricRunStatus } from '../constants/metric-status';
import { TransactionClient } from '../interfaces/database-client.interface';

export interface MetricRunRepository {
  create(
    run: Omit<MetricRun, 'id' | 'requestedAt'>,
    client?: TransactionClient,
  ): Promise<MetricRun>;
  findById(id: string, client?: TransactionClient): Promise<MetricRun | null>;
  findByMetricId(
    metricId: string,
    client?: TransactionClient,
  ): Promise<MetricRun[]>;
  findByStatus(
    status: MetricRunStatus,
    client?: TransactionClient,
  ): Promise<MetricRun[]>;
  update(
    id: string,
    updates: Partial<Omit<MetricRun, 'id' | 'requestedAt'>>,
    client?: TransactionClient,
  ): Promise<MetricRun>;
  updateStatus(
    id: string,
    status: MetricRunStatus,
    client?: TransactionClient,
  ): Promise<MetricRun>;
}

