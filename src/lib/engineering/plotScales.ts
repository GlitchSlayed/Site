import type { Scale } from './types';
export function axisExtent(values: number[], scale: Scale = 'linear'): [number, number] {
  let min = Infinity, max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value) || (scale === 'log' && value <= 0)) continue;
    min = Math.min(min, value); max = Math.max(max, value);
  }
  if (!Number.isFinite(min)) return scale === 'log' ? [1, 10] : [0, 1];
  if (min === max) return scale === 'log' ? [min / 10, max * 10] : [min - 1, max + 1];
  return [min, max];
}
export function panRange(min: number, max: number, fraction: number, scale: Scale): [number, number] {
  const a = scale === 'log' ? Math.log(min) : min;
  const b = scale === 'log' ? Math.log(max) : max;
  const shift = (b - a) * fraction;
  return scale === 'log' ? [Math.exp(a + shift), Math.exp(b + shift)] : [a + shift, b + shift];
}
export function zoomRange(min: number, max: number, anchor: number, factor: number, scale: Scale): [number, number] {
  const a = scale === 'log' ? Math.log(min) : min;
  const b = scale === 'log' ? Math.log(max) : max;
  const c = scale === 'log' ? Math.log(anchor) : anchor;
  const lo = c + (a - c) * factor, hi = c + (b - c) * factor;
  return scale === 'log' ? [Math.exp(lo), Math.exp(hi)] : [lo, hi];
}
