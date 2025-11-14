import { MetricRun } from "@/domain/entities/metric-run.entity";
import { MetricRunStatus } from "@/domain/constants/metric-status";
import { TransactionClient } from "@/domain/interfaces/database-client.interface";

export interface MetricRunRepository {
  create(
    run: Omit<MetricRun, "id" | "requestedAt">,
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
    updates: Partial<Omit<MetricRun, "id" | "requestedAt">>,
    client?: TransactionClient,
  ): Promise<MetricRun>;
  updateStatus(
    id: string,
    status: MetricRunStatus,
    client?: TransactionClient,
  ): Promise<MetricRun>;
  linkDatasetUpdates(
    runId: string,
    datasetUpdateIds: string[],
    client?: TransactionClient,
  ): Promise<void>;
}
