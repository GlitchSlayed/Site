import React, { useMemo } from 'react';
import type { PlotAxis, PlotReferenceLine, PlotShadedRegion, EngineeringPlotConfig, PlotSeries } from '../../lib/engineering/types';
import { EngineeringPlot } from '../engineering/plots/EngineeringPlot';
import { getSeriesColor } from '../../lib/engineering/colormaps';

export interface LinePlotSeriesInput {
  id?: string;
  label: string;
  x?: number[];
  y: number[];
  color?: string;
  mode?: 'lines' | 'markers' | 'lines+markers';
  visible?: boolean;
}

export interface LinePlotProps {
  title?: string;
  description?: string;
  x?: number[];
  series: LinePlotSeriesInput[];
  toolbar?: 'floating' | 'compact' | 'minimal' | 'none';
  xLabel?: string;
  xUnit?: string;
  xScale?: 'linear' | 'log';
  xRange?: [number, number];
  yLabel?: string;
  yUnit?: string;
  yScale?: 'linear' | 'log';
  yRange?: [number, number];
  height?: number;
  className?: string;
  referenceLines?: PlotReferenceLine[];
  shadedRegions?: PlotShadedRegion[];
}

export const LinePlot: React.FC<LinePlotProps> = ({
  title,
  description,
  x: sharedX,
  series,
  toolbar = 'floating',
  xLabel = 'X',
  xUnit = '',
  xScale = 'linear',
  xRange,
  yLabel = 'Y',
  yUnit = '',
  yScale = 'linear',
  yRange,
  height = 360,
  className = '',
  referenceLines,
  shadedRegions,
}) => {
  const config = useMemo<EngineeringPlotConfig>(() => {
    const formattedSeries: PlotSeries[] = (series || []).map((s, idx) => {
      const xData = s.x && s.x.length > 0 ? s.x : (sharedX || []);
      const id = s.id || `series-${idx}`;
      return {
        id,
        label: s.label || `Series ${idx + 1}`,
        x: xData,
        y: s.y || [],
        color: s.color || getSeriesColor(idx),
        mode: s.mode || 'lines',
        visible: s.visible !== false,
      };
    });

    const xAxis: PlotAxis = {
      title: xLabel,
      unit: xUnit,
      type: xScale,
      range: xRange,
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
      series: formattedSeries,
      referenceLines,
      shadedRegions,
      legend: true,
      tooltips: true,
    };
  }, [
    title,
    description,
    sharedX,
    series,
    xLabel,
    xUnit,
    xScale,
    xRange,
    yLabel,
    yUnit,
    yScale,
    yRange,
    referenceLines,
    shadedRegions,
  ]);

  return (
    <div className={`eng-line-plot-container ${className}`}>
      <EngineeringPlot config={config} height={height} toolbar={toolbar} />
    </div>
  );
};

export default LinePlot;
