// Model-driven plot: resolves a plot definition, sweeps parameters, and renders
// EngineeringPlot. Inputs are read from scoped state so multiple visualizations
// can share the same parameters.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineeringPlotConfig } from '../../../lib/engineering/types';
import { getParameter, subscribeParameter } from '../../../lib/engineering/scopedState';
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

  // Version state that increments whenever any subscribed parameter changes,
  // forcing a re-render that re-reads current parameter values.
  const [version, setVersion] = useState(0);

  // Subscribe to all model parameters so slider changes propagate to the plot.
  useEffect(() => {
    const unsubscribes = model.parameters.map((param) =>
      subscribeParameter(scopeId, param.id, () => setVersion((v) => v + 1))
    );
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [scopeId, model]);

  // Read current parameter values from scoped state, falling back to defaults.
  const inputs: Record<string, number> = {};
  for (const param of model.parameters) {
    inputs[param.id] = getParameter(scopeId, param.id) ?? param.defaultValue;
  }

  const config = useMemo(() => buildConfig(definition, inputs), [definition, version]);

  return <EngineeringPlot config={config} className={className} height={height} />;
}
