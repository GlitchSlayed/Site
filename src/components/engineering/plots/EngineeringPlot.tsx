// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';
import { isFiniteNumber, significantFigures } from '../../../lib/engineering/validation';
import { formatEngineering } from '../../../lib/engineering/validation';
import { formatResult, MAX_DECIMALS } from '../../../lib/engineering/format';
import { EngineeringPointInspector } from '../shared/EngineeringPointInspector';

type InteractionMode = 'inspect' | 'zoom' | 'pan';

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
  inspectorMetrics?: Array<{ id: string; label: string; unit?: string; significantFigures?: number }>;
  inspectorMetricValues?: Record<string, number>;
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

/** Format a tick label with SI prefixes and appropriate precision.
 *  Never exceeds MAX_DECIMALS decimal places. */
function formatTick(val: number, scale: 'linear' | 'log' = 'linear'): string {
  if (!Number.isFinite(val)) return '';
  if (val === 0) return '0';

  const abs = Math.abs(val);
  let formatted: string;

  // For very small or very large values, use engineering notation with SI prefix.
  if (abs < 0.01 || abs >= 1000) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = val / Math.pow(10, exponent);
    const prefix = ENGINEERING_PREFIXES[exponent] ?? `×10^${exponent}`;
    const sig = significantFigures(scaled, 3);
    formatted = `${sig}${prefix}`;
  } else {
    // Use up to 4 significant figures, respecting MAX_DECIMALS cap.
    const sig = significantFigures(val, 4);
    const decimalCap = Math.pow(10, MAX_DECIMALS);
    const capped = Math.round(sig * decimalCap) / decimalCap;
    formatted = capped.toString();
    if (!Number.isInteger(capped) && !formatted.includes('.')) {
      formatted = capped.toFixed(1);
    }
  }

  return formatted;
}

