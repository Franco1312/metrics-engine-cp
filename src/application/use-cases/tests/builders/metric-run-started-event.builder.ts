import { MetricRunStartedEvent } from "@/domain/dto/metric-run-started-event.dto";

interface MetricRunStartedEventData {
  runId?: string;
  startedAt?: string;
}

export class MetricRunStartedEventBuilder {
  private data: MetricRunStartedEventData = {
    runId: "run-123",
    startedAt: new Date().toISOString(),
  };

  withRunId(runId: string): this {
    this.data.runId = runId;
    return this;
  }

  withStartedAt(startedAt: string | Date): this {
    this.data.startedAt =
      startedAt instanceof Date ? startedAt.toISOString() : startedAt;
    return this;
  }

  withoutStartedAt(): this {
    this.data.startedAt = undefined;
    return this;
  }

  build(): MetricRunStartedEvent {
    return {
      type: "metric_run_started",
      runId: this.data.runId!,
      startedAt: this.data.startedAt,
    };
  }
}
