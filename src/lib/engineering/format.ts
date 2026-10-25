// Unit-aware result formatting for engineering visualization outputs.
// Uses declared model output metadata as the authoritative source for units.
//
// Precision standard: maximum 5 decimal places, default 4.
// Trailing zeros are removed. Thousands separators used for large values.
import { convert, UNITS } from './units';
import { formatEngineering, isFiniteNumber, significantFigures } from './validation';

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

// Group thousands with narrow no-break spaces for readability.
function groupThousands(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Hard cap on decimal places across the framework. */
const MAX_DECIMALS = 5;

/** Default significant figures for ordinary engineering results. */
const DEFAULT_SIG_FIGS = 4;

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
    formatted = formatEngineering(displayValue, sigFigs);
  } else {
    const rounded = significantFigures(displayValue, sigFigs);
    // Cap decimal places at maxDecimals.
    const decimalCap = Math.pow(10, maxDecimals);
    const capped = Math.round(rounded * decimalCap) / decimalCap;
    // Use grouping for large numbers, plain for small.
    if (Math.abs(capped) >= 1000) {
      formatted = groupThousands(capped);
    } else {
      // Remove trailing zeros but keep at least one decimal for non-integers.
      const str = capped.toString();
      if (str.includes('.')) {
        formatted = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
      } else {
        formatted = str;
      }
    }
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

/** Maximum decimal places enforced by the framework. */
export { MAX_DECIMALS };
