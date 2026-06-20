export interface CalcResult {
  expression: string;
  result: string;
}

const CALC_RE = /^\s*([-+]?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*([-+]?\d+(?:\.\d+)?)\s*$/;

export function evaluateCalcExpression(rawExpression: string): CalcResult | null {
  const expression = rawExpression.trim();
  const match = CALC_RE.exec(expression);
  if (!match) return null;

  const left = Number(match[1]);
  const right = Number(match[3]);
  const operator = normalizeOperator(match[2]);
  if (operator === '/' && right === 0) return null;

  const value = calculate(left, right, operator);
  const result = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));

  return {
    expression,
    result,
  };
}

export function calculate(left: number, right: number, operator: '+' | '-' | '*' | '/') {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
  }
}

export function normalizeOperator(operator: string): '+' | '-' | '*' | '/' {
  if (operator === 'x' || operator === '×') return '*';
  if (operator === '÷') return '/';
  if (operator === '+' || operator === '-' || operator === '*' || operator === '/') return operator;
  return '+';
}
