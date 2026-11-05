// A small mathematical grammar, not JavaScript evaluation. No eval/Function/property access.
export type MathFn = (x: number, params?: Record<string, number>) => number;
type Evaluation = (x: number, params: Record<string, number>) => number;
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, atan2: Math.atan2, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, log: Math.log, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round,
  floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const MAX_SAMPLES = 100_000;
export function linspace(min: number, max: number, count = 200): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Domain bounds must be finite.');
  if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLES) throw new Error(`Sample count must be an integer from 1 to ${MAX_SAMPLES}.`);
  if (count === 1) return [min];
  return Array.from({ length: count }, (_, i) => min + (max - min) * i / (count - 1));
}
/** ^ and ** are right-associative. Power binds more tightly than unary minus:
 * -x^2 = -(x^2), while 2^-2 = 0.25. e is Euler's constant; use another
 * parameter name (e.g. efficiency) or explicitly list 'e' in paramNames.
 */
export function compileExpression(expr: string, paramNames: string[] = []): MathFn {
  if (expr.length > 4096) throw new Error('Expression is too long.');
  const tokens: string[] = [];
  const token = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(\*\*|[+\-*/^(),.]))/y;
  let offset = 0;
  while (offset < expr.length) {
    if (!expr.slice(offset).trim()) break;
    token.lastIndex = offset;
    const match = token.exec(expr);
    if (!match) throw new Error(`Invalid mathematical token at position ${offset}.`);
    tokens.push(match[1] ?? match[2] ?? match[3]);
    offset = token.lastIndex;
  }
  let index = 0, depth = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = (value: string) => { if (take() !== value) throw new Error(`Expected '${value}'.`); };
  function primary(): Evaluation {
    if (++depth > 128) throw new Error('Expression nesting is too deep.');
    try {
      const value = take();
      if (value === '(') { const result = sum(); expect(')'); return result; }
      if (value !== undefined && /^(?:\d|\.\d)/.test(value)) {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error('Numeric literal must be finite.');
        return () => number;
      }
      if (!value || !/^[A-Za-z_]\w*$/.test(value)) throw new Error('Expected a number, parameter, or function.');
      let name = value, qualified = false;
      if (name === 'Math') { expect('.'); name = take(); qualified = true; }
      if (peek() === '(') {
        if (!Object.hasOwn(FUNCTIONS, name)) throw new Error(`Unknown mathematical function '${name}'.`);
        take();
        const args: Evaluation[] = [];
        if (peek() !== ')') { args.push(sum()); while (peek() === ',') { take(); args.push(sum()); } }
        expect(')');
        const arity = name === 'pow' || name === 'atan2' ? 2 : 1;
        if (name === 'min' || name === 'max' ? args.length === 0 : args.length !== arity) throw new Error(`Invalid argument count for '${name}'.`);
        return (x, params) => FUNCTIONS[name](...args.map(arg => arg(x, params)));
      }
      const constant = name.toLowerCase();
      if (Object.hasOwn(CONSTANTS, constant) && (qualified || !paramNames.includes(name))) return () => CONSTANTS[constant];
      if (qualified) throw new Error(`Unknown mathematical constant '${name}'.`);
      if (name === 'x') return x => x;
      return (_x, params) => Object.hasOwn(params, name) && typeof params[name] === 'number' ? params[name] : NaN;
    } finally { depth--; }
  }
  function power(): Evaluation {
    const left = primary();
    if (peek() === '^' || peek() === '**') { take(); const right = unary(); return (x, p) => left(x, p) ** right(x, p); }
    return left;
  }
  function unary(): Evaluation {
    if (peek() === '+' || peek() === '-') {
      if (++depth > 128) throw new Error('Expression nesting is too deep.');
      const sign = take(), operand = unary(); depth--;
      return (x, p) => (sign === '-' ? -1 : 1) * operand(x, p);
    }
    return power();
  }
  function product(): Evaluation {
    let left = unary();
    while (peek() === '*' || peek() === '/') {
      const operator = take(), a = left, b = unary();
      left = (x, p) => operator === '*' ? a(x, p) * b(x, p) : a(x, p) / b(x, p);
    }
    return left;
  }
  function sum(): Evaluation {
    let left = product();
    while (peek() === '+' || peek() === '-') {
      const operator = take(), a = left, b = product();
      left = (x, p) => operator === '+' ? a(x, p) + b(x, p) : a(x, p) - b(x, p);
    }
    return left;
  }
  const evaluate = sum();
  if (index !== tokens.length) throw new Error(`Unexpected token '${peek()}'.`);
  return (x, params = {}) => { const result = evaluate(x, params); return Number.isFinite(result) ? result : NaN; };
}
export function sweepFunction(fn: MathFn | string, domain: [number, number], samples = 200, params: Record<string, number> = {}): { x: number[]; y: number[] } {
  const evaluate = typeof fn === 'string' ? compileExpression(fn, Object.keys(params)) : fn;
  const x = linspace(domain[0], domain[1], samples);
  return { x, y: x.map(value => { const result = evaluate(value, params); return Number.isFinite(result) ? result : NaN; }) };
}
