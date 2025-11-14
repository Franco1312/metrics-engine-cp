import { Metric } from "@/domain/entities/metric.entity";
import {
  ExpressionType,
  ExpressionJson,
  SeriesMathExpression,
  WindowOpExpression,
  CompositeExpression,
  SERIES_MATH_OPS,
  WINDOW_OPS,
  COMPOSITE_OPS,
  EXPRESSION_TYPES,
} from "@/domain/constants/expression-types";

/**
 * Errores de validación de expresiones
 */
export class MetricExpressionValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "MetricExpressionValidationError";
  }
}

/**
 * Validador de expresiones de métricas
 */
export class MetricExpressionValidator {
  /**
   * Valida una métrica completa, incluyendo que el expressionType coincida con expressionJson
   *
   * @param metric - La métrica a validar
   * @throws MetricExpressionValidationError si la validación falla
   */
  static validateMetric(metric: Metric): void {
    if (!metric.code || metric.code.trim().length === 0) {
      throw new MetricExpressionValidationError(
        "Metric code is required and cannot be empty",
        "code",
      );
    }

    if (!metric.expressionType) {
      throw new MetricExpressionValidationError(
        "Expression type is required",
        "expressionType",
      );
    }

    if (!metric.expressionJson) {
      throw new MetricExpressionValidationError(
        "Expression JSON is required",
        "expressionJson",
      );
    }

    // Validar que el expressionType coincida con la estructura de expressionJson
    this.validateExpressionTypeMatch(
      metric.expressionType,
      metric.expressionJson,
    );

    // Validar la estructura específica según el tipo
    this.validateExpressionStructure(
      metric.expressionJson,
      metric.expressionType,
    );
  }

  /**
   * Valida que el expressionType coincida con la estructura de expressionJson
   */
  private static validateExpressionTypeMatch(
    expressionType: ExpressionType,
    expressionJson: ExpressionJson,
  ): void {
    const hasOp = "op" in expressionJson;
    const hasLeft = "left" in expressionJson;
    const hasRight = "right" in expressionJson;
    const hasSeries = "series" in expressionJson;
    const hasWindow = "window" in expressionJson;
    const hasOperands = "operands" in expressionJson;

    switch (expressionType) {
      case EXPRESSION_TYPES.SERIES_MATH:
        if (!hasOp || !hasLeft || !hasRight) {
          throw new MetricExpressionValidationError(
            `Expression type is '${expressionType}' but expressionJson does not match series_math structure (missing op, left, or right)`,
            "expressionJson",
          );
        }
        break;

      case EXPRESSION_TYPES.WINDOW_OP:
        if (!hasOp || !hasSeries || !hasWindow) {
          throw new MetricExpressionValidationError(
            `Expression type is '${expressionType}' but expressionJson does not match window_op structure (missing op, series, or window)`,
            "expressionJson",
          );
        }
        break;

      case EXPRESSION_TYPES.COMPOSITE:
        if (!hasOp || !hasOperands) {
          throw new MetricExpressionValidationError(
            `Expression type is '${expressionType}' but expressionJson does not match composite structure (missing op or operands)`,
            "expressionJson",
          );
        }
        break;

      default:
        throw new MetricExpressionValidationError(
          `Unknown expression type: ${expressionType}`,
          "expressionType",
        );
    }
  }

  /**
   * Valida la estructura específica de la expresión según su tipo
   */
  private static validateExpressionStructure(
    expressionJson: ExpressionJson,
    expressionType: ExpressionType,
  ): void {
    switch (expressionType) {
      case EXPRESSION_TYPES.SERIES_MATH:
        this.validateSeriesMathExpression(
          expressionJson as SeriesMathExpression,
        );
        break;

      case EXPRESSION_TYPES.WINDOW_OP:
        this.validateWindowOpExpression(expressionJson as WindowOpExpression);
        break;

      case EXPRESSION_TYPES.COMPOSITE:
        this.validateCompositeExpression(expressionJson as CompositeExpression);
        break;
    }
  }

  /**
   * Valida una expresión series_math
   */
  private static validateSeriesMathExpression(
    expression: SeriesMathExpression,
  ): void {
    if (!expression.op) {
      throw new MetricExpressionValidationError(
        "Series math expression must have an 'op' field",
        "expressionJson.op",
      );
    }

    if (!Object.values(SERIES_MATH_OPS).includes(expression.op)) {
      throw new MetricExpressionValidationError(
        `Invalid series math operation: ${expression.op}. Valid operations: ${Object.values(SERIES_MATH_OPS).join(", ")}`,
        "expressionJson.op",
      );
    }

    if (!expression.left) {
      throw new MetricExpressionValidationError(
        "Series math expression must have a 'left' operand",
        "expressionJson.left",
      );
    }

    if (!expression.right) {
      throw new MetricExpressionValidationError(
        "Series math expression must have a 'right' operand",
        "expressionJson.right",
      );
    }

    // Validar recursivamente los operandos
    this.validateOperand(expression.left, "left");
    this.validateOperand(expression.right, "right");

    // Validar scale si está presente
    if (expression.scale !== undefined) {
      if (typeof expression.scale !== "number" || expression.scale <= 0) {
        throw new MetricExpressionValidationError(
          "Scale must be a positive number if provided",
          "expressionJson.scale",
        );
      }
    }
  }

