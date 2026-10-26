import React, { useMemo } from 'react';
import type { PlotAxis, PlotReferenceLine, PlotShadedRegion, EngineeringPlotConfig, PlotSeries } from '../../lib/engineering/types';
import { EngineeringPlot } from '../engineering/plots/EngineeringPlot';
import { getSeriesColor } from '../../lib/engineering/colormaps';

export interface ScatterPoint {
  x: number;
  y: number;
  category?: string;
}

export interface ScatterSeriesInput {
  id?: string;
  label: string;
  x: number[];
  y: number[];
  color?: string;
  visible?: boolean;
}

export interface ScatterPlotProps {
  title?: string;
  description?: string;
  points?: ScatterPoint[];
  series?: ScatterSeriesInput[];
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

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  title,
  description,
  points,
  series: directSeries,
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
    let formattedSeries: PlotSeries[] = [];

    if (directSeries && directSeries.length > 0) {
      formattedSeries = directSeries.map((s, idx) => ({
        id: s.id || `scatter-series-${idx}`,
        label: s.label || `Data ${idx + 1}`,
        x: s.x,
        y: s.y,
        color: s.color || getSeriesColor(idx),
        mode: 'markers' as const,
        visible: s.visible !== false,
      }));
    } else if (points && points.length > 0) {
      // Group by category if present
      const groups = new Map<string, { x: number[]; y: number[] }>();
      for (const p of points) {
        const cat = p.category || 'Data';
        let group = groups.get(cat);
        if (!group) {
          group = { x: [], y: [] };
          groups.set(cat, group);
        }
        group.x.push(p.x);
        group.y.push(p.y);
      }

      let catIdx = 0;
      groups.forEach((data, cat) => {
        formattedSeries.push({
          id: `scatter-cat-${catIdx}`,
          label: cat,
          x: data.x,
          y: data.y,
          color: getSeriesColor(catIdx),
          mode: 'markers' as const,
          visible: true,
        });
        catIdx++;
      });
    }

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
      legend: formattedSeries.length > 1,
      tooltips: true,
    };
  }, [
    title,
    description,
    points,
    directSeries,
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
    <div className={`eng-scatter-plot-container ${className}`}>
      <EngineeringPlot config={config} height={height} toolbar={toolbar} />
    </div>
  );
};

export default ScatterPlot;
