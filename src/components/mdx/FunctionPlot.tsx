import React, { useEffect, useMemo, useState } from 'react';
import type { PlotAxis, PlotReferenceLine, PlotShadedRegion, EngineeringPlotConfig, PlotSeries } from '../../lib/engineering/types';
import { EngineeringPlot } from '../engineering/plots/EngineeringPlot';
import { getSeriesColor } from '../../lib/engineering/colormaps';
import { sweepFunction, type MathFn } from '../../lib/engineering/evaluator';
import { subscribeParameter } from '../../lib/engineering/scopedState';

export interface FunctionEntry {
  fn: string | MathFn;
  label?: string;
  color?: string;
  mode?: 'lines' | 'markers' | 'lines+markers';
}

export interface FunctionPlotProps {
  title?: string;
  description?: string;
  /** Single function expression/callable, or array of functions */
  fn: string | MathFn | FunctionEntry[];
  domain?: [number, number];
  samples?: number;
  /** Base parameters passed into the expression evaluator */
  params?: Record<string, number>;
  /** Optional scope ID to reactively bind to ParamSlider components */
  scopeId?: string;
  xLabel?: string;
  xUnit?: string;
  xScale?: 'linear' | 'log';
  yLabel?: string;
  yUnit?: string;
  yScale?: 'linear' | 'log';
  yRange?: [number, number];
  height?: number;
  className?: string;
  referenceLines?: PlotReferenceLine[];
  shadedRegions?: PlotShadedRegion[];
}

export const FunctionPlot: React.FC<FunctionPlotProps> = ({
  title,
  description,
  fn,
  domain = [-10, 10],
  samples = 250,
  params: initialParams = {},
  scopeId,
  xLabel = 'x',
  xUnit = '',
  xScale = 'linear',
  yLabel = 'f(x)',
  yUnit = '',
  yScale = 'linear',
  yRange,
  height = 360,
  className = '',
  referenceLines,
  shadedRegions,
}) => {
  // Scoped state parameter tracking
  const [scopedParams, setScopedParams] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!scopeId) return;

    // Listen to parameter changes on this scope
    const unsubscribe = subscribeParameter(scopeId, (paramId, value) => {
      setScopedParams((prev) => ({
        ...prev,
        [paramId]: value,
      }));
    });

    return unsubscribe;
  }, [scopeId]);

  // Merge static initialParams with live scopedParams
  const mergedParams = useMemo(() => {
    return { ...initialParams, ...scopedParams };
  }, [initialParams, scopedParams]);

  // Standardize functions input to array of FunctionEntry
  const functionList = useMemo<FunctionEntry[]>(() => {
    if (Array.isArray(fn)) {
      return fn;
    }
    if (typeof fn === 'string') {
      return [{ fn, label: fn }];
    }
    return [{ fn, label: 'f(x)' }];
  }, [fn]);

  // Compute swept data series
  const series = useMemo<PlotSeries[]>(() => {
    return functionList.map((entry, idx) => {
      const label = entry.label || (typeof entry.fn === 'string' ? entry.fn : `f_${idx + 1}(x)`);
      const color = entry.color || getSeriesColor(idx);
      try {
        const { x, y } = sweepFunction(entry.fn, domain, samples, mergedParams);
        return {
          id: `fn-${idx}`,
          label,
          x,
          y,
          color,
          mode: entry.mode || 'lines',
          visible: true,
        };
      } catch (err) {
        console.warn(`[FunctionPlot] Evaluation error on "${label}":`, err);
        return {
          id: `fn-${idx}`,
          label: `${label} (error)`,
          x: [],
          y: [],
          color,
          mode: entry.mode || 'lines',
          visible: false,
        };
      }
    });
  }, [functionList, domain, samples, mergedParams]);

  const config = useMemo<EngineeringPlotConfig>(() => {
    const xAxis: PlotAxis = {
      title: xLabel,
      unit: xUnit,
      type: xScale,
      range: domain,
    };

    const yAxis: PlotAxis = {
      title: yLabel,
      unit: yUnit,
      type: yScale,
      range: yRange,
    };

    return {
      title,
      description,
      xAxis,
      yAxis,
      series,
      referenceLines,
      shadedRegions,
      legend: series.length > 1,
      tooltips: true,
    };
  }, [
    title,
    description,
    series,
    xLabel,
    xUnit,
    xScale,
    domain,
    yLabel,
    yUnit,
    yScale,
    yRange,
    referenceLines,
    shadedRegions,
  ]);

  return (
    <div className={`eng-function-plot-container ${className}`}>
      <EngineeringPlot config={config} height={height} />
    </div>
  );
};

export default FunctionPlot;
