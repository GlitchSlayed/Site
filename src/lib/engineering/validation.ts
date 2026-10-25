// Validation and edge-case handling for engineering inputs and outputs.

import type { EngineeringParameter } from './types';

const DEFAULT_TOLERANCE = 1e-9;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeInput(value: unknown, param: EngineeringParameter): number {
  const num = Number(value);
  if (!isFiniteNumber(num)) return param.defaultValue;
  return clamp(num, param.min, param.max);
}

export function validateInputs(
  inputs: Record<string, unknown>,
  parameters: EngineeringParameter[],
): { values: Record<string, number>; errors: Record<string, string> } {
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const param of parameters) {
    const raw = inputs[param.id];
    const num = Number(raw);
    if (raw === undefined || raw === null || raw === '') {
      values[param.id] = param.defaultValue;
      continue;
    }
    if (!isFiniteNumber(num)) {
      errors[param.id] = `${param.label} must be a finite number.`;
      values[param.id] = param.defaultValue;
      continue;
    }
    if (num < param.min || num > param.max) {
      errors[param.id] = `${param.label} must be between ${param.min} and ${param.max}${param.unit ? ` ${param.unit}` : ''}.`;
      values[param.id] = clamp(num, param.min, param.max);
      continue;
    }
    values[param.id] = num;
  }

  return { values, errors };
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return fallback;
  if (Math.abs(denominator) < DEFAULT_TOLERANCE) return fallback;
  const result = numerator / denominator;
  return isFiniteNumber(result) ? result : fallback;
}

export function safeResult(value: number, fallback = 0): number {
  return isFiniteNumber(value) ? value : fallback;
}

export function significantFigures(value: number, sigFigs: number): number {
  if (!isFiniteNumber(value) || value === 0) return value;
  if (sigFigs <= 0) return value;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const digits = magnitude - sigFigs + 1;
  const factor = Math.pow(10, digits);
  return Math.round(value / factor) * factor;
}

export function formatEngineering(value: number, sigFigs = 3): string {
  if (!isFiniteNumber(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs) / 3) * 3;
  const scaled = value / Math.pow(10, exponent);
  const prefixes: Record<string, string> = {
    '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '', '3': 'k', '6': 'M', '9': 'G', '12': 'T',
  };
  const prefix = prefixes[exponent] ?? `×10^${exponent}`;
  const formatted = significantFigures(scaled, sigFigs);
  return `${formatted}${prefix}`;
}
