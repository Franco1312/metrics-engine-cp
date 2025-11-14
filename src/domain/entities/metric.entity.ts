import { ExpressionType, ExpressionJson } from '../constants/expression-types';

export interface Metric {
  id: string;
  code: string;
  expressionType: ExpressionType;
  expressionJson: ExpressionJson;
  frequency?: string;
  unit?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

