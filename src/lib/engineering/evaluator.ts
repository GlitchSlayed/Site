// Safe mathematical expression evaluator and function sweeper for interactive MDX plots.
// Supports both JavaScript function callbacks (x, params) => number and math expressions.

export type MathFn = (x: number, params?: Record<string, number>) => number;

const DISALLOWED_IDENTIFIERS = /\b(window|document|process|globalThis|fetch|eval|Function|XMLHttpRequest|importScripts|localStorage|sessionStorage|cookie|top|parent|opener)\b/i;

/**
 * Generate an array of N evenly-spaced values over [min, max].
 */
export function linspace(min: number, max: number, count = 200): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  const result: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = min + i * step;
  }
  return result;
}

/**
 * Compile a math expression string into a function (x, params) => number.
 * Supported functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh,
 * exp, log, log10, log2, sqrt, cbrt, abs, round, floor, ceil, min, max, pi, e.
 * Supported operators: +, -, *, /, ^ (exponent), (, ).
 */
export function compileExpression(expr: string, _paramNames?: string[]): MathFn {
  if (DISALLOWED_IDENTIFIERS.test(expr)) {
    throw new Error(`Security error: Disallowed identifier in mathematical expression "${expr}"`);
  }

  // Normalize ^ to ** for exponentiation
  const sanitized = expr
    .replace(/\^/g, '**')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\be\b/gi, 'Math.E')
    .replace(
      /\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|log|log10|log2|sqrt|cbrt|abs|round|floor|ceil|min|max)\b/g,
      'Math.$1',
    );

  // Validate allowed characters to prevent arbitrary code injection
  const validPattern = /^[0-9a-zA-Z_\s\+\-\*\/\.\(\)\,\$\:]+$/;
  if (!validPattern.test(sanitized)) {
    throw new Error(`Invalid mathematical expression: "${expr}"`);
  }

  try {
    // Function constructor with Math scope and params parameter
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('x', 'params', `
      with (Math) {
        with (params || {}) {
          try {
            return ${sanitized};
          } catch (e) {
            return NaN;
          }
        }
      }
    `);
    return (x: number, params?: Record<string, number>) => {
      const val = fn(x, params || {});
      return typeof val === 'number' && Number.isFinite(val) ? val : NaN;
    };
  } catch (err) {
    throw new Error(`Failed to compile math expression "${expr}": ${(err as Error).message}`);
  }
}

/**
 * Sweep a function across an X domain and return { x: number[], y: number[] }.
 */
export function sweepFunction(
  fn: MathFn | string,
  domain: [number, number],
  samples = 200,
  params: Record<string, number> = {},
): { x: number[]; y: number[] } {
  const evaluate = typeof fn === 'string' ? compileExpression(fn) : fn;
  const x = linspace(domain[0], domain[1], samples);
  const y = new Array(samples);

  for (let i = 0; i < samples; i++) {
    const val = evaluate(x[i], params);
    y[i] = Number.isFinite(val) ? val : NaN;
  }

  return { x, y };
}
