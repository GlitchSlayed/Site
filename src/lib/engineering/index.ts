// Public API for the engineering visualization framework.
export type {
  EngineeringModel,
  EngineeringParameter,
  EngineeringInputValues,
  EngineeringOutputs,
  EngineeringOutputValue,
  PlotSeries,
  PlotAxis,
  PlotReferenceLine,
  PlotShadedRegion,
  EngineeringPlotConfig,
  ComparisonRow,
  EngineeringComparisonConfig,
  Scale,
} from './types';
export { clamp, sanitizeInput, validateInputs, safeDivide, safeResult, significantFigures, formatEngineering } from './validation';
export { convert, getUnit, UNITS, SI_DENSITY, SI_SPEED, SI_LENGTH, SI_AREA, SI_MASS } from './units';
export { getModel, listModels, getPreset, listPresets } from './registry';
export { registerParameter, getParameter, setParameter, subscribeParameter, destroyScope } from './scopedState';
