// Unit handling and conversions. All internal calculations use SI units.

export interface UnitDefinition {
  id: string;
  label: string;
  symbol: string;
  dimension: 'length' | 'mass' | 'time' | 'speed' | 'acceleration' | 'force' | 'pressure' | 'density' | 'area' | 'dimensionless';
  // Convert a value in this unit to the SI base value.
  toSI: (value: number) => number;
  // Convert a SI base value to this unit.
  fromSI: (value: number) => number;
}

const KNOTS_TO_MPS = 0.514444;
const FOOT_TO_M = 0.3048;
const POUND_TO_KG = 0.45359237;
const INCH_TO_M = 0.0254;

export const UNITS: Record<string, UnitDefinition> = {
  // Length
  m: { id: 'm', label: 'meter', symbol: 'm', dimension: 'length', toSI: (v) => v, fromSI: (v) => v },
  km: { id: 'km', label: 'kilometer', symbol: 'km', dimension: 'length', toSI: (v) => v * 1000, fromSI: (v) => v / 1000 },
  ft: { id: 'ft', label: 'foot', symbol: 'ft', dimension: 'length', toSI: (v) => v * FOOT_TO_M, fromSI: (v) => v / FOOT_TO_M },
  // Mass
  kg: { id: 'kg', label: 'kilogram', symbol: 'kg', dimension: 'mass', toSI: (v) => v, fromSI: (v) => v },
  lb: { id: 'lb', label: 'pound', symbol: 'lb', dimension: 'mass', toSI: (v) => v * POUND_TO_KG, fromSI: (v) => v / POUND_TO_KG },
  // Speed
  'm/s': { id: 'm/s', label: 'meters per second', symbol: 'm/s', dimension: 'speed', toSI: (v) => v, fromSI: (v) => v },
  kt: { id: 'kt', label: 'knots', symbol: 'kt', dimension: 'speed', toSI: (v) => v * KNOTS_TO_MPS, fromSI: (v) => v / KNOTS_TO_MPS },
  // Density
  'kg/m³': { id: 'kg/m³', label: 'kilograms per cubic meter', symbol: 'kg/m³', dimension: 'density', toSI: (v) => v, fromSI: (v) => v },
  'slug/ft³': { id: 'slug/ft³', label: 'slugs per cubic foot', symbol: 'slug/ft³', dimension: 'density', toSI: (v) => v * 515.378818, fromSI: (v) => v / 515.378818 },
  // Area
  'm²': { id: 'm²', label: 'square meters', symbol: 'm²', dimension: 'area', toSI: (v) => v, fromSI: (v) => v },
  'ft²': { id: 'ft²', label: 'square feet', symbol: 'ft²', dimension: 'area', toSI: (v) => v * INCH_TO_M * INCH_TO_M * 144, fromSI: (v) => v / (INCH_TO_M * INCH_TO_M * 144) },
  // Dimensionless
  '-': { id: '-', label: 'dimensionless', symbol: '-', dimension: 'dimensionless', toSI: (v) => v, fromSI: (v) => v },
};

export function convert(value: number, fromUnitId: string, toUnitId: string): number {
  const from = UNITS[fromUnitId];
  const to = UNITS[toUnitId];
  if (!from || !to) return value;
  if (from.dimension !== to.dimension) return value;
  const si = from.toSI(value);
  return to.fromSI(si);
}

export function getUnit(unitId: string): UnitDefinition | undefined {
  return UNITS[unitId];
}

export const SI_DENSITY = 'kg/m³';
export const SI_SPEED = 'm/s';
export const SI_LENGTH = 'm';
export const SI_AREA = 'm²';
export const SI_MASS = 'kg';
