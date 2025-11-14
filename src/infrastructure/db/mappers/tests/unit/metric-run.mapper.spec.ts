import { MetricRunMapper } from '../../metric-run.mapper';
import { MetricRunRowBuilder } from '../builders/metric-run-row.builder';
import { METRIC_RUN_STATUS } from '@/domain/constants/metric-status';

describe('MetricRunMapper', () => {
  describe('toDomain', () => {
    it('should map a complete metric run row to domain entity', () => {
      const row = new MetricRunRowBuilder().build();
      const result = MetricRunMapper.toDomain(row);

      expect(result.id).toBe(row.id);
      expect(result.metricId).toBe(row.metric_id);
      expect(result.metricCode).toBe(row.metric_code);
      expect(result.status).toBe(row.status);
      expect(result.requestedAt).toBe(row.requested_at);
    });

    it('should map null optional fields to undefined', () => {
      const row = new MetricRunRowBuilder().build();
      const result = MetricRunMapper.toDomain(row);

      expect(result.startedAt).toBeUndefined();
      expect(result.finishedAt).toBeUndefined();
      expect(result.lastHeartbeatAt).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(result.versionTs).toBeUndefined();
      expect(result.manifestPath).toBeUndefined();
      expect(result.rowCount).toBeUndefined();
    });

    it('should map all optional fields when present', () => {
      const startedAt = new Date('2024-01-01T01:00:00Z');
      const finishedAt = new Date('2024-01-01T02:00:00Z');
      const heartbeatAt = new Date('2024-01-01T01:30:00Z');

      const row = new MetricRunRowBuilder()
        .withStartedAt(startedAt)
        .withFinishedAt(finishedAt)
        .withLastHeartbeatAt(heartbeatAt)
        .withError('Test error')
        .withVersionTs('2024-01-01T02:00:00Z')
        .withManifestPath('s3://bucket/path/manifest.json')
        .withRowCount(100)
        .build();

      const result = MetricRunMapper.toDomain(row);

      expect(result.startedAt).toBe(startedAt);
      expect(result.finishedAt).toBe(finishedAt);
      expect(result.lastHeartbeatAt).toBe(heartbeatAt);
      expect(result.error).toBe('Test error');
      expect(result.versionTs).toBe('2024-01-01T02:00:00Z');
      expect(result.manifestPath).toBe('s3://bucket/path/manifest.json');
      expect(result.rowCount).toBe(100);
    });

    it('should handle different statuses', () => {
      const queuedRow = new MetricRunRowBuilder()
        .withStatus(METRIC_RUN_STATUS.QUEUED)
        .build();
      const runningRow = new MetricRunRowBuilder()
        .withStatus(METRIC_RUN_STATUS.RUNNING)
        .build();
      const succeededRow = new MetricRunRowBuilder()
        .withStatus(METRIC_RUN_STATUS.SUCCEEDED)
        .build();
      const failedRow = new MetricRunRowBuilder()
        .withStatus(METRIC_RUN_STATUS.FAILED)
        .build();

      expect(MetricRunMapper.toDomain(queuedRow).status).toBe(
        METRIC_RUN_STATUS.QUEUED,
      );
      expect(MetricRunMapper.toDomain(runningRow).status).toBe(
        METRIC_RUN_STATUS.RUNNING,
      );
      expect(MetricRunMapper.toDomain(succeededRow).status).toBe(
        METRIC_RUN_STATUS.SUCCEEDED,
      );
      expect(MetricRunMapper.toDomain(failedRow).status).toBe(
        METRIC_RUN_STATUS.FAILED,
      );
    });

    it('should use builder convenience methods', () => {
      const runningRow = new MetricRunRowBuilder().asRunning().build();
      const succeededRow = new MetricRunRowBuilder().asSucceeded().build();
      const failedRow = new MetricRunRowBuilder().asFailed().build();

      expect(MetricRunMapper.toDomain(runningRow).status).toBe(
        METRIC_RUN_STATUS.RUNNING,
      );
      expect(MetricRunMapper.toDomain(runningRow).startedAt).toBeDefined();
      expect(MetricRunMapper.toDomain(runningRow).lastHeartbeatAt).toBeDefined();

      expect(MetricRunMapper.toDomain(succeededRow).status).toBe(
        METRIC_RUN_STATUS.SUCCEEDED,
      );
      expect(MetricRunMapper.toDomain(succeededRow).finishedAt).toBeDefined();
      expect(MetricRunMapper.toDomain(succeededRow).versionTs).toBeDefined();
      expect(MetricRunMapper.toDomain(succeededRow).rowCount).toBe(100);

      expect(MetricRunMapper.toDomain(failedRow).status).toBe(
        METRIC_RUN_STATUS.FAILED,
      );
      expect(MetricRunMapper.toDomain(failedRow).error).toBe(
        'Test error message',
      );
    });
  });

  describe('toDomainList', () => {
    it('should map an array of rows to domain entities', () => {
      const rows = [
        new MetricRunRowBuilder().withId('run-1').build(),
        new MetricRunRowBuilder().withId('run-2').build(),
        new MetricRunRowBuilder().withId('run-3').build(),
      ];

      const result = MetricRunMapper.toDomainList(rows);

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('run-1');
      expect(result[1]?.id).toBe('run-2');
      expect(result[2]?.id).toBe('run-3');
    });
  });

  describe('toRow', () => {
    it('should map domain entity to row format', () => {
      const run = {
        metricId: 'metric-123',
        metricCode: 'test_metric',
        status: METRIC_RUN_STATUS.QUEUED,
      };

      const result = MetricRunMapper.toRow(run);

      expect(result.metric_id).toBe(run.metricId);
      expect(result.metric_code).toBe(run.metricCode);
      expect(result.status).toBe(run.status);
      expect(result.started_at).toBeNull();
      expect(result.finished_at).toBeNull();
      expect(result.last_heartbeat_at).toBeNull();
      expect(result.error).toBeNull();
      expect(result.version_ts).toBeNull();
      expect(result.manifest_path).toBeNull();
      expect(result.row_count).toBeNull();
    });

    it('should map optional fields correctly', () => {
      const startedAt = new Date('2024-01-01T01:00:00Z');
      const finishedAt = new Date('2024-01-01T02:00:00Z');

      const run = {
        metricId: 'metric-123',
        metricCode: 'test_metric',
        status: METRIC_RUN_STATUS.SUCCEEDED,
        startedAt,
        finishedAt,
        lastHeartbeatAt: startedAt,
        error: undefined,
        versionTs: '2024-01-01T02:00:00Z',
        manifestPath: 's3://bucket/path/manifest.json',
        rowCount: 100,
      };

      const result = MetricRunMapper.toRow(run);

      expect(result.started_at).toBe(startedAt);
      expect(result.finished_at).toBe(finishedAt);
      expect(result.last_heartbeat_at).toBe(startedAt);
      expect(result.error).toBeNull();
      expect(result.version_ts).toBe('2024-01-01T02:00:00Z');
      expect(result.manifest_path).toBe('s3://bucket/path/manifest.json');
      expect(result.row_count).toBe(100);
    });

    it('should map undefined optional fields to null', () => {
      const run = {
        metricId: 'metric-123',
        metricCode: 'test_metric',
        status: METRIC_RUN_STATUS.QUEUED,
      };

      const result = MetricRunMapper.toRow(run);

      expect(result.started_at).toBeNull();
      expect(result.finished_at).toBeNull();
      expect(result.last_heartbeat_at).toBeNull();
      expect(result.error).toBeNull();
      expect(result.version_ts).toBeNull();
      expect(result.manifest_path).toBeNull();
      expect(result.row_count).toBeNull();
    });
  });
});

