// Model-driven plot: resolves a plot definition, sweeps parameters, and renders
// EngineeringPlot. Inputs are read from scoped state so multiple visualizations
// can share the same parameters.
//
// The calculation model comes from the plot definition (definition.modelId),
// while the parameter state is shared via scopeId. This lets a plot definition
// use a different calculation model than the parent component's modelId prop
// (e.g. drag polar uses dragPolarModel while the explorer uses aircraftPerformanceModel).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineeringPlotConfig } from '../../../lib/engineering/types';
import { getParameter, subscribeParameter } from '../../../lib/engineering/scopedState';
import { getModel } from '../../../lib/engineering/registry';
import { getPlotDefinition, generateSeries, type PlotDefinition } from '../../../lib/engineering/plots/registry';
import { EngineeringPlot } from './EngineeringPlot';

interface InspectorMetric {
  id: string;
  label: string;
  unit?: string;
  significantFigures?: number;
}

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
  inspectable?: boolean;
  inspectorMetrics?: InspectorMetric[];
}

export function ModelEngineeringPlot({
  modelId,
  plotPresetId,
  scopeId,
  className,
  height = 400,
  inspectable = false,
  inspectorMetrics = [],
}: ModelEngineeringPlotProps) {
  const definition = getPlotDefinition(plotPresetId);

  if (!definition) {
    return (
      <div className="eng-plot eng-plot-error" role="alert" aria-live="polite">
        Unknown plot preset: {plotPresetId}
      </div>
    );
  }

  // The calculation model is determined by the plot definition, not the prop.
  // This allows the drag polar definition to use dragPolarModel while the
  // parent explorer passes aircraftPerformanceModel for shared parameter state.
  const calcModel = getModel(definition.modelId);

  if (!calcModel) {
    return (
      <div className="eng-plot eng-plot-error" role="alert" aria-live="polite">
        Calculation model not found for plot preset "{plotPresetId}": {definition.modelId}
      </div>
    );
  }

  // Version state that increments whenever any subscribed parameter changes,
  // forcing a re-render that re-reads current parameter values.
  const [version, setVersion] = useState(0);

  // Subscribe to all calculation-model parameters so slider changes propagate.
  useEffect(() => {
    const unsubscribes = calcModel.parameters.map((param) =>
      subscribeParameter(scopeId, param.id, () => setVersion((v) => v + 1))
    );
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [scopeId, calcModel]);

  // Read current parameter values from scoped state, falling back to defaults.
  // Only the calculation model's parameters are needed as inputs.
  const inputs: Record<string, number> = {};
  for (const param of calcModel.parameters) {
    inputs[param.id] = getParameter(scopeId, param.id) ?? param.defaultValue;
  }

  const config = useMemo(() => buildConfig(definition, inputs), [definition, version]);

  // Inspector state: selected point and computed metric values at that point.
  const [inspectorPoint, setInspectorPoint] = useState<{
    x: number;
    y: number;
    seriesIndex: number;
    seriesLabel: string;
  } | null>(null);
  const [inspectorComparisonPoint, setInspectorComparisonPoint] = useState<{
    x: number;
    y: number;
    seriesIndex: number;
    seriesLabel: string;
  } | null>(null);
  const [inspectorValues, setInspectorValues] = useState<Record<string, number>>({});
  const [inspectorComparisonValues, setInspectorComparisonValues] = useState<Record<string, number>>({});

  const computeMetricValues = useCallback(
    (x: number): Record<string, number> => {
      // Compute model outputs at the selected X (sweep parameter value).
      const swept: Record<string, number> = { ...inputs, [definition.sweepParam]: x };
      let outputs: Record<string, { value: number }>;
      try {
        outputs = calcModel.compute(swept);
      } catch {
        outputs = {};
      }

      const values: Record<string, number> = {};
      for (const metric of inspectorMetrics) {
        const out = outputs[metric.id];
        values[metric.id] = out && typeof out.value === 'number' ? out.value : 0;
      }
      return values;
    },
    [calcModel, definition, inputs, inspectorMetrics],
  );

  const handlePointSelect = useCallback(
    (x: number, y: number, seriesIndex: number, kind: 'primary' | 'comparison') => {
      const values = computeMetricValues(x);
      const series = config.series;
      const s = series[seriesIndex];
      const point = {
        x,
        y,
        seriesIndex,
        seriesLabel: s?.label ?? 'Series',
      };
      if (kind === 'comparison') {
        setInspectorComparisonPoint(point);
        setInspectorComparisonValues(values);
      } else {
        setInspectorPoint(point);
        setInspectorValues(values);
      }
    },
    [calcModel, definition, inputs, inspectorMetrics, config.series, computeMetricValues],
  );

  return (
    <EngineeringPlot
      config={config}
      className={className}
      height={height}
      inspectable={inspectable}
      inspectorSeriesIndex={0}
      inspectorMetrics={inspectorMetrics}
      inspectorMetricValues={inspectorValues}
      inspectorComparisonValues={inspectorComparisonValues}
      onPointSelect={inspectable ? handlePointSelect : undefined}
    />
  );
}
