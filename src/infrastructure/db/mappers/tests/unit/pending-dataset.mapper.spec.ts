import { PendingDatasetMapper } from '../../pending-dataset.mapper';
import { PendingDatasetRowBuilder } from '../builders/pending-dataset-row.builder';
import { PendingDataset } from '@/domain/entities/pending-dataset.entity';

describe('PendingDatasetMapper', () => {
  describe('toDomain', () => {
    it('should map a complete pending dataset row to domain entity', () => {
      const row = new PendingDatasetRowBuilder().build();
      const result = PendingDatasetMapper.toDomain(row);

      expect(result.runId).toBe(row.run_id);
      expect(result.datasetId).toBe(row.dataset_id);
      expect(result.requiredDays).toBe(row.required_days);
      expect(result.received).toBe(row.received);
      expect(result.createdAt).toBe(row.created_at);
    });

    it('should map null optional fields to undefined', () => {
      const row = new PendingDatasetRowBuilder().build();
      const result = PendingDatasetMapper.toDomain(row);

      expect(result.receivedUpdateId).toBeUndefined();
      expect(result.receivedAt).toBeUndefined();
    });

    it('should map optional fields when present', () => {
      const receivedAt = new Date('2024-01-02T00:00:00Z');
      const row = new PendingDatasetRowBuilder()
        .asReceived('update-123', receivedAt)
        .build();

      const result = PendingDatasetMapper.toDomain(row);

      expect(result.received).toBe(true);
      expect(result.receivedUpdateId).toBe('update-123');
      expect(result.receivedAt).toBe(receivedAt);
    });

    it('should handle all fields correctly', () => {
      const receivedAt = new Date('2024-01-02T00:00:00Z');
      const createdAt = new Date('2024-01-01T00:00:00Z');

      const row = new PendingDatasetRowBuilder()
        .withRunId('run-456')
        .withDatasetId('dataset-456')
        .withRequiredDays(14)
        .asReceived('update-456', receivedAt)
        .withCreatedAt(createdAt)
        .build();

      const result = PendingDatasetMapper.toDomain(row);

      expect(result.runId).toBe('run-456');
      expect(result.datasetId).toBe('dataset-456');
      expect(result.requiredDays).toBe(14);
      expect(result.received).toBe(true);
      expect(result.receivedUpdateId).toBe('update-456');
      expect(result.receivedAt).toBe(receivedAt);
      expect(result.createdAt).toBe(createdAt);
    });
  });

  describe('toDomainList', () => {
    it('should map an array of rows to domain entities', () => {
      const rows = [
        new PendingDatasetRowBuilder()
          .withRunId('run-1')
          .withDatasetId('dataset-1')
          .build(),
        new PendingDatasetRowBuilder()
          .withRunId('run-1')
          .withDatasetId('dataset-2')
          .build(),
      ];

      const result = PendingDatasetMapper.toDomainList(rows);

      expect(result).toHaveLength(2);
      expect(result[0]?.runId).toBe('run-1');
      expect(result[0]?.datasetId).toBe('dataset-1');
      expect(result[1]?.runId).toBe('run-1');
      expect(result[1]?.datasetId).toBe('dataset-2');
    });
  });

  describe('toRow', () => {
    it('should map domain entity to row format', () => {
      const pending: Omit<PendingDataset, 'createdAt'> = {
        runId: 'run-123',
        datasetId: 'dataset-123',
        requiredDays: 7,
        received: false,
      };

      const result = PendingDatasetMapper.toRow(pending);

      expect(result.run_id).toBe(pending.runId);
      expect(result.dataset_id).toBe(pending.datasetId);
      expect(result.required_days).toBe(pending.requiredDays);
      expect(result.received).toBe(pending.received);
      expect(result.received_update_id).toBeNull();
      expect(result.received_at).toBeNull();
    });

    it('should map optional fields when present', () => {
      const receivedAt = new Date('2024-01-02T00:00:00Z');
      const pending: Omit<PendingDataset, 'createdAt'> = {
        runId: 'run-123',
        datasetId: 'dataset-123',
        requiredDays: 7,
        received: true,
        receivedUpdateId: 'update-123',
        receivedAt,
      };

      const result = PendingDatasetMapper.toRow(pending);

      expect(result.received).toBe(true);
      expect(result.received_update_id).toBe('update-123');
      expect(result.received_at).toBe(receivedAt);
    });

    it('should map undefined optional fields to null', () => {
      const pending: Omit<PendingDataset, 'createdAt'> = {
        runId: 'run-123',
        datasetId: 'dataset-123',
        requiredDays: 7,
        received: false,
      };

      const result = PendingDatasetMapper.toRow(pending);

      expect(result.received_update_id).toBeNull();
      expect(result.received_at).toBeNull();
    });
  });
});