  /**
   * Valida una expresión window_op
   */
  private static validateWindowOpExpression(
    expression: WindowOpExpression,
  ): void {
    if (!expression.op) {
      throw new MetricExpressionValidationError(
        "Window operation expression must have an 'op' field",
        "expressionJson.op",
      );
    }

    if (!Object.values(WINDOW_OPS).includes(expression.op)) {
      throw new MetricExpressionValidationError(
        `Invalid window operation: ${expression.op}. Valid operations: ${Object.values(WINDOW_OPS).join(", ")}`,
        "expressionJson.op",
      );
    }

    if (!expression.series) {
      throw new MetricExpressionValidationError(
        "Window operation expression must have a 'series' field",
        "expressionJson.series",
      );
    }

    if (typeof expression.window !== "number" || expression.window <= 0) {
      throw new MetricExpressionValidationError(
        "Window must be a positive number",
        "expressionJson.window",
      );
    }

    // Validar recursivamente la serie
    this.validateOperand(expression.series, "series");
  }

  /**
   * Valida una expresión composite
   */
  private static validateCompositeExpression(
    expression: CompositeExpression,
  ): void {
    if (!expression.op) {
      throw new MetricExpressionValidationError(
        "Composite expression must have an 'op' field",
        "expressionJson.op",
      );
    }

    if (!Object.values(COMPOSITE_OPS).includes(expression.op)) {
      throw new MetricExpressionValidationError(
        `Invalid composite operation: ${expression.op}. Valid operations: ${Object.values(COMPOSITE_OPS).join(", ")}`,
        "expressionJson.op",
      );
    }

    if (!expression.operands || !Array.isArray(expression.operands)) {
      throw new MetricExpressionValidationError(
        "Composite expression must have an 'operands' array",
        "expressionJson.operands",
      );
    }

    if (expression.operands.length === 0) {
      throw new MetricExpressionValidationError(
        "Composite expression must have at least one operand",
        "expressionJson.operands",
      );
    }

    // Validar cada operando
    expression.operands.forEach((operand, index) => {
      this.validateOperand(operand, `operands[${index}]`);
    });
  }

  /**
   * Valida un operando (puede ser SeriesReference o ExpressionJson recursivo)
   */
  private static validateOperand(
    operand: { seriesCode?: string } | ExpressionJson,
    fieldPath: string,
  ): void {
    // Si tiene seriesCode, es una SeriesReference
    if ("seriesCode" in operand) {
      if (
        !operand.seriesCode ||
        typeof operand.seriesCode !== "string" ||
        operand.seriesCode.trim().length === 0
      ) {
        throw new MetricExpressionValidationError(
          `Series code must be a non-empty string`,
          `expressionJson.${fieldPath}.seriesCode`,
        );
      }
      return;
    }

    // Si no tiene seriesCode, debe ser una expresión anidada
    // Validar que tenga al menos un campo que indique que es una expresión válida
    const hasOp = "op" in operand;
    const hasLeft = "left" in operand;
    const hasRight = "right" in operand;
    const hasSeries = "series" in operand;
    const hasWindow = "window" in operand;
    const hasOperands = "operands" in operand;

    if (!hasOp) {
      throw new MetricExpressionValidationError(
        `Operand at '${fieldPath}' must be either a SeriesReference (with seriesCode) or an ExpressionJson (with op)`,
        `expressionJson.${fieldPath}`,
      );
    }

    // Validar recursivamente la expresión anidada
    // Determinar el tipo basándose en los campos presentes
    if (hasLeft && hasRight) {
      // Es series_math
      this.validateSeriesMathExpression(operand as SeriesMathExpression);
    } else if (hasSeries && hasWindow) {
      // Es window_op
      this.validateWindowOpExpression(operand as WindowOpExpression);
    } else if (hasOperands) {
      // Es composite
      this.validateCompositeExpression(operand as CompositeExpression);
    } else {
      throw new MetricExpressionValidationError(
        `Invalid nested expression structure at '${fieldPath}'`,
        `expressionJson.${fieldPath}`,
      );
    }
  }
}
