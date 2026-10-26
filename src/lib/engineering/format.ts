// Unit-aware result formatting for engineering visualization outputs.
// Uses declared model output metadata as the authoritative source for units.
//
// Precision standard: maximum 5 decimal places, default 4.
// Trailing zeros are removed. Thousands separators used for large values.
import { convert, UNITS } from './units';
import { isFiniteNumber, significantFigures } from './validation';

export interface FormatResultOptions {
  value: number;
  unit?: string;
  symbol?: string;
  label?: string;
  significantFigures?: number;
  engineeringNotation?: boolean;
  displayUnit?: string; // override the declared unit for display
  showUnit?: boolean;
  showLabel?: boolean;
  maxDecimals?: number; // hard cap on decimal places (default 5)
}

export interface FormattedResult {
  label: string;
  value: string;
  unit: string;
  symbol: string;
  displayText: string;
  fullText: string;
}

/** Hard cap on decimal places across the framework. */
export const MAX_DECIMALS = 5;

/** Default significant figures for ordinary engineering results. */
const DEFAULT_SIG_FIGS = 4;

/** SI prefix characters by power-of-ten exponent (step of 3). */
const SI_PREFIXES: Record<number, string> = {
  '-12': 'p',
  '-9': 'n',
  '-6': 'µ',
  '-3': 'm',
  '0': '',
  '3': 'k',
  '6': 'M',
  '9': 'G',
  '12': 'T',
};

/**
 * Format a number into a clean, artifact-free string for presentation.
 *
 * - Rounds only for presentation; internal precision is untouched.
 * - Defaults to 4 significant figures with trailing zeros trimmed.
 * - Caps decimal places at maxDecimals (default 5).
 * - Uses SI-prefix / scientific notation for very small or large values.
 * - Optionally groups thousands.
 *
 * Returns '—' for non-finite values.
 */
export interface FormatNumberOptions {
  sigFigs?: number;        // significant figures (default 4)
  maxDecimals?: number;    // hard cap on decimal places (default 5)
  thousands?: boolean;     // add thousands separators
  engineering?: boolean;   // force SI-prefix / scientific notation
  forceDecimals?: number;  // exact decimal places (overrides sigFigs)
}

export function formatNumber(
  value: number,
  {
    sigFigs = DEFAULT_SIG_FIGS,
    maxDecimals = MAX_DECIMALS,
    thousands = false,
    engineering = false,
    forceDecimals,
  }: FormatNumberOptions = {},
): string {
  if (!isFiniteNumber(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);

  // Engineering / SI-prefix notation when explicitly requested.
  // Large or small numbers format cleanly as decimals unless engineering is true.
  if (engineering) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = value / Math.pow(10, exponent);
    const prefix = SI_PREFIXES[exponent] ?? `×10^${exponent}`;
    const scaledStr = formatNumber(scaled, {
      sigFigs,
      maxDecimals,
      thousands: false,
      engineering: false,
      forceDecimals: forceDecimals !== undefined ? forceDecimals : undefined,
    });
    return `${scaledStr}${prefix}`;
  }

  // Determine decimal places needed for the requested significant figures.
  const magnitude = Math.floor(Math.log10(abs));
  const decimals =
    forceDecimals !== undefined
      ? forceDecimals
      : Math.max(0, sigFigs - 1 - magnitude);
  const cappedDecimals = Math.min(decimals, maxDecimals);

  // Round via toFixed to avoid binary float representation artifacts.
  const rounded = Number(value.toFixed(cappedDecimals));
  let str = rounded.toFixed(cappedDecimals);

  // Trim trailing zeros but keep at least one decimal for non-integers.
  str = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

  if (thousands && Math.abs(rounded) >= 1000) {
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    str = parts.join('.');
  }

  return str;
}

/**
 * Format a numerical engineering result with units, SI prefixes, and
 * configurable significant figures.
 *
 * The unit is taken from the declared output metadata unless overridden by
 * `displayUnit`. Dimensionless quantities are shown without unit brackets.
 */
