import { TimeWindowValidatorService } from '../../time-window-validator.service';
import { DatasetUpdateBuilder } from '../builders/dataset-update.builder';

describe('TimeWindowValidatorService', () => {
  describe('isUpdateValid', () => {
    it('should return true when update is within required days', () => {
      const update = new DatasetUpdateBuilder().withDaysAgo(5).build();
      const result = TimeWindowValidatorService.isUpdateValid(update, 7);

      expect(result).toBe(true);
    });

    it('should return false when update is older than required days', () => {
      const update = new DatasetUpdateBuilder().withDaysAgo(10).build();
      const result = TimeWindowValidatorService.isUpdateValid(update, 7);

      expect(result).toBe(false);
    });

    it('should return true when update is exactly at the cutoff date', () => {
      const referenceDate = new Date('2024-01-15T00:00:00Z');
      const update = new DatasetUpdateBuilder()
        .withCreatedAt(new Date('2024-01-08T00:00:00Z'))
        .build();
      const result = TimeWindowValidatorService.isUpdateValid(
        update,
        7,
        referenceDate,
      );

      expect(result).toBe(true);
    });

    it('should return false when update is one day before cutoff', () => {
      const referenceDate = new Date('2024-01-15T00:00:00Z');
      const update = new DatasetUpdateBuilder()
        .withCreatedAt(new Date('2024-01-07T23:59:59Z'))
        .build();
      const result = TimeWindowValidatorService.isUpdateValid(
        update,
        7,
        referenceDate,
      );

      expect(result).toBe(false);
    });

    it('should return true when requiredDays is 0 (no restriction)', () => {
      const update = new DatasetUpdateBuilder().withDaysAgo(100).build();
      const result = TimeWindowValidatorService.isUpdateValid(update, 0);

      expect(result).toBe(true);
    });

    it('should return true when requiredDays is negative (no restriction)', () => {
      const update = new DatasetUpdateBuilder().withDaysAgo(100).build();
      const result = TimeWindowValidatorService.isUpdateValid(update, -5);

      expect(result).toBe(true);
    });

    it('should handle same day updates correctly', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      const update = new DatasetUpdateBuilder()
        .withCreatedAt(new Date('2024-01-15T00:00:00Z'))
        .build();
      const result = TimeWindowValidatorService.isUpdateValid(
        update,
        1,
        referenceDate,
      );

      expect(result).toBe(true);
    });
  });

  describe('calculateCutoffDate', () => {
    it('should calculate cutoff date correctly', () => {
      const referenceDate = new Date('2024-01-15T00:00:00Z');
      const cutoffDate = TimeWindowValidatorService.calculateCutoffDate(
        7,
        referenceDate,
      );

      expect(cutoffDate).toEqual(new Date('2024-01-08T00:00:00Z'));
    });

    it('should handle month boundaries correctly', () => {
      const referenceDate = new Date('2024-02-05T00:00:00Z');
      const cutoffDate = TimeWindowValidatorService.calculateCutoffDate(
        10,
        referenceDate,
      );

      expect(cutoffDate).toEqual(new Date('2024-01-26T00:00:00Z'));
    });

    it('should handle year boundaries correctly', () => {
      const referenceDate = new Date('2024-01-05T00:00:00Z');
      const cutoffDate = TimeWindowValidatorService.calculateCutoffDate(
        10,
        referenceDate,
      );

      expect(cutoffDate).toEqual(new Date('2023-12-26T00:00:00Z'));
    });

    it('should use current date when referenceDate is not provided', () => {
      const before = new Date();
      const cutoffDate = TimeWindowValidatorService.calculateCutoffDate(7);
      const after = new Date();

      expect(cutoffDate.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      expect(cutoffDate.getTime()).toBeLessThanOrEqual(
        after.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
    });
  });
});

