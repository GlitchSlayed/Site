// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState, useId } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';
import { isFiniteNumber, significantFigures } from '../../../lib/engineering/validation';
import { formatResult } from '../../../lib/engineering/format';
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
 *  Never exceeds 5 decimal places. */
function formatTick(val: number, scale: 'linear' | 'log' = 'linear'): string {
  if (!Number.isFinite(val)) return '';
  if (val === 0) return '0';

  const abs = Math.abs(val);
  let formatted: string;

  if (abs < 0.01 || abs >= 1000) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = val / Math.pow(10, exponent);
    const prefix = ENGINEERING_PREFIXES[exponent] ?? `×10^${exponent}`;
    const sig = significantFigures(scaled, 3);
    formatted = `${sig}${prefix}`;
  } else {
    const sig = significantFigures(val, 4);
    const capped = Math.round(sig * 100000) / 100000;
    formatted = capped.toString();
    if (!Number.isInteger(capped) && !formatted.includes('.')) {
      formatted = capped.toFixed(1);
    }
  }

  return formatted;
}

/** Estimate text width using canvas font metrics. */
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
  // Library constructor (loaded once, mount-only).
  const uPlotConstructorRef = useRef<any>(null);
  // Chart instance (owned by the chart lifecycle effect).
  const chartInstanceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartStructureRef = useRef<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('inspect');
  const [seriesVisibility, setSeriesVisibility] = useState<Record<string, boolean>>({});
  const [hoverReadout, setHoverReadout] = useState<{ x: string; y: string; label: string; color: string } | null>(null);

  // Normalized tooltip setting.
  const tooltipsEnabled = config.tooltips !== false;

  // Axis size refs for dynamic measurement.
  const xAxisSizeRef = useRef(24);
  const yAxisSizeRef = useRef(48);

  // Pan state.
  const panStateRef = useRef<{ dragging: boolean; startX: number; startMin: number; startMax: number } | null>(null);
  const lastHoverIdxRef = useRef<number | null>(null);

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

  // -----------------------------------------------------------------------
  // 1. Library loading effect (mount-only, stable).
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    import('uplot')
      .then((module: any) => {
        if (cancelled) return;
        uPlotConstructorRef.current = module.default ?? module;
        setLoaded(true);
        setLoadError(null);
      })
      .catch((error: any) => {
        if (!cancelled) {
          const err = error instanceof Error ? error : new Error('Failed to load plot library');
          console.error('[EngineeringPlot] uPlot import failed:', err);
          setLoadError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const retryLoad = useCallback(() => {
    setRetryCount((c) => c + 1);
    setLoadError(null);
  }, []);

  // -----------------------------------------------------------------------
  // 2. Chart lifecycle effect (separate from library loading).
  // -----------------------------------------------------------------------
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
          return { valid: false, data: [], error: `X coordinate mismatch for series "${s.label}".` };
        }
        for (let i = 0; i < referenceX.length; i++) {
          if (s.x[i] !== referenceX[i]) {
            return { valid: false, data: [], error: `X coordinate mismatch for series "${s.label}".` };
          }
        }
      }

      const pairs = referenceX.map((xi, i) => ({ x: xi, i }));
      pairs.sort((a, b) => a.x - b.x);
      const xSorted = pairs.map((p) => p.x);
      const sortedIndices = pairs.map((p) => p.i);

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
      scales: { x: cfg.xAxis.range, y: cfg.yAxis.range, type: cfg.yAxis.type },
      settings: { showGrid, yScaleType, lineWidth, showMarkers, showLegend },
    });
  }, [showGrid, yScaleType, lineWidth, showMarkers, showLegend]);

  const buildSeries = useCallback((): any[] => {
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
  }, [config.series, seriesVisibility, lineWidth, showMarkers]);

  const buildAxes = useCallback((): any[] => {
    const xTitle = `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`;
    const yTitle = `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`;

    const xAxisSize = Math.max(
      24,
      measureTextWidth(xTitle, 12) * 0.5 + 14,
    );
    const yAxisSize = Math.max(
      48,
      measureTextWidth(yTitle, 12) * 0.5 + 14,
    );
    xAxisSizeRef.current = xAxisSize;
    yAxisSizeRef.current = yAxisSize;

    return [
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: showGrid ? gridColor() : 'transparent' },
        size: xAxisSize,
        label: xTitle,
        tick: (self: any, val: number) => formatTick(val, config.xAxis.type),
      },
      {
        show: true,
        stroke: textColor(),
        grid: { stroke: showGrid ? gridColor() : 'transparent' },
        size: yAxisSize,
        label: yTitle,
        tick: (self: any, val: number) => formatTick(val, yScaleType),
      },
    ];
  }, [config.xAxis, yScaleType, showGrid]);

  // Apply settings to an existing chart instance.
  const applySettings = useCallback((inst: any) => {
    if (!inst) return;
    try {
      // Update series visibility using uPlot's setSeries API.
      config.series.forEach((series, index) => {
        const visible = seriesVisibility[series.id] !== false;
        if (inst.setSeries) {
          inst.setSeries(index + 1, { show: visible });
        }
      });
      // Update line width and markers via setSeries.
      config.series.forEach((series, index) => {
        if (inst.setSeries) {
          inst.setSeries(index + 1, {
            width: lineWidth,
            points: {
              show: showMarkers && (series.mode === 'markers' || series.mode === 'lines+markers'),
            },
          });
        }
      });
      // Update grid visibility via axes.
      if (inst.axes) {
        inst.axes.forEach((axis: any) => {
          if (axis && axis.grid) {
            axis.grid.stroke = showGrid ? gridColor() : 'transparent';
          }
        });
      }
      // Update Y scale type.
      if (inst.scales && inst.scales.y) {
        inst.scales.y.type = yScaleType;
      }
    } catch (e) {
      console.warn('[EngineeringPlot] applySettings partial failure:', e);
    }
  }, [config.series, seriesVisibility, lineWidth, showMarkers, showGrid, yScaleType]);

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

    // If chart exists and structure unchanged, just update data.
    if (inst && inst.setData && chartStructureRef.current === structureKey) {
      try {
        inst.setData(validation.data, false);
        applySettings(inst);
        return;
      } catch {
        // Fall through to full reinitialization.
      }
    }

    // Destroy previous instance.
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
        show: tooltipsEnabled,
        x: true,
        y: true,
        lock: 'x',
        points: { show: true, size: 5, stroke: '#fff', width: 0 },
      },
      legend: { show: showLegend, live: false },
      select: {
        show: interactionMode === 'zoom',
        marginLeft: yAxisSizeRef.current,
        marginTop: 0,
        marginRight: 20,
        marginBottom: xAxisSizeRef.current,
        stroke: '#ff603b80',
        fill: '#ff603b20',
        cursor: interactionMode === 'zoom' ? 'zoom-in' : (interactionMode === 'pan' ? 'grab' : 'crosshair'),
        selected: (u: any, i0: number, i1: number) => {
          if (interactionMode !== 'zoom' || i1 <= i0) return;
          const left = u.select.left;
          const right = left + u.select.width;
          const min = u.posToVal(left, 'x');
          const max = u.posToVal(right, 'x');
          if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
            u.setScale('x', { min, max });
          }
        },
      },
      hooks: {
        setCursor: [
          (u: any) => {
            if (!tooltipsEnabled) return;
            const idx = u.cursor?.idx;
            if (idx == null || idx < 0) {
              if (lastHoverIdxRef.current !== null) {
                setHoverReadout(null);
                lastHoverIdxRef.current = null;
              }
              return;
            }
            if (idx === lastHoverIdxRef.current) return;
            lastHoverIdxRef.current = idx;

            const xVal = u.data[0][idx];
            const yVal = u.data[1][idx];
            if (xVal != null && yVal != null && Number.isFinite(xVal) && Number.isFinite(yVal)) {
              const series = config.series[0];
              setHoverReadout({
                x: formatTick(xVal, config.xAxis.type),
                y: formatTick(yVal, yScaleType),
                label: series?.label ?? 'Series',
                color: series?.color || accentColor(),
              });
            }
          },
        ],
      },
    };

    if (config.xAxis.range) {
      opts.scales.x.min = xMin ?? config.xAxis.range[0];
      opts.scales.x.max = xMax ?? config.xAxis.range[1];
    }
    if (config.yAxis.range) {
      opts.scales.y.min = yMin ?? config.yAxis.range[0];
      opts.scales.y.max = yMax ?? config.yAxis.range[1];
    }

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
  }, [config, height, validateData, getStructureKey, showGrid, yScaleType, xMin, xMax, yMin, yMax, showMarkers, lineWidth, showLegend, interactionMode, seriesVisibility, tooltipsEnabled, applySettings]);

  // -----------------------------------------------------------------------
  // 3. Chart lifecycle effect (separate from library loading).
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!loaded || !uPlotConstructorRef.current || !containerRef.current) return;

    initChart();

    const resizeObserver = new ResizeObserver(() => {
      const inst = chartInstanceRef.current;
      const box = containerRef.current;
      if (!inst || !box) return;
      if (inst.setSize) {
        inst.setSize({ width: box.clientWidth || 600, height });
      }
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', onResize);

    // Click-to-inspect using posToVal.
    let inspectContainer: HTMLDivElement | null = null;
    if (inspectable && interactionMode === 'inspect') {
      inspectContainer = containerRef.current;
      const handleCanvasClick = (event: MouseEvent) => {
        const inst = chartInstanceRef.current;
        const container = inspectContainer;
        if (!inst || !container) return;
        const series = config.series;
        if (!series.length) return;

        const rect = container.getBoundingClientRect();
        const plotLeft = inst.bbox?.left ?? yAxisSizeRef.current;
        const plotTop = inst.bbox?.top ?? 0;
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        // Convert to plot-local coordinates.
        const plotX = pointerX - plotLeft;
        const plotY = pointerY - plotTop;

        // Use uPlot's posToVal for accurate conversion.
        const xValue = inst.posToVal(plotX, 'x');
        if (!Number.isFinite(xValue)) return;

        // Find nearest valid data point.
        const xData = series[0].x;
        let nearestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < xData.length; i++) {
          // Skip NaN gaps.
          if (!isFiniteNumber(series[0].y[i])) continue;
          const dist = Math.abs(xData[i] - xValue);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        }

        if (nearestIdx < 0) return;

        const primarySeriesIndex = inspectorSeriesIndex ?? 0;
        const primary = series[primarySeriesIndex];
        if (primary && isFiniteNumber(primary.y[nearestIdx])) {
          handlePointSelect(xData[nearestIdx], primary.y[nearestIdx], primarySeriesIndex);
        }
      };

      inspectContainer.addEventListener('click', handleCanvasClick);
    }

    // Pan mode handlers.
    let panContainer: HTMLDivElement | null = null;
    if (interactionMode === 'pan') {
      panContainer = containerRef.current;
      const handlePanDown = (e: MouseEvent) => {
        const inst = chartInstanceRef.current;
        if (!inst) return;
        const xScale = inst.scales.x;
        panStateRef.current = {
          dragging: true,
          startX: e.clientX,
          startMin: xScale.min,
          startMax: xScale.max,
        };
        if (panContainer) panContainer.style.cursor = 'grabbing';
      };

      const handlePanMove = (e: MouseEvent) => {
        const state = panStateRef.current;
        const inst = chartInstanceRef.current;
        if (!state?.dragging || !inst) return;
        const dx = e.clientX - state.startX;
        const plotWidth = inst.bbox?.width ?? (containerRef.current?.clientWidth ?? 600) - yAxisSizeRef.current;
        const range = state.startMax - state.startMin;
        const shift = (dx / plotWidth) * range;
        inst.setScale('x', {
          min: state.startMin - shift,
          max: state.startMax - shift,
        });
      };

      const handlePanUp = () => {
        if (panStateRef.current) {
          panStateRef.current.dragging = false;
        }
        if (panContainer) panContainer.style.cursor = '';
      };

      panContainer.addEventListener('mousedown', handlePanDown);
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      // Cleanup handlers are registered conditionally above; use stored refs.
    };
  }, [loaded, initChart, height, inspectable, interactionMode, inspectorSeriesIndex, config.series, handlePointSelect, tooltipsEnabled]);

  const onResize = () => {
    const inst = chartInstanceRef.current;
    const box = containerRef.current;
    if (!inst || !box) return;
    if (inst.setSize) {
      inst.setSize({ width: box.clientWidth || 600, height });
    }
  };

  // -----------------------------------------------------------------------
  // Cleanup on unmount (separate from library loading).
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current && chartInstanceRef.current.destroy) {
        chartInstanceRef.current.destroy();
      }
      chartInstanceRef.current = null;
      chartStructureRef.current = null;
    };
  }, []);

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
        <button type="button" onClick={retryLoad} aria-label="Retry loading plot">
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

  const settingsPanelId = useId().replace(/:/g, '-');

  return (
    <section className={`eng-plot ${className || ''}`} aria-label={config.title || 'Engineering plot'}>
      {config.title && <h2 className="eng-plot-title">{config.title}</h2>}
      {config.description && <p className="eng-plot-description">{config.description}</p>}
      <div className="eng-plot-chart-region">
        <div
          ref={containerRef}
          style={{ width: '100%', height, position: 'relative' }}
          aria-hidden="true"
        />
      </div>
      {hoverReadout && interactionMode === 'inspect' && tooltipsEnabled && (
        <div className="eng-plot-hover-region">
          <div className="eng-plot-hover-readout" aria-live="polite">
            <span className="eng-plot-hover-series" style={{ color: hoverReadout.color }}>
              {hoverReadout.label}
            </span>
            <span className="eng-plot-hover-x">X: {hoverReadout.x}</span>
            <span className="eng-plot-hover-y">Y: {hoverReadout.y}</span>
          </div>
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
            aria-expanded={showSettings}
            aria-controls={settingsPanelId}
            onClick={() => setShowSettings((value) => !value)}
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
        <div id={settingsPanelId} className="eng-plot-settings-panel" role="region" aria-label="Graph settings">
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
