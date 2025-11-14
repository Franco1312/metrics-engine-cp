import { MetricRunHeartbeatEvent } from "@/domain/dto/metric-run-heartbeat-event.dto";

interface MetricRunHeartbeatEventData {
  runId?: string;
  progress?: number;
  ts?: string;
}

export class MetricRunHeartbeatEventBuilder {
  private data: MetricRunHeartbeatEventData = {
    runId: "run-123",
    progress: 50,
    ts: new Date().toISOString(),
  };

  withRunId(runId: string): this {
    this.data.runId = runId;
    return this;
  }

  withProgress(progress: number): this {
    this.data.progress = progress;
    return this;
  }

  withoutProgress(): this {
    this.data.progress = undefined;
    return this;
  }

  withTs(ts: string | Date): this {
    this.data.ts = ts instanceof Date ? ts.toISOString() : ts;
    return this;
  }

  build(): MetricRunHeartbeatEvent {
    return {
      type: "metric_run_heartbeat",
      runId: this.data.runId!,
      progress: this.data.progress,
      ts: this.data.ts!,
    };
  }
}
