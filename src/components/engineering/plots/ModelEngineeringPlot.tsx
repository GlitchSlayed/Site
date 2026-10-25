// Model-driven plot: resolves a plot definition, sweeps parameters, and renders
// EngineeringPlot. Inputs are read from scoped state so multiple visualizations
// can share the same parameters.
import { useMemo } from 'react';
import type { EngineeringPlotConfig } from '../../../lib/engineering/types';
import { getParameter } from '../../../lib/engineering/scopedState';
import { getModel } from '../../../lib/engineering/registry';
import { getPlotDefinition, generateSeries, type PlotDefinition } from '../../../lib/engineering/plots/registry';
import { EngineeringPlot } from './EngineeringPlot';

function buildConfig(definition: PlotDefinition, inputs: Record<string, number>): EngineeringPlotConfig {
  const series = generateSeries(definition, inputs);
  return {
    title: definition.title,
    description: definition.description,
    xAxis: definition.xAxis,
    yAxis: definition.yAxis,
    series,
    legend: series.length > 1,
    tooltips: true,
  };
}

interface ModelEngineeringPlotProps {
  modelId: string;
  plotPresetId: string;
  scopeId: string;
  className?: string;
  height?: number;
}

export function ModelEngineeringPlot({
  modelId,
  plotPresetId,
  scopeId,
  className,
  height = 400,
}: ModelEngineeringPlotProps) {
  const model = getModel(modelId);
  const definition = getPlotDefinition(plotPresetId);

  if (!model) {
    return (
      <div className="eng-plot eng-plot-error" role="alert" aria-live="polite">
        Unknown engineering model: {modelId}
      </div>
    );
  }
  if (!definition || definition.modelId !== modelId) {
    return (
      <div className="eng-plot eng-plot-error" role="alert" aria-live="polite">
        Unknown plot preset: {plotPresetId}
      </div>
    );
  }

  // Read current parameter values from scoped state, falling back to defaults.
  const inputs: Record<string, number> = {};
  for (const param of model.parameters) {
    inputs[param.id] = getParameter(scopeId, param.id) ?? param.defaultValue;
  }

  const config = useMemo(() => buildConfig(definition, inputs), [
    definition,
    JSON.stringify(inputs),
  ]);

  return <EngineeringPlot config={config} className={className} height={height} />;
}
