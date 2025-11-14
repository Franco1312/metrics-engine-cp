import { MetricMapper } from '../../metric.mapper';
import { MetricRowBuilder } from '../builders/metric-row.builder';
import { EXPRESSION_TYPES } from '@/domain/constants/expression-types';

describe('MetricMapper', () => {
  describe('toDomain', () => {
    it('should map a complete metric row to domain entity', () => {
      const row = new MetricRowBuilder().build();
      const result = MetricMapper.toDomain(row);

      expect(result.id).toBe(row.id);
      expect(result.code).toBe(row.code);
      expect(result.expressionType).toBe(row.expression_type);
      expect(result.expressionJson).toEqual(row.expression_json);
      expect(result.frequency).toBe(row.frequency);
      expect(result.unit).toBe(row.unit);
      expect(result.description).toBe(row.description);
      expect(result.createdAt).toBe(row.created_at);
      expect(result.updatedAt).toBe(row.updated_at);
    });

    it('should map null optional fields to undefined', () => {
      const row = new MetricRowBuilder().withNullOptionalFields().build();
      const result = MetricMapper.toDomain(row);

      expect(result.frequency).toBeUndefined();
      expect(result.unit).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should handle different expression types', () => {
      const seriesMathRow = new MetricRowBuilder()
        .withExpressionType(EXPRESSION_TYPES.SERIES_MATH)
        .build();
      const windowOpRow = new MetricRowBuilder()
        .withExpressionType(EXPRESSION_TYPES.WINDOW_OP)
        .build();
      const compositeRow = new MetricRowBuilder()
        .withExpressionType(EXPRESSION_TYPES.COMPOSITE)
        .build();

      expect(MetricMapper.toDomain(seriesMathRow).expressionType).toBe(
        EXPRESSION_TYPES.SERIES_MATH,
      );
      expect(MetricMapper.toDomain(windowOpRow).expressionType).toBe(
        EXPRESSION_TYPES.WINDOW_OP,
      );
      expect(MetricMapper.toDomain(compositeRow).expressionType).toBe(
        EXPRESSION_TYPES.COMPOSITE,
      );
    });
  });

  describe('toDomainList', () => {
    it('should map an array of rows to domain entities', () => {
      const rows = [
        new MetricRowBuilder().withId('metric-1').withCode('metric_1').build(),
        new MetricRowBuilder().withId('metric-2').withCode('metric_2').build(),
        new MetricRowBuilder().withId('metric-3').withCode('metric_3').build(),
      ];

      const result = MetricMapper.toDomainList(rows);

      expect(result).toHaveLength(3);
      expect(result[0]?.id).toBe('metric-1');
      expect(result[1]?.id).toBe('metric-2');
      expect(result[2]?.id).toBe('metric-3');
    });

    it('should return empty array for empty input', () => {
      const result = MetricMapper.toDomainList([]);
      expect(result).toHaveLength(0);
    });
  });
});

