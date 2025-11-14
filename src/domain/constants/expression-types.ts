/**
 * Tipos de expresiones de métricas
 */
export const EXPRESSION_TYPES = {
  SERIES_MATH: 'series_math',
  WINDOW_OP: 'window_op',
  COMPOSITE: 'composite',
} as const;

export type ExpressionType =
  (typeof EXPRESSION_TYPES)[keyof typeof EXPRESSION_TYPES];

/**
 * Operaciones para series_math
 */
export const SERIES_MATH_OPS = {
  RATIO: 'ratio',
  MULTIPLY: 'multiply',
  SUBTRACT: 'subtract',
  ADD: 'add',
} as const;

export type SeriesMathOp =
  (typeof SERIES_MATH_OPS)[keyof typeof SERIES_MATH_OPS];

/**
 * Operaciones para window_op
 */
export const WINDOW_OPS = {
  SMA: 'sma', // Simple Moving Average
  EMA: 'ema', // Exponential Moving Average
  SUM: 'sum',
  MAX: 'max',
  MIN: 'min',
  LAG: 'lag',
} as const;

export type WindowOp = (typeof WINDOW_OPS)[keyof typeof WINDOW_OPS];

/**
 * Operaciones para composite
 */
export const COMPOSITE_OPS = {
  SUM: 'sum',
  AVG: 'avg',
  MAX: 'max',
  MIN: 'min',
} as const;

export type CompositeOp = (typeof COMPOSITE_OPS)[keyof typeof COMPOSITE_OPS];

/**
 * Referencia a una serie en una expresión
 */
export interface SeriesReference {
  seriesCode: string;
}

/**
 * Expresión JSON para series_math
 */
export interface SeriesMathExpression {
  op: SeriesMathOp;
  left: SeriesReference | ExpressionJson;
  right: SeriesReference | ExpressionJson;
  scale?: number;
}

/**
 * Expresión JSON para window_op
 */
export interface WindowOpExpression {
  op: WindowOp;
  series: SeriesReference | ExpressionJson;
  window: number;
}

/**
 * Expresión JSON para composite
 */
export interface CompositeExpression {
  op: CompositeOp;
  operands: SeriesReference[];
}

/**
 * Union type para todas las expresiones
 */
export type ExpressionJson =
  | SeriesMathExpression
  | WindowOpExpression
  | CompositeExpression;