/** Estimate the width needed for an axis title string. */
function measureTextWidth(text: string, fontSize: number): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.6;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${getComputedStyle(document.documentElement).fontFamily || 'system-ui'}`;
  return ctx.measureText(text).width;
}

export function EngineeringPlot({
  config,
  className,
  height = 400,
  onPointSelect,
  inspectable = false,
  inspectorSeriesIndex = 0,
  inspectorMetrics,
  inspectorMetricValues,
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
  const [showSettings, setShowSettings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [yScaleType, setYScaleType] = useState<'linear' | 'log'>('linear');
  const [xMin, setXMin] = useState<number | null>(null);
  const [xMax, setXMax] = useState<number | null>(null);
  const [yMin, setYMin] = useState<number | null>(null);
  const [yMax, setYMax] = useState<number | null>(null);
  const [showMarkers, setShowMarkers] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [showLegend, setShowLegend] = useState(true);
  const [hoverReadout, setHoverReadout] = useState<{ x: string; y: string } | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('inspect');
  const [seriesVisibility, setSeriesVisibility] = useState<Record<string, boolean>>({});

  // Axis size refs for dynamic measurement.
  const xAxisSizeRef = useRef(24);
  const yAxisSizeRef = useRef(48);

  const handlePointSelect = useCallback(
    (x: number, y: number, seriesIndex: number) => {
      if (interactionMode !== 'inspect') return;
      const series = config.series;
      const s = series[seriesIndex];
      setSelectedPoint({ x, y, seriesIndex, seriesLabel: s?.label ?? 'Series' });
      onPointSelect?.(x, y, seriesIndex);
    },
    [config.series, interactionMode, onPointSelect],
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
      const visible = seriesVisibility[s.id] !== false;
      series.push({
        label: s.label,
        stroke: s.color || accentColor(),
        width: lineWidth,
        points: {
          show: showMarkers && (s.mode === 'markers' || s.mode === 'lines+markers'),
          size: 4,
          width: 1,
        },
        spanGaps: true,
        show: visible,
      });
    }
    return series;
  };

  const buildAxes = (): any[] => {
    const xTitle = `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`;
    const yTitle = `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`;

    // Dynamically measure axis sizes based on content.
    const xAxisSize = Math.max(
      24,
      measureTextWidth(xTitle, 13) / 2 + 14,
      measureTextWidth(formatTick(config.xAxis.range?.[0] ?? 0, config.xAxis.type), 11) + 6,
    );
    const yAxisSize = Math.max(
      48,
      measureTextWidth(yTitle, 13) / 2 + 14,
      measureTextWidth(formatTick(config.yAxis.range?.[0] ?? 0, yScaleType), 11) + 6,
    );
    xAxisSizeRef.current = xAxisSize;
    yAxisSizeRef.current = yAxisSize;

    return [
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: showGrid ? gridColor() : '#0000' },
        size: xAxisSize,
        label: xTitle,
        tick: (self: any, val: number) => formatTick(val, config.xAxis.type),
      },
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: showGrid ? gridColor() : '#0000' },
        size: yAxisSize,
        label: yTitle,
        tick: (self: any, val: number) => formatTick(val, yScaleType),
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

    if (inst && inst.setData && chartStructureRef.current === structureKey) {
      try {
        inst.setData(validation.data, false);
        applySettings(inst);
        return;
      } catch {
        // Fall through to full reinitialization.
      }
    }

    if (inst && inst.destroy) {
      inst.destroy();
    }

    const xRange = config.xAxis.range ?? [0, 1];
    const yRange = config.yAxis.range ?? [0, 1];

    const opts: any = {
      width,
      height,
      plugins: [],
      series: buildSeries(),
      axes: buildAxes(),
      scales: {
        x: { time: false, min: xMin ?? xRange[0], max: xMax ?? xRange[1] },
        y: { type: yScaleType, min: yMin ?? yRange[0], max: yMax ?? yRange[1] },
      },
      cursor: {
        show: config.tooltips !== false && interactionMode === 'inspect',
        x: true,
        y: true,
        lock: 'x',
        points: { show: true, size: 5, stroke: '#fff', width: 0 },
      },
      hooks: {
        setCursor: [
          (u: any) => {
            if (interactionMode !== 'inspect' || !config.tooltips) return;
            const idx = u.cursor?.idx;
            if (idx == null || idx < 0) {
              setHoverReadout(null);
              return;
            }
            const xVal = u.data[0][idx];
            const yVal = u.data[1][idx];
            if (xVal != null && yVal != null) {
              setHoverReadout({
                x: formatTick(xVal, config.xAxis.type),
                y: formatTick(yVal, yScaleType),
              });
            }
          },
        ],
        setScale: [
          (u: any, key: string) => {
            if (key === 'x' && interactionMode === 'pan') {
              // Pan mode: allow scrolling
            }
          },
        ],
      },
      legend: { show: showLegend, width: 240, live: false },
      select: {
        show: interactionMode === 'zoom',
        marginLeft: yAxisSizeRef.current,
        marginTop: 0,
        marginRight: 20,
        marginBottom: xAxisSizeRef.current,
        stroke: '#00000040',
        fill: '#00000020',
        cursor: interactionMode === 'zoom' ? 'zoom-in' : (interactionMode === 'pan' ? 'grab' : 'crosshair'),
        selected: (u: any, i0: number, i1: number) => {
          if (interactionMode === 'zoom' && i1 > i0) {
            const xData = u.data[0];
            const xScale = u.scales.x;
            const xRangeCur = xScale.range;
            const len = xData.length;
            const x0 = xRangeCur.min + (i0 / len) * (xRangeCur.max - xRangeCur.min);
            const x1 = xRangeCur.min + (i1 / len) * (xRangeCur.max - xRangeCur.min);
            u.setScale('x', { min: Math.min(x0, x1), max: Math.max(x0, x1) });
          }
        },
      },
    };

    try {
      const newInst = new uPlot(opts, validation.data, container);
      chartInstanceRef.current = newInst;
      chartStructureRef.current = structureKey;
      applySettings(newInst);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize plot');
      console.error('[EngineeringPlot] uPlot construction failed:', err);
      setInitError(err);
    }
  }, [config, height, validateData, getStructureKey, showGrid, yScaleType, xMin, xMax, yMin, yMax, showMarkers, lineWidth, showLegend, interactionMode, seriesVisibility]);

  const applySettings = (inst: any) => {
    if (!inst) return;
    try {
      if (inst.setScale) {
        inst.setScale('y', { type: yScaleType });
      }
      // Series visibility
      inst.series?.forEach?.((s: any, i: number) => {
        if (i === 0) return; // skip x series
        const visible = seriesVisibility[s.label || `series-${i}`] !== false;
        if (typeof s.show === 'boolean' || s.show === undefined) {
          // uPlot series visibility
        }
      });
    } catch {
      // best effort
    }
  };

  // Theme change: update colors without destroying the chart.
  useEffect(() => {
    if (!mountedRef.current || !chartInstanceRef.current) return;
    const observer = new MutationObserver(() => {
      initChart();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [initChart]);

  // Pan mode: drag to pan.
  const panStateRef = useRef<{ dragging: boolean; startX: number; startMin: number; startMax: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !inspectable || interactionMode !== 'pan') return;

    const handleMouseDown = (e: MouseEvent) => {
      const inst = chartInstanceRef.current;
      if (!inst) return;
      const xScale = inst.scales.x;
      panStateRef.current = {
        dragging: true,
        startX: e.clientX,
        startMin: xScale.min,
        startMax: xScale.max,
      };
      container.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const state = panStateRef.current;
      const inst = chartInstanceRef.current;
      if (!state?.dragging || !inst) return;
      const dx = e.clientX - state.startX;
      const containerWidth = container.clientWidth || 600;
      const range = state.startMax - state.startMin;
      const shift = (dx / containerWidth) * range;
      inst.setScale('x', {
        min: state.startMin - shift,
        max: state.startMax - shift,
      });
    };

    const handleMouseUp = () => {
      if (panStateRef.current) {
        panStateRef.current.dragging = false;
      }
      container.style.cursor = '';
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interactionMode, inspectable]);

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
    if (inspectable && interactionMode === 'inspect') {
      inspectContainer = containerRef.current;
      const handleCanvasClick = (event: MouseEvent) => {
        const inst = chartInstanceRef.current;
        const container = inspectContainer;
        if (!inst || !container) return;
        const series = config.series;
        if (!series.length) return;

        const xData = series[0].x;
        const rect = container.getBoundingClientRect();
        const plotLeft = yAxisSizeRef.current;
        const plotWidth = rect.width - plotLeft - 20;

        const clickX = event.clientX - rect.left;
        const scaleX = inst.scale.x;
        const xRangeCur = scaleX.range;
        const dataX =
          xRangeCur.min +
          Math.max(0, clickX - plotLeft) / plotWidth * (xRangeCur.max - xRangeCur.min);

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
  }, [loaded, initChart, height, inspectable, interactionMode, inspectorSeriesIndex, config.series, handlePointSelect]);

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
      setXMin(null);
      setXMax(null);
      setYMin(null);
      setYMax(null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to reset view');
      console.error('[EngineeringPlot] Reset view failed:', err);
      setInitError(err);
    }
  };

  const handleResetSettings = () => {
    setShowGrid(true);
    setYScaleType('linear');
    setXMin(null);
    setXMax(null);
    setYMin(null);
    setYMax(null);
    setShowMarkers(false);
    setLineWidth(2);
    setShowLegend(true);
    setSeriesVisibility({});
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

  const datasetRange = config.series.length
    ? {
        xMin: Math.min(...config.series[0].x),
        xMax: Math.max(...config.series[0].x),
        yMin: Math.min(...config.series.flatMap((s) => s.y.filter(isFiniteNumber))),
        yMax: Math.max(...config.series.flatMap((s) => s.y.filter(isFiniteNumber))),
      }
    : null;

  return (
    <section className={`eng-plot ${className || ''}`} aria-label={config.title || 'Engineering plot'}>
      {config.title && <h2 className="eng-plot-title">{config.title}</h2>}
      {config.description && <p className="eng-plot-description">{config.description}</p>}
      <div
        ref={containerRef}
        style={{ width: '100%', height, position: 'relative' }}
        aria-hidden="true"
      />
      {hoverReadout && interactionMode === 'inspect' && (
        <div className="eng-plot-hover-readout" aria-live="polite">
          <span className="eng-plot-hover-x">X: {hoverReadout.x}</span>
          <span className="eng-plot-hover-y">Y: {hoverReadout.y}</span>
        </div>
      )}
      <div className="eng-plot-toolbar">
        <div className="eng-plot-mode-group">
          <button
            type="button"
            className={`eng-plot-mode-btn ${interactionMode === 'inspect' ? 'eng-plot-mode-active' : ''}`}
            onClick={() => setInteractionMode('inspect')}
            aria-label="Inspect points"
            aria-pressed={interactionMode === 'inspect'}
          >
            Inspect
          </button>
          <button
            type="button"
            className={`eng-plot-mode-btn ${interactionMode === 'zoom' ? 'eng-plot-mode-active' : ''}`}
            onClick={() => setInteractionMode('zoom')}
            aria-label="Drag to zoom"
            aria-pressed={interactionMode === 'zoom'}
          >
            Zoom
          </button>
          <button
            type="button"
            className={`eng-plot-mode-btn ${interactionMode === 'pan' ? 'eng-plot-mode-active' : ''}`}
            onClick={() => setInteractionMode('pan')}
            aria-label="Pan"
            aria-pressed={interactionMode === 'pan'}
          >
            Pan
          </button>
          <button type="button" onClick={handleResetView} aria-label="Reset zoom and pan">
            Reset View
          </button>
        </div>
        <div className="eng-plot-settings-group">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Graph settings"
            className="eng-plot-settings-btn"
          >
            Graph Settings ⚙
          </button>
          <div className="eng-plot-export-group">
            <button type="button" onClick={handleExportPng} aria-label="Export plot as PNG">
              Export PNG
            </button>
            <button type="button" onClick={handleExportCsv} aria-label="Export data as CSV">
              Export CSV
            </button>
          </div>
        </div>
      </div>
      {showSettings && (
        <div className="eng-plot-settings-panel">
          <div className="eng-plot-settings-section">
            <h4 className="eng-plot-settings-section-title">Axes</h4>
            <div className="eng-plot-settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Show grid
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={yScaleType === 'log'}
                  onChange={(e) => setYScaleType(e.target.checked ? 'log' : 'linear')}
                />
                Logarithmic Y axis
              </label>
            </div>
            <div className="eng-plot-settings-row">
              <label className="eng-plot-settings-label">X min</label>
              <input
                type="number"
                value={xMin ?? ''}
                onChange={(e) => setXMin(e.target.value === '' ? null : Number(e.target.value))}
                className="eng-plot-settings-input"
                placeholder="auto"
              />
              <label className="eng-plot-settings-label">X max</label>
              <input
                type="number"
                value={xMax ?? ''}
                onChange={(e) => setXMax(e.target.value === '' ? null : Number(e.target.value))}
                className="eng-plot-settings-input"
                placeholder="auto"
              />
              <label className="eng-plot-settings-label">Y min</label>
              <input
                type="number"
                value={yMin ?? ''}
                onChange={(e) => setYMin(e.target.value === '' ? null : Number(e.target.value))}
                className="eng-plot-settings-input"
                placeholder="auto"
              />
              <label className="eng-plot-settings-label">Y max</label>
              <input
                type="number"
                value={yMax ?? ''}
                onChange={(e) => setYMax(e.target.value === '' ? null : Number(e.target.value))}
                className="eng-plot-settings-input"
                placeholder="auto"
              />
            </div>
          </div>
          <div className="eng-plot-settings-section">
            <h4 className="eng-plot-settings-section-title">Appearance</h4>
            <div className="eng-plot-settings-row">
              <label>
                <input
                  type="checkbox"
                  checked={showMarkers}
                  onChange={(e) => setShowMarkers(e.target.checked)}
                />
                Show data markers
              </label>
              <label className="eng-plot-settings-label">Line thickness</label>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="eng-plot-settings-range"
              />
              <span className="eng-plot-settings-value">{lineWidth} px</span>
              <label>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
                Show legend
              </label>
            </div>
          </div>
          <div className="eng-plot-settings-section">
            <h4 className="eng-plot-settings-section-title">Data</h4>
            {datasetRange && (
              <div className="eng-plot-settings-row">
                <span className="eng-plot-settings-label">X range:</span>
                <span className="eng-plot-settings-value">
                  {formatTick(datasetRange.xMin, config.xAxis.type)} to{' '}
                  {formatTick(datasetRange.xMax, config.xAxis.type)}
                </span>
                <span className="eng-plot-settings-label">Y range:</span>
                <span className="eng-plot-settings-value">
                  {formatTick(datasetRange.yMin, yScaleType)} to{' '}
                  {formatTick(datasetRange.yMax, yScaleType)}
                </span>
              </div>
            )}
            <div className="eng-plot-settings-series">
              <span className="eng-plot-settings-section-title" style={{ marginBottom: 4 }}>Series visibility</span>
              {config.series.map((series) => (
                <label key={series.id} className="eng-plot-settings-series-label">
                  <input
                    type="checkbox"
                    checked={seriesVisibility[series.id] !== false}
                    onChange={(e) =>
                      setSeriesVisibility((prev) => ({
                        ...prev,
                        [series.id]: e.target.checked,
                      }))
                    }
                  />
                  <span
                    className="eng-plot-settings-series-color"
                    style={{ background: series.color || accentColor() }}
                  />
                  {series.label}
                </label>
              ))}
            </div>
            <button type="button" onClick={handleResetSettings} className="eng-plot-settings-reset">
              Reset Settings
            </button>
          </div>
        </div>
      )}
      {inspectable && selectedPoint && (
        <EngineeringPointInspector
          selected={selectedPoint}
          metrics={inspectorMetrics ?? []}
          metricValues={inspectorMetricValues ?? {}}
          onClear={() => setSelectedPoint(null)}
        />
      )}
    </section>
  );
}
