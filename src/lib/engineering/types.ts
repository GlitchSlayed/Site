// Core types for the engineering visualization framework.
// All calculations are independent of rendering components.

export type Scale = 'linear' | 'log';

export interface EngineeringParameter {
  id: string;
  label: string;
  symbol?: string;
  description?: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  scale?: Scale;
}

export interface EngineeringInputValues {
  [paramId: string]: number;
}

export interface EngineeringOutputValue {
  value: number;
  unit?: string;
  symbol?: string;
  label?: string;
  significantFigures?: number;
  engineeringNotation?: boolean;
}

export interface EngineeringOutputs {
  [outputId: string]: EngineeringOutputValue;
}

export interface EngineeringModel<Inputs extends EngineeringInputValues = EngineeringInputValues> {
  id: string;
  title: string;
  description?: string;
  assumptions?: string[];
  limitations?: string[];
  parameters: EngineeringParameter[];
  outputs: Record<string, { label: string; unit?: string; symbol?: string; significantFigures?: number; engineeringNotation?: boolean }>;
  compute(inputs: Inputs): EngineeringOutputs;
  presets?: Record<string, Partial<Inputs>>;
  reference?: Partial<Inputs>;
}

export interface PlotSeries {
  id: string;
  label: string;
  x: number[];
  y: number[];
  mode?: 'lines' | 'markers' | 'lines+markers';
  color?: string;
  fill?: boolean | string;
  visible?: boolean;
}

export interface PlotAxis {
  title: string;
  unit?: string;
  type?: 'linear' | 'log';
  range?: [number, number];
}

export interface PlotReferenceLine {
  id: string;
  label: string;
  value: number;
  axis: 'x' | 'y';
  color?: string;
  dash?: 'dash' | 'dot' | 'dashdot';
}

export interface PlotShadedRegion {
  id: string;
  label?: string;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  xRange?: [number, number];
  yRange?: [number, number];
  color?: string;
  opacity?: number;
}

export interface EngineeringPlotConfig {
  title?: string;
  description?: string;
  xAxis: PlotAxis;
  yAxis: PlotAxis;
  series: PlotSeries[];
  referenceLines?: PlotReferenceLine[];
  shadedRegions?: PlotShadedRegion[];
  legend?: boolean;
  tooltips?: boolean;
  width?: number;
  height?: number;
}

export interface ComparisonRow {
  id: string;
  label: string;
  unit?: string;
  values: (string | number)[];
  highlight?: boolean;
  // Optional explicit percentage annotations per column index.
  // Format: "(+15.1%)", "(-8.4%)", "(±2.0%)". Not auto-calculated.
  annotations?: Record<number, string>;
}

export interface EngineeringComparisonConfig {
  title?: string;
  configurations: { id: string; label: string; color?: string }[];
  rows: ComparisonRow[];
  referenceConfigId?: string;
  showPercentageChange?: boolean;
  sortable?: boolean;
  notes?: { rowId: string; title: string; body: string }[];
}
