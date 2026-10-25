// Unit-aware result formatting for engineering visualization outputs.
// Uses declared model output metadata as the authoritative source for units.
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

/**
 * Format a numerical engineering result with units, SI prefixes, and
 * configurable significant figures.
 *
 * The unit is taken from the declared output metadata unless overridden by
 * `displayUnit`. Dimensionless quantities are shown without unit brackets.
 * Percentages are supported for fractional quantities (e.g. structural mass
 * penalty of 0.05 → +5.0%).
 */
export function formatResult({
  value,
  unit,
  symbol = '',
  label = '',
  significantFigures: sigFigs = 4,
  engineeringNotation = false,
  displayUnit,
  showUnit = true,
  showLabel = true,
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

  if (displayUnit && unit) {
    const from = UNITS[unit];
    const to = UNITS[displayUnit];
    if (from && to && from.dimension === to.dimension) {
      displayValue = convert(value, unit, displayUnit);
      finalUnit = displayUnit;
      finalSymbol = resolveUnitSymbol(displayUnit);
    }
  } else if (unit) {
    finalSymbol = resolveUnitSymbol(unit);
  }

  // Format the number.
  let formatted: string;
  if (engineeringNotation) {
    formatted = formatEngineering(displayValue, sigFigs);
  } else {
    const rounded = significantFigures(displayValue, sigFigs);
    // Use grouping for large numbers, plain for small.
    if (Math.abs(rounded) >= 1000) {
      formatted = groupThousands(rounded);
    } else {
      formatted = rounded.toString();
    }
  }

  // Build the unit string.
  const unitStr = showUnit && finalSymbol ? `[${finalSymbol}]` : '';

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
  return `${sign}${significantFigures(Math.abs(change), sigFigs)}%`;
}
