import {
  ExpressionType,
  ExpressionJson,
} from "@/domain/constants/expression-types";

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
