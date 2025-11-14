import { MetricRunCompletedEvent } from "@/domain/dto/metric-run-completed-event.dto";

interface MetricRunCompletedEventData {
  runId?: string;
  metricCode?: string;
  status?: "SUCCESS" | "FAILURE";
  versionTs?: string;
  outputManifest?: string;
  rowCount?: number;
  error?: string;
}

export class MetricRunCompletedEventBuilder {
  private data: MetricRunCompletedEventData = {
    runId: "run-123",
    metricCode: "test_metric",
    status: "SUCCESS",
  };

  withRunId(runId: string): this {
    this.data.runId = runId;
    return this;
  }

  withMetricCode(metricCode: string): this {
    this.data.metricCode = metricCode;
    return this;
  }

  asSuccess(): this {
    this.data.status = "SUCCESS";
    this.data.error = undefined;
    return this;
  }

  asFailure(error?: string): this {
    this.data.status = "FAILURE";
    this.data.error = error || "Unknown error";
    return this;
  }

  withVersionTs(versionTs: string | Date): this {
    this.data.versionTs =
      versionTs instanceof Date ? versionTs.toISOString() : versionTs;
    return this;
  }

  withOutputManifest(manifest: string): this {
    this.data.outputManifest = manifest;
    return this;
  }

  withRowCount(rowCount: number): this {
    this.data.rowCount = rowCount;
    return this;
  }

  withError(error: string): this {
    this.data.error = error;
    return this;
  }

  build(): MetricRunCompletedEvent {
    return {
      type: "metric_run_completed",
      runId: this.data.runId!,
      metricCode: this.data.metricCode!,
      status: this.data.status!,
      versionTs: this.data.versionTs,
      outputManifest: this.data.outputManifest,
      rowCount: this.data.rowCount,
      error: this.data.error,
    };
  }
}
