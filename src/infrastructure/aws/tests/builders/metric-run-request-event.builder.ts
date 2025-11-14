import { MetricRunRequestEvent } from '@/domain/dto/metric-run-request-event.dto';
import { EXPRESSION_TYPES } from '@/domain/constants/expression-types';

interface MetricRunRequestEventData {
  runId?: string;
  metricCode?: string;
  expressionType?: MetricRunRequestEvent['expressionType'];
  expressionJson?: MetricRunRequestEvent['expressionJson'];
  inputs?: MetricRunRequestEvent['inputs'];
  catalog?: MetricRunRequestEvent['catalog'];
  output?: MetricRunRequestEvent['output'];
  messageGroupId?: string;
  messageDeduplicationId?: string;
}

export class MetricRunRequestEventBuilder {
  private data: MetricRunRequestEventData = {
    runId: 'run-123',
    metricCode: 'test_metric',
    expressionType: EXPRESSION_TYPES.SERIES_MATH,
    expressionJson: {
      op: 'ratio',
      left: { seriesCode: 'series1' },
      right: { seriesCode: 'series2' },
    },
    inputs: [
      {
        datasetId: 'dataset-123',
        seriesCode: 'series1',
      },
      {
        datasetId: 'dataset-123',
        seriesCode: 'series2',
      },
    ],
    catalog: {
      datasets: {
        'dataset-123': {
          manifestPath: 's3://bucket/datasets/dataset-123/manifest.json',
          projectionsPath: 's3://bucket/datasets/dataset-123/projections/',
        },
      },
    },
    output: {
      basePath: 's3://bucket/metrics/test_metric/',
    },
  };

  withRunId(runId: string): this {
    this.data.runId = runId;
    return this;
  }

  withMetricCode(metricCode: string): this {
    this.data.metricCode = metricCode;
    return this;
  }

  withExpressionType(type: MetricRunRequestEvent['expressionType']): this {
    this.data.expressionType = type;
    return this;
  }

  withExpressionJson(json: MetricRunRequestEvent['expressionJson']): this {
    this.data.expressionJson = json;
    return this;
  }

  withInputs(inputs: MetricRunRequestEvent['inputs']): this {
    this.data.inputs = inputs;
    return this;
  }

  withCatalog(catalog: MetricRunRequestEvent['catalog']): this {
    this.data.catalog = catalog;
    return this;
  }

  withOutput(output: MetricRunRequestEvent['output']): this {
    this.data.output = output;
    return this;
  }

  withMessageGroupId(messageGroupId: string): this {
    this.data.messageGroupId = messageGroupId;
    return this;
  }

  withMessageDeduplicationId(messageDeduplicationId: string): this {
    this.data.messageDeduplicationId = messageDeduplicationId;
    return this;
  }

  asFifo(messageGroupId: string, messageDeduplicationId: string): this {
    this.data.messageGroupId = messageGroupId;
    this.data.messageDeduplicationId = messageDeduplicationId;
    return this;
  }

  build(): MetricRunRequestEvent {
    return {
      type: 'metric_run_requested',
      runId: this.data.runId!,
      metricCode: this.data.metricCode!,
      expressionType: this.data.expressionType!,
      expressionJson: this.data.expressionJson!,
      inputs: this.data.inputs!,
      catalog: this.data.catalog!,
      output: this.data.output!,
      messageGroupId: this.data.messageGroupId,
      messageDeduplicationId: this.data.messageDeduplicationId,
    };
  }
}

