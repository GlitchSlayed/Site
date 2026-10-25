// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';
import { isFiniteNumber, significantFigures } from '../../../lib/engineering/validation';
import { formatEngineering } from '../../../lib/engineering/validation';
import { EngineeringPointInspector } from '../shared/EngineeringPointInspector';

function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
}

function textColor(): string {
  return isDark() ? '#ededed' : '#171717';
}

function gridColor(): string {
  return isDark() ? '#252525' : '#dedede';
}

function accentColor(): string {
  return isDark() ? '#ff603b' : '#c63c18';
}

interface EngineeringPlotProps {
  config: EngineeringPlotConfig;
  className?: string;
  height?: number;
  onPointSelect?: (x: number, y: number, seriesIndex: number) => void;
  inspectable?: boolean;
  inspectorSeriesIndex?: number;
}

const ENGINEERING_PREFIXES: Record<number, string> = {
  '-12': 'p',
  '-9': 'n',
  '-6': 'µ',
  '-3': 'm',
  '0': '',
  '3': 'k',
  '6': 'M',
  '9': 'G',
  '12': 'T',
};

/** Format a tick label with SI prefixes and appropriate precision. */
function formatTick(val: number, scale: 'linear' | 'log' = 'linear'): string {
  if (!Number.isFinite(val)) return '';
  if (val === 0) return '0';

  const abs = Math.abs(val);
  let formatted: string;

  // For very small or very large values, use engineering notation.
  if (abs < 0.01 || abs >= 1000) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = val / Math.pow(10, exponent);
    const prefix = ENGINEERING_PREFIXES[exponent] ?? `×10^${exponent}`;
    const sig = significantFigures(scaled, 3);
    formatted = `${sig}${prefix}`;
  } else {
    // Use up to 4 significant figures, dropping trailing zeros.
    const sig = significantFigures(val, 4);
    formatted = sig.toString();
    // Ensure at least one decimal place for non-integers.
    if (!Number.isInteger(sig) && !formatted.includes('.')) {
      formatted = sig.toFixed(1);
    }
  }

  return formatted;
}