export function formatResult({
  value,
  unit,
  symbol = '',
  label = '',
  significantFigures: sigFigs = DEFAULT_SIG_FIGS,
  engineeringNotation = false,
  displayUnit,
  showUnit = true,
  showLabel = true,
  maxDecimals = MAX_DECIMALS,
}: FormatResultOptions): FormattedResult {
  if (!isFiniteNumber(value)) {
    const displayText = showLabel ? `${label}: —` : '—';
    return {
      label,
      value: '—',
      unit: '',
      symbol,
      displayText,
      fullText: displayText,
    };
  }

  // Determine the display unit. If a display override is given and it's
  // compatible with the declared unit, convert the value.
  let displayValue = value;
  let finalUnit = unit || '';
  let finalSymbol = '';

  // Resolve the unit symbol from the UNITS registry (not from the quantity
  // symbol, which is a different concept).
  const resolveUnitSymbol = (u: string): string => {
    const def = UNITS[u];
    return def ? def.symbol : u;
  };

  // Auto-select an SI-prefixed unit when no explicit override is given and
  // the value magnitude warrants it (e.g. 686500 N → 686.5 kN).
  if (!displayUnit && unit && UNITS[unit]) {
    const abs = Math.abs(value);
    if (abs >= 1000 || (abs > 0 && abs < 1)) {
      const exponent = Math.floor(Math.log10(abs) / 3) * 3;
      const prefixChars: Record<number, string> = {
        '-12': 'p', '-9': 'n', '-6': 'µ', '-3': 'm', '0': '', '3': 'k', '6': 'M', '9': 'G', '12': 'T',
      };
      const prefix = prefixChars[exponent];
      if (prefix) {
        const candidate = `${prefix}${unit}` as string;
        if (UNITS[candidate] && UNITS[candidate].dimension === UNITS[unit].dimension) {
          displayValue = convert(value, unit, candidate);
          finalUnit = candidate;
          finalSymbol = UNITS[candidate].symbol;
        }
      }
    }
  }

  if (displayUnit && unit) {
    const from = UNITS[unit];
    const to = UNITS[displayUnit];
    if (from && to && from.dimension === to.dimension) {
      displayValue = convert(value, unit, displayUnit);
      finalUnit = displayUnit;
      finalSymbol = resolveUnitSymbol(displayUnit);
    }
  } else if (unit && !finalSymbol) {
    finalSymbol = resolveUnitSymbol(unit);
  }

  // Format the number with precision limits.
  let formatted: string;
  if (engineeringNotation) {
    formatted = formatNumber(displayValue, { sigFigs, maxDecimals, engineering: true });
  } else {
    formatted = formatNumber(displayValue, { sigFigs, maxDecimals, thousands: Math.abs(displayValue) >= 1000 });
  }

  // Build the unit string. Dimensionless units are shown without brackets.
  const isDimensionless = finalUnit === '-';
  const unitStr = showUnit && finalSymbol && !isDimensionless ? `[${finalSymbol}]` : '';

  // Build the value-with-unit string.
  const valueWithUnit = unitStr ? `${formatted} ${unitStr}` : formatted;

  const displayText = showLabel ? `${label}: ${valueWithUnit}` : valueWithUnit;
  const fullText = label ? `${label}: ${valueWithUnit} ${unitStr}`.trim() : valueWithUnit;

  return {
    label,
    value: formatted,
    unit: finalUnit,
    symbol: finalSymbol,
    displayText,
    fullText,
  };
}

/**
 * Format a percentage change relative to a reference value.
 * Returns null if the reference is zero or nonfinite.
 */
export function formatPercentageChange(
  value: number,
  reference: number,
  sigFigs = 3,
): string | null {
  if (!isFiniteNumber(value) || !isFiniteNumber(reference)) return null;
  if (Math.abs(reference) < 1e-9) return null;
  const change = ((value - reference) / reference) * 100;
  const sign = change >= 0 ? '+' : '-';
  return `(${sign}${significantFigures(Math.abs(change), sigFigs)}%)`;
}
