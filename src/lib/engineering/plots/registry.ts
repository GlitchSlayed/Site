// Registry of model-driven plot definitions. Each definition describes how to
// turn a model's inputs into uPlot series by sweeping a parameter.
import type { EngineeringInputValues, PlotAxis, PlotSeries } from '../types';
import { getModel as getRegistryModel } from '../registry';
import { isFiniteNumber } from '../validation';

interface PlotSeriesSpec {
  outputId: string;
  label: string;
  mode?: 'lines' | 'markers' | 'lines+markers';
  color?: string;
}

export interface PlotDefinition {
  id: string;
  modelId: string;
  title: string;
  description?: string;
  sweepParam: string;
  xRange: [number, number];
  xAxis: PlotAxis;
  yAxis: PlotAxis;
  series: PlotSeriesSpec[];
  xSamples?: number;
}

function sweepValues(min: number, max: number, samples: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0 : i / (samples - 1);
    values.push(min + t * (max - min));
  }
  return values;
}

export function generateSeries(
  definition: PlotDefinition,
  inputs: EngineeringInputValues,
): PlotSeries[] {
  const model = getRegistryModel(definition.modelId);
  if (!model) return [];

  const samples = definition.xSamples ?? 200;
  const [xMin, xMax] = definition.xRange;
  const xValues = sweepValues(xMin, xMax, samples);

  if (!isFiniteNumber(xMin) || !isFiniteNumber(xMax) || xMin >= xMax) {
    console.warn(
      `[PlotRegistry] Invalid xRange [${xMin}, ${xMax}] for plot "${definition.id}".`,
    );
    return [];
  }

  const series: PlotSeries[] = [];
  for (const spec of definition.series) {
    const yValues: number[] = [];
    let hasValidData = false;
    for (const x of xValues) {
      const swept: EngineeringInputValues = { ...inputs, [definition.sweepParam]: x };
      let outputs: Record<string, { value: number }>;
      try {
        outputs = model.compute(swept);
      } catch {
        outputs = {};
      }
      const out = outputs[spec.outputId];
      const value = out && typeof out.value === 'number' ? out.value : NaN;
      yValues.push(isFiniteNumber(value) ? value : NaN);
      if (isFiniteNumber(value)) hasValidData = true;
    }
    if (!hasValidData) {
      console.warn(
        `[PlotRegistry] No valid data points for series "${spec.label}" in plot "${definition.id}".`,
      );
    }
    series.push({
      id: spec.outputId,
      label: spec.label,
      x: xValues,
      y: yValues,
      mode: spec.mode ?? 'lines',
      color: spec.color,
    });
  }
  return series;
}

const plotDefinitions = new Map<string, PlotDefinition>();

export function registerPlotDefinition(definition: PlotDefinition): void {
  plotDefinitions.set(definition.id, definition);
}

export function getPlotDefinition(id: string): PlotDefinition | undefined {
  return plotDefinitions.get(id);
}

export function listPlotDefinitions(): PlotDefinition[] {
  return Array.from(plotDefinitions.values());
}