export function EngineeringPlot({
  config,
  className,
  height = 400,
  onPointSelect,
  inspectable = false,
  inspectorSeriesIndex = 0,
}: EngineeringPlotProps) {
  const uPlotConstructorRef = useRef<any>(null);
  const chartInstanceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartStructureRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const mountedRef = useRef(false);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number; seriesIndex: number; seriesLabel: string } | null>(null);

  const handlePointSelect = useCallback(
    (x: number, y: number, seriesIndex: number) => {
      const series = config.series;
      const s = series[seriesIndex];
      setSelectedPoint({ x, y, seriesIndex, seriesLabel: s?.label ?? 'Series' });
      onPointSelect?.(x, y, seriesIndex);
    },
    [config.series, onPointSelect],
  );

  const load = useCallback(async () => {
    if (uPlotConstructorRef.current) {
      setLoaded(true);
      return;
    }
    try {
      const mod = await import('uplot');
      const uPlot = (mod.default ?? mod) as any;
      uPlotConstructorRef.current = uPlot;
      setLoaded(true);
      setLoadError(null);
      if (mountedRef.current && containerRef.current) {
        initChart();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load plot library');
      console.error('[EngineeringPlot] uPlot import failed:', err);
      setLoadError(err);
    }
  }, []);

  const validateData = useCallback(
    (series: PlotSeries[]): { valid: boolean; data: number[][]; error: string | null } => {
      if (!series.length) {
        return { valid: false, data: [], error: 'No data series configured.' };
      }

      const x = series[0].x;
      if (!x.length) {
        return { valid: false, data: [], error: 'No X data points.' };
      }

      const referenceX = x;
      for (const s of series) {
        if (!s.x || s.x.length !== referenceX.length) {
          console.error(
            `[EngineeringPlot] Series "${s.label}" X length (${s.x?.length ?? 0}) ` +
              `does not match reference X length (${referenceX.length}).`,
          );
          return {
            valid: false,
            data: [],
            error: `X coordinate mismatch for series "${s.label}".`,
          };
        }
        for (let i = 0; i < referenceX.length; i++) {
          if (s.x[i] !== referenceX[i]) {
            console.error(
              `[EngineeringPlot] Series "${s.label}" X values diverge from reference at index ${i}.`,
            );
            return {
              valid: false,
              data: [],
              error: `X coordinate mismatch for series "${s.label}".`,
            };
          }
        }
      }

      const pairs = referenceX.map((xi, i) => ({ x: xi, i }));
      pairs.sort((a, b) => a.x - b.x);
      const xSorted = pairs.map((p) => p.x);
      const sortedIndices = pairs.map((p) => p.i);
      const isSorted = sortedIndices.every((idx, i) => idx === i);
      if (!isSorted) {
        console.warn('[EngineeringPlot] X/Y pairs were not sorted; sorted together for uPlot.');
      }

      const data: number[][] = [xSorted];

      for (const s of series) {
        const ySanitized: number[] = [];
        for (const idx of sortedIndices) {
          const y = s.y[idx];
          if (!isFiniteNumber(y)) {
            ySanitized.push(NaN);
            console.warn(
              `[EngineeringPlot] Series "${s.label}" has nonfinite Y at index ${idx}; using NaN gap.`,
            );
          } else {
            ySanitized.push(y);
          }
        }
        data.push(ySanitized);
      }

      return { valid: true, data, error: null };
    },
    [],
  );

  const getStructureKey = useCallback((cfg: EngineeringPlotConfig): string => {
    return JSON.stringify({
      xAxis: cfg.xAxis,
      yAxis: cfg.yAxis,
      series: cfg.series.map((s) => ({ label: s.label, mode: s.mode, color: s.color })),
      scales: {
        x: cfg.xAxis.range,
        y: cfg.yAxis.range,
        type: cfg.yAxis.type,
      },
    });
  }, []);

  const buildSeries = (): any[] => {
    const series: any[] = [{}];
    for (const s of config.series) {
      series.push({
        label: s.label,
        stroke: s.color || accentColor(),
        width: 2,
        points: {
          show: s.mode === 'markers' || s.mode === 'lines+markers',
          size: 4,
          width: 1,
        },
        spanGaps: true,
      });
    }
    return series;
  };

  const buildAxes = (): any[] => {
    const xTitle = `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`;
    const yTitle = `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`;
    return [
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: gridColor() },
        size: 22,
        label: xTitle,
        tick: (self: any, val: number) => formatTick(val, config.xAxis.type),
      },
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: gridColor() },
        size: 44,
        label: yTitle,
        tick: (self: any, val: number) => formatTick(val, config.yAxis.type),
      },
    ];
  };

  const initChart = useCallback(() => {
    const uPlot = uPlotConstructorRef.current;
    const container = containerRef.current;
    if (!uPlot || !container) return;

    const width = container.clientWidth;
    if (width <= 0) return;

    const validation = validateData(config.series);
    if (!validation.valid) {
      setInitError(new Error(validation.error ?? 'Unknown plot error.'));
      return;
    }
    setInitError(null);

    const inst = chartInstanceRef.current;
    const structureKey = getStructureKey(config);

    // If chart exists and structure is unchanged, just update data.
    if (inst && inst.setData && chartStructureRef.current === structureKey) {
      try {
        inst.setData(validation.data, false);
        return;
      } catch {
        // Fall through to full reinitialization.
      }
    }

    // Destroy previous instance.
    if (inst && inst.destroy) {
      inst.destroy();
    }

    const opts: any = {
      width,
      height,
      plugins: [],
      series: buildSeries(),
      axes: buildAxes(),
      scales: {
        x: { time: false },
        y: { type: config.yAxis.type === 'log' ? 'log' : 'linear' },
      },
      cursor: {
        show: config.tooltips !== false,
        x: true,
        y: true,
        lock: 'x',
        points: { show: true, size: 5, stroke: '#fff', width: 0 },
      },
      legend: { show: config.legend !== false, width: 240, live: true },
    };

    if (config.xAxis.range) {
      opts.scales.x.min = config.xAxis.range[0];
      opts.scales.x.max = config.xAxis.range[1];
    }
    if (config.yAxis.range) {
      opts.scales.y.min = config.yAxis.range[0];
      opts.scales.y.max = config.yAxis.range[1];
    }

    try {
      const newInst = new uPlot(opts, validation.data, container);
      chartInstanceRef.current = newInst;
      chartStructureRef.current = structureKey;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize plot');
      console.error('[EngineeringPlot] uPlot construction failed:', err);
      setInitError(err);
    }
  }, [config, height, validateData, getStructureKey]);

  // Theme change: update colors without destroying the chart.
  useEffect(() => {
    if (!mountedRef.current || !chartInstanceRef.current) return;
    const observer = new MutationObserver(() => {
      initChart();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [initChart]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      if (chartInstanceRef.current && chartInstanceRef.current.destroy) {
        chartInstanceRef.current.destroy();
      }
      chartInstanceRef.current = null;
      uPlotConstructorRef.current = null;
      chartStructureRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!loaded || !uPlotConstructorRef.current || !containerRef.current) return;
    initChart();
    const resizeObserver = new ResizeObserver(() => {
      const inst = chartInstanceRef.current;
      const box = containerRef.current;
      if (!inst || !box) return;
      if (inst.setSize) {
        inst.setSize({ width: box.clientWidth || 600, height });
      } else {
        initChart();
      }
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', onResize);

    let inspectContainer: HTMLDivElement | null = null;

    // Click-to-inspect: find nearest data point on canvas click.
    if (inspectable) {
      inspectContainer = containerRef.current;
      const handleCanvasClick = (event: MouseEvent) => {
        const inst = chartInstanceRef.current;
        const container = inspectContainer;
        if (!inst || !container) return;
        const series = config.series;
        if (!series.length) return;

        const xData = series[0].x;
        const rect = container.getBoundingClientRect();
        const plotLeft = 44; // y-axis width from buildAxes
        const plotWidth = rect.width - plotLeft - 20;

        const clickX = event.clientX - rect.left;
        const scaleX = inst.scale.x;
        const xRange = scaleX.range;
        const dataX =
          xRange.min +
          Math.max(0, clickX - plotLeft) / plotWidth * (xRange.max - xRange.min);

        // Find nearest X index in sorted data.
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < xData.length; i++) {
          const dist = Math.abs(xData[i] - dataX);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }

        const primarySeriesIndex = inspectorSeriesIndex ?? 0;
        const primary = series[primarySeriesIndex];
        if (primary) {
          handlePointSelect(xData[nearestIdx], primary.y[nearestIdx], primarySeriesIndex);
        }
      };

      inspectContainer.addEventListener('click', handleCanvasClick);
      return () => {
        inspectContainer?.removeEventListener('click', handleCanvasClick);
        resizeObserver.disconnect();
        window.removeEventListener('resize', onResize);
      };
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [loaded, initChart, height, inspectable, inspectorSeriesIndex, config.series, onPointSelect]);

  const onResize = () => {
    const inst = chartInstanceRef.current;
    const box = containerRef.current;
    if (!inst || !box) return;
    if (inst.setSize) {
      inst.setSize({ width: box.clientWidth || 600, height });
    } else {
      initChart();
    }
  };

  const handleResetView = () => {
    const inst = chartInstanceRef.current;
    if (!inst || !inst.setScale) return;
    try {
      if (config.xAxis.range) {
        inst.setScale('x', { min: config.xAxis.range[0], max: config.xAxis.range[1] });
      }
      if (config.yAxis.range) {
        inst.setScale('y', { min: config.yAxis.range[0], max: config.yAxis.range[1] });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to reset view');
      console.error('[EngineeringPlot] Reset view failed:', err);
      setInitError(err);
    }
  };

  const handleExportPng = () => {
    const inst = chartInstanceRef.current;
    if (!inst) return;
    try {
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(config.title || 'plot').replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('PNG export failed');
      console.error('[EngineeringPlot] PNG export failed:', err);
    }
  };

  const handleExportCsv = () => {
    const rows: string[] = [];
    const maxLen = Math.max(...config.series.map((s) => s.x.length));
    const header = ['x', ...config.series.map((s) => s.label)].join(',');
    rows.push(header);
    for (let i = 0; i < maxLen; i++) {
      const yValues = config.series.map((s) => s.y[i] ?? '');
      rows.push(`${config.series[0]?.x[i] ?? ''},${yValues.join(',')}`);
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(config.title || 'plot').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loadError) {
    return (
      <div className={`eng-plot eng-plot-error ${className || ''}`} role="alert" aria-live="polite">
        <p>Unable to load the interactive plot.</p>
        <p className="eng-plot-error-detail">{loadError.message}</p>
        <button type="button" onClick={load} aria-label="Retry loading plot">
          Retry
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`eng-plot eng-plot-loading ${className || ''}`} style={{ height }} aria-label="Plot loading">
        <p>Loading plot…</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className={`eng-plot eng-plot-error ${className || ''}`} role="alert" aria-live="polite">
        <p>Unable to render the interactive plot.</p>
        <p className="eng-plot-error-detail">{initError.message}</p>
        <button type="button" onClick={initChart} aria-label="Retry rendering plot">
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className={`eng-plot ${className || ''}`} aria-label={config.title || 'Engineering plot'}>
      {config.title && <h2 className="eng-plot-title">{config.title}</h2>}
      {config.description && <p className="eng-plot-description">{config.description}</p>}
      <div
        ref={containerRef}
        style={{ width: '100%', height, position: 'relative' }}
        aria-hidden="true"
      />
      <div className="eng-plot-actions">
        <button type="button" onClick={handleResetView} aria-label="Reset zoom and pan">
          Reset view
        </button>
        <button type="button" onClick={handleExportPng} aria-label="Export plot as PNG">
          Export PNG
        </button>
        <button type="button" onClick={handleExportCsv} aria-label="Export data as CSV">
          Export CSV
        </button>
      </div>
      {inspectable && selectedPoint && (
        <EngineeringPointInspector
          selected={selectedPoint}
          metrics={[]}
          metricValues={{}}
          onClear={() => setSelectedPoint(null)}
        />
      )}
    </section>
  );
}
