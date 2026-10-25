// Interactive scientific plot built on uPlot, loaded lazily only when the
// component mounts. uPlot has no eval/new-Function dependency, so it works
// under strict CSP. All calculations remain in the model layer; this
// component only renders.
//
// Lifecycle rules:
// - All React hooks run unconditionally, before any early return (fixes the
//   hook-order / minified React #310 crash).
// - The chart instance is created in a structural effect and destroyed in its
//   cleanup, so mounts, updates, unmounts and remounts are safe.
// - Style-only changes (grid, markers, line width, series visibility, axis
//   limits) are applied live to the existing instance via applySettings.
// - Structural changes (series, axes, scale type, precision, theme) destroy
//   and recreate the chart.
// - Every DOM event listener is tracked and removed in cleanup.
import { useCallback, useEffect, useRef, useState, useId } from 'react';
import type uPlot from 'uplot';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';
import { isFiniteNumber, significantFigures } from '../../../lib/engineering/validation';
import { EngineeringPointInspector } from '../shared/EngineeringPointInspector';

type InteractionMode = 'inspect' | 'zoom' | 'pan';
type Precision = 3 | 4 | 5 | 6;

const PRECISION_LABELS: Record<Precision, string> = { 3: '3 sig figs', 4: '4 sig figs', 5: '5 sig figs', 6: '6 sig figs' };

// uPlot scale distribution constants (uPlot declares these as a const enum,
// which is awkward to import under isolatedModules).
const DISTR_LINEAR = 1;
const DISTR_LOGARITHMIC = 3;

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

interface InspectionPoint {
  x: number;
  y: number;
  seriesIndex: number;
  seriesLabel: string;
  xText?: string;
  yText?: string;
}

interface InspectionState {
  primary: InspectionPoint | null;
  comparison: InspectionPoint | null;
}

interface ReadoutSeries {
  label: string;
  value: string;
  color: string;
}

interface ReadoutState {
  x: string;
  series: ReadoutSeries[];
}

interface EngineeringPlotProps {
  config: EngineeringPlotConfig;
  className?: string;
  height?: number;
  onPointSelect?: (x: number, y: number, seriesIndex: number, kind: 'primary' | 'comparison') => void;
  inspectable?: boolean;
  inspectorSeriesIndex?: number;
  inspectorMetrics?: Array<{ id: string; label: string; unit?: string; significantFigures?: number }>;
  inspectorMetricValues?: Record<string, number>;
  inspectorComparisonValues?: Record<string, number>;
}

type PlotInstance = InstanceType<typeof uPlot>;

function readTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function themeText(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? '#ededed' : '#171717';
}

function themeGrid(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? '#252525' : '#dedede';
}

function themeAccent(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? '#ff603b' : '#c63c18';
}

/** Format a value for an axis tick or cursor readout.
 *  Never exceeds 5 decimal places; trailing zeros are trimmed. */
function formatAxisValue(val: number, unit: string | undefined, sigFigs: number): string {
  if (!isFiniteNumber(val)) return '—';
  if (val === 0) return unit && unit !== '-' ? `0 [${unit}]` : '0';

  const abs = Math.abs(val);
  let formatted: string;

  if (abs < 0.01 || abs >= 1000) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = val / Math.pow(10, exponent);
    const prefix = ENGINEERING_PREFIXES[exponent] ?? `×10^${exponent}`;
    formatted = `${significantFigures(scaled, 3)}${prefix}`;
  } else {
    const capped = Math.round(significantFigures(val, sigFigs) * 100000) / 100000;
    formatted = capped.toString();
    if (!Number.isInteger(capped) && !formatted.includes('.')) {
      formatted = capped.toFixed(1);
    }
    formatted = formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '');
  }

  return unit && unit !== '-' ? `${formatted} [${unit}]` : formatted;
}

/** Format a tick label for an axis (no unit suffix). */
function formatTick(val: number, sigFigs: number): string {
  if (!Number.isFinite(val)) return '';
  if (val === 0) return '0';

  const abs = Math.abs(val);
  let formatted: string;

  if (abs < 0.01 || abs >= 1000) {
    const exponent = Math.floor(Math.log10(abs) / 3) * 3;
    const scaled = val / Math.pow(10, exponent);
    const prefix = ENGINEERING_PREFIXES[exponent] ?? `×10^${exponent}`;
    formatted = `${significantFigures(scaled, 3)}${prefix}`;
  } else {
    const capped = Math.round(significantFigures(val, sigFigs) * 100000) / 100000;
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
  inspectorMetrics = [],
  inspectorMetricValues = {},
  inspectorComparisonValues = {},
}: EngineeringPlotProps) {
  // -----------------------------------------------------------------------
  // Refs (all created unconditionally at the top of the render).
  // -----------------------------------------------------------------------
  const uPlotConstructorRef = useRef<typeof uPlot | null>(null);
  const chartInstanceRef = useRef<PlotInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartStructureRef = useRef<string | null>(null);
  const configRef = useRef<EngineeringPlotConfig>(config);
  const listenersRef = useRef<Array<() => void>>([]);
  const themeRef = useRef(readTheme());

  // Axes size refs for dynamic measurement.
  const xAxisSizeRef = useRef(24);
  const yAxisSizeRef = useRef(48);

  // Pan / touch state.
  const panStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startMin: number;
    startMax: number;
  } | null>(null);
  const lastHoverIdxRef = useRef<number | null>(null);

  // -----------------------------------------------------------------------
  // State (all hooks unconditional, before any early return).
  // -----------------------------------------------------------------------
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);

  const [inspection, setInspection] = useState<InspectionState>({ primary: null, comparison: null });
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
  const [sigFigs, setSigFigs] = useState<Precision>(4);
  const [cursorReadoutEnabled, setCursorReadoutEnabled] = useState(config.tooltips !== false);
  const [hoverReadout, setHoverReadout] = useState<ReadoutState | null>(null);

  // Bumps whenever the series data reference changes so the chart re-renders
  // new data on the existing instance (no destruction/recreation).
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    setDataVersion((version) => version + 1);
  }, [config.series]);

  // settingsPanelId must come before any conditional return.
  const settingsPanelId = useId().replace(/:/g, '-');

  // Keep the latest config in a ref so style effects never depend on prop
  // identity (callers may pass inline objects).
  configRef.current = config;

  const tooltipsEnabled = cursorReadoutEnabled && config.tooltips !== false;

  // -----------------------------------------------------------------------
  // Derived data validation.
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

      for (const s of series) {
        if (!s.x || s.x.length !== x.length) {
          return { valid: false, data: [], error: `X coordinate mismatch for series "${s.label}".` };
        }
        for (let i = 0; i < x.length; i++) {
          if (s.x[i] !== x[i]) {
            return { valid: false, data: [], error: `X coordinate mismatch for series "${s.label}".` };
          }
        }
      }

      const pairs = x.map((xi, i) => ({ x: xi, i }));
      pairs.sort((a, b) => a.x - b.x);
      const sortedIndices = pairs.map((p) => p.i);

      const data: number[][] = [x];
      for (const s of series) {
        const ySanitized: number[] = [];
        for (const idx of sortedIndices) {
          ySanitized.push(isFiniteNumber(s.y[idx]) ? s.y[idx] : NaN);
        }
        data.push(ySanitized);
      }

      return { valid: true, data, error: null };
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Structural key: changes destroy and recreate the chart instance.
  // Style-only settings live in applySettings and do not recreate.
  // -----------------------------------------------------------------------
  const getStructureKey = useCallback((): string => {
    return JSON.stringify({
      xAxis: config.xAxis,
      yAxis: config.yAxis,
      series: config.series.map((s) => ({ id: s.id, label: s.label, mode: s.mode, color: s.color })),
      scaleX: config.xAxis.range,
      scaleY: config.yAxis.range,
      distr: yScaleType,
      showLegend,
      sigFigs,
      theme: readTheme(),
    });
  }, [config.xAxis, config.yAxis, config.series, yScaleType, showLegend, sigFigs]);

  const buildSeries = useCallback((): any[] => {
    const series: any[] = [{}];
    for (const s of configRef.current.series) {
      const visible = seriesVisibility[s.id] !== false;
      series.push({
        label: s.label,
        stroke: s.color || themeAccent(themeRef.current),
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
  }, [seriesVisibility, lineWidth, showMarkers]);

  const buildAxes = useCallback((): any[] => {
    const theme = themeRef.current;
    const xTitle = `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`;
    const yTitle = `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`;

    const xAxisSize = Math.max(24, measureTextWidth(xTitle, 12) * 0.5 + 14);
    const yAxisSize = Math.max(48, measureTextWidth(yTitle, 12) * 0.5 + 14);
    xAxisSizeRef.current = xAxisSize;
    yAxisSizeRef.current = yAxisSize;

    const gridStroke = showGrid ? themeGrid(theme) : 'transparent';

    return [
      {
        show: true,
        stroke: themeText(theme),
        grid: { stroke: gridStroke },
        size: xAxisSize,
        label: xTitle,
        tick: (val: number) => formatTick(val, sigFigs),
      },
      {
        show: true,
        stroke: themeText(theme),
        grid: { stroke: gridStroke },
        size: yAxisSize,
        label: yTitle,
        tick: (val: number) => formatTick(val, sigFigs),
      },
    ];
  }, [config.xAxis, config.yAxis, sigFigs, showGrid]);

  // Apply style-only settings to an existing chart instance without recreating it.
  const applySettings = useCallback((inst: PlotInstance) => {
    if (!inst) return;
    try {
      const theme = themeRef.current;
      const cfg = configRef.current;
      let needsRedraw = false;

      cfg.series.forEach((series, index) => {
        const visible = seriesVisibility[series.id] !== false;
        // setSeries supports show/focus natively and redraws.
        inst.setSeries(index + 1, { show: visible });
        // Width and marker state are not covered by setSeries; mutate the
        // series descriptor and redraw once at the end.
        const uSeries = inst.series[index + 1];
        if (uSeries) {
          if (uSeries.width !== lineWidth) {
            uSeries.width = lineWidth;
            needsRedraw = true;
          }
          const pointsShow = showMarkers && (series.mode === 'markers' || series.mode === 'lines+markers');
          if (uSeries.points?.show !== pointsShow) {
            uSeries.points = { ...uSeries.points, show: pointsShow };
            needsRedraw = true;
          }
        }
      });

      if (inst.axes) {
        inst.axes.forEach((axis) => {
          if (axis && axis.grid) {
            const stroke = showGrid ? themeGrid(theme) : 'transparent';
            if (axis.grid.stroke !== stroke) {
              axis.grid.stroke = stroke;
              needsRedraw = true;
            }
          }
        });
      }

      if (inst.scales) {
        const xScale = inst.scales.x;
        const yScale = inst.scales.y;
        if (xScale && (xMin != null || xMax != null)) {
          inst.setScale('x', { min: xMin ?? xScale.min ?? 0, max: xMax ?? xScale.max ?? 0 });
        }
        if (yScale && (yMin != null || yMax != null)) {
          inst.setScale('y', { min: yMin ?? yScale.min ?? 0, max: yMax ?? yScale.max ?? 0 });
        }
      }

      if (needsRedraw && inst.redraw) {
        inst.redraw();
      }
    } catch (e) {
      console.warn('[EngineeringPlot] applySettings partial failure:', e);
    }
  }, [config.series, seriesVisibility, lineWidth, showMarkers, showGrid, xMin, xMax, yMin, yMax]);

  const initChart = useCallback(() => {
    const uPlot = uPlotConstructorRef.current;
    const container = containerRef.current;
    if (!uPlot || !container) return;

    const validation = validateData(config.series);
    if (!validation.valid) {
      setInitError(new Error(validation.error ?? 'Unknown plot error.'));
      return;
    }
    setInitError(null);

    const width = container.clientWidth;
    if (width <= 0) return;

    const inst = chartInstanceRef.current;
    const structureKey = getStructureKey();

    // Same structure: update data on the existing instance.
    if (inst && inst.setData && chartStructureRef.current === structureKey) {
      try {
        inst.setData(validation.data as unknown as uPlot.AlignedData, false);
        applySettings(inst);
      } catch {
        // Fall through to full reinitialization below.
      }
      chartStructureRef.current = structureKey;
      return;
    }

    // Different structure (or no instance): destroy and recreate.
    if (inst && inst.destroy) {
      inst.destroy();
    }

    const xRange = config.xAxis.range ?? [0, 1];
    const yRange = config.yAxis.range ?? [0, 1];
    const theme = themeRef.current;

    const opts: any = {
      width,
      height,
      plugins: [],
      series: buildSeries(),
      axes: buildAxes(),
      scales: {
        x: { time: false, min: xMin ?? xRange[0], max: xMax ?? xRange[1] },
        y: {
          distr: yScaleType === 'log' ? DISTR_LOGARITHMIC : DISTR_LINEAR,
          min: yMin ?? yRange[0],
          max: yMax ?? yRange[1],
        },
      },
      cursor: {
        show: tooltipsEnabled,
        x: true,
        y: true,
        lock: 'x',
        points: { show: true, size: 5, stroke: '#ffffff', width: 0 },
      },
      legend: { show: showLegend, live: false },
      select:
        interactionMode === 'zoom'
          ? {
              show: true,
              marginLeft: yAxisSizeRef.current,
              marginTop: 0,
              marginRight: 20,
              marginBottom: xAxisSizeRef.current,
              stroke: '#ff603b80',
              fill: '#ff603b20',
              cursor: 'crosshair',
            }
          : false,
      hooks: {
        setCursor: [
          (u: PlotInstance) => {
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

            const data = u.data;
            if (!data) return;
            const xVal = data[0][idx];
            if (!isFiniteNumber(xVal)) {
              setHoverReadout(null);
              return;
            }

            const series = config.series;
            const entries: ReadoutSeries[] = [];
            for (let s = 1; s < data.length; s++) {
              const spec = series[s - 1];
              if (!spec) continue;
              if (seriesVisibility[spec.id] === false) continue;
              const yVal = data[s][idx];
              if (!isFiniteNumber(yVal)) continue;
              entries.push({
                label: spec.label,
                value: formatAxisValue(yVal, config.yAxis.unit, sigFigs),
                color: spec.color || themeAccent(theme),
              });
            }

            if (entries.length === 0) {
              setHoverReadout(null);
              return;
            }

            setHoverReadout({
              x: formatAxisValue(xVal, config.xAxis.unit, sigFigs),
              series: entries,
            });
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
      const newInst = new uPlot(opts, validation.data as unknown as uPlot.AlignedData, container);
      chartInstanceRef.current = newInst;
      chartStructureRef.current = structureKey;
      applySettings(newInst);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize plot');
      console.error('[EngineeringPlot] uPlot construction failed:', err);
      setInitError(err);
    }
  }, [
    config,
    height,
    validateData,
    getStructureKey,
    applySettings,
    buildSeries,
    buildAxes,
    tooltipsEnabled,
    interactionMode,
    seriesVisibility,
    yScaleType,
    xMin,
    xMax,
    yMin,
    yMax,
    showMarkers,
    lineWidth,
    showLegend,
  ]);

  // -----------------------------------------------------------------------
  // Effect 1: library loading (mount-only, stable).
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
  }, []);

  const retryLoad = useCallback(() => {
    setLoadError(null);
  }, []);

  // -----------------------------------------------------------------------
  // Effect 2: chart creation / structural updates / data refresh.
  //
  // The previous instance is destroyed only when the structure actually
  // changes (initChart handles that); data-only updates are applied live.
  // The instance is destroyed on unmount by Effect 4.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!loaded || !uPlotConstructorRef.current || !containerRef.current) return;
    initChart();
  }, [loaded, containerRef.current, getStructureKey(), dataVersion, initChart]);

  // Destroy the chart instance on unmount so repeated mount/unmount cycles
  // never leak canvases, ResizeObservers or event listeners.
  useEffect(() => {
    return () => {
      const inst = chartInstanceRef.current;
      if (inst && inst.destroy) {
        inst.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Effect 3: style-only updates (applied live, no recreation).
  // -----------------------------------------------------------------------
  useEffect(() => {
    const inst = chartInstanceRef.current;
    if (inst) applySettings(inst);
  }, [showGrid, lineWidth, showMarkers, seriesVisibility, xMin, xMax, yMin, yMax, applySettings]);

  // -----------------------------------------------------------------------
  // Effect 4: resize, input listeners, and teardown.
  // -----------------------------------------------------------------------
  const onResize = () => {
    const inst = chartInstanceRef.current;
    const box = containerRef.current;
    if (!inst || !box) return;
    if (inst.setSize) {
      inst.setSize({ width: box.clientWidth || 600, height });
    }
  };

  const handleContainerClick = useCallback(
    (event: MouseEvent) => {
      const inst = chartInstanceRef.current;
      const container = containerRef.current;
      if (!inst || !container || !inspectable || interactionMode !== 'inspect') return;

      const rect = container.getBoundingClientRect();
      const plotLeft = inst.bbox?.left ?? 0;
      const plotTop = inst.bbox?.top ?? 0;
      const plotX = event.clientX - rect.left - plotLeft;
      const plotY = event.clientY - rect.top - plotTop;

      const xValue = inst.posToVal(plotX, 'x');
      if (!Number.isFinite(xValue)) return;

      const series = config.series;
      const xData = series[0]?.x;
      if (!xData?.length) return;

      let nearestIdx = -1;
      let minDist = Infinity;
      for (let i = 0; i < xData.length; i++) {
        if (!isFiniteNumber(xData[i])) continue;
        const dist = Math.abs(xData[i] - xValue);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }

      if (nearestIdx < 0) return;

      // Among visible series at this x, pick the point nearest the click
      // in screen-Y space (click a curve to inspect that operating point).
      const yValue = Number.isFinite(plotY) ? inst.posToVal(plotY, 'y') : NaN;
      let bestSeries = inspectorSeriesIndex ?? 0;
      let bestDist = Infinity;
      for (let s = 0; s < series.length; s++) {
        const spec = series[s];
        if (seriesVisibility[spec.id] === false) continue;
        const y = spec.y?.[nearestIdx];
        if (!isFiniteNumber(y)) continue;
        const dist = Math.abs(y - yValue);
        if (dist < bestDist) {
          bestDist = dist;
          bestSeries = s;
        }
      }

      const spec = series[bestSeries];
      if (!spec || !isFiniteNumber(spec.y[nearestIdx])) return;

      const kind = event.shiftKey ? 'comparison' : 'primary';
      setInspection((prev) => {
        const next = { ...prev };
        const point: InspectionPoint = {
          x: xData[nearestIdx],
          y: spec.y[nearestIdx],
          seriesIndex: bestSeries,
          seriesLabel: spec.label ?? 'Series',
          xText: formatAxisValue(xData[nearestIdx], config.xAxis.unit, sigFigs),
          yText: formatAxisValue(spec.y[nearestIdx], config.yAxis.unit, sigFigs),
        };
        if (kind === 'comparison') next.comparison = point;
        else next.primary = point;
        return next;
      });
      onPointSelect?.(xData[nearestIdx], spec.y[nearestIdx], bestSeries, kind);
    },
    [inspectable, interactionMode, inspectorSeriesIndex, config.series, seriesVisibility, sigFigs, onPointSelect],
  );

  const handlePanDown = useCallback(
    (e: MouseEvent) => {
      const inst = chartInstanceRef.current;
      const xScale = inst?.scales?.x;
      if (!inst || !xScale) return;
      panStateRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startMin: xScale.min ?? 0,
        startMax: xScale.max ?? 0,
      };
    },
    [],
  );

  const handlePanMove = useCallback(
    (e: MouseEvent) => {
      const state = panStateRef.current;
      const inst = chartInstanceRef.current;
      if (!state?.dragging || !inst) return;
      const dx = e.clientX - state.startX;
      const plotWidth = inst.bbox?.width ?? (containerRef.current?.clientWidth ?? 600) - yAxisSizeRef.current;
      const range = state.startMax - state.startMin;
      const shift = (dx / plotWidth) * range;
      inst.setScale('x', { min: state.startMin - shift, max: state.startMax - shift });
    },
    [],
  );

  const handlePanUp = useCallback(() => {
    if (panStateRef.current) panStateRef.current.dragging = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const inst = chartInstanceRef.current;
      const xScale = inst?.scales?.x;
      if (!inst || !xScale) return;
      const touch = e.touches[0];
      panStateRef.current = {
        dragging: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startMin: xScale.min ?? 0,
        startMax: xScale.max ?? 0,
      };
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const state = panStateRef.current;
      const inst = chartInstanceRef.current;
      if (!state?.dragging || !inst) return;
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const plotWidth = inst.bbox?.width ?? (containerRef.current?.clientWidth ?? 600) - yAxisSizeRef.current;
      const range = state.startMax - state.startMin;
      const shift = (dx / plotWidth) * range;
      inst.setScale('x', { min: state.startMin - shift, max: state.startMax - shift });
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    if (panStateRef.current) panStateRef.current.dragging = false;
  }, []);

  const addListener = useCallback(
    <T extends Event>(
      target: EventTarget | null,
      type: string,
      handler: (evt: T) => void,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (!target) return;
      const wrapped = (evt: Event) => handler(evt as T);
      target.addEventListener(type, wrapped, options);
      listenersRef.current.push(() => target.removeEventListener(type, wrapped, options));
    },
    [],
  );

  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const container = containerRef.current;

    addListener(window, 'resize', onResize);

    if (inspectable && interactionMode === 'inspect') {
      addListener(container, 'click', handleContainerClick);
    }

    if (interactionMode === 'pan') {
      addListener(container, 'mousedown', handlePanDown);
      addListener(window, 'mousemove', handlePanMove);
      addListener(window, 'mouseup', handlePanUp);
      addListener(container, 'touchstart', handleTouchStart, { passive: false });
      addListener(window, 'touchmove', handleTouchMove, { passive: false });
      addListener(window, 'touchend', handleTouchEnd);
    }

    return () => {
      listenersRef.current.forEach((unsub) => unsub());
      listenersRef.current = [];
    };
  }, [
    loaded,
    inspectable,
    interactionMode,
    handleContainerClick,
    handlePanDown,
    handlePanMove,
    handlePanUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    addListener,
  ]);

  // -----------------------------------------------------------------------
  // Chart destruction happens in Effect 2's cleanup (structural change or
  // unmount). No separate effect is needed.
  // -----------------------------------------------------------------------

  const handleResetView = useCallback(() => {
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
  }, [config.xAxis, config.yAxis]);

  const handleAutoscale = useCallback(() => {
    const inst = chartInstanceRef.current;
    if (!inst || !inst.setData) return;
    const validation = validateData(config.series);
    if (!validation.valid) return;
    try {
      inst.setData(validation.data as unknown as uPlot.AlignedData, true);
      setXMin(null);
      setXMax(null);
      setYMin(null);
      setYMax(null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to autoscale');
      console.error('[EngineeringPlot] Autoscale failed:', err);
      setInitError(err);
    }
  }, [validateData, config.series]);

  const handleResetSettings = useCallback(() => {
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
    setSigFigs(4);
    setCursorReadoutEnabled(config.tooltips !== false);
  }, [config.tooltips]);

  const handleExportPng = useCallback(() => {
    const inst = chartInstanceRef.current;
    if (!inst) return;
    try {
      const canvas = containerRef.current?.querySelector<HTMLCanvasElement>('canvas');
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
      setInitError(err);
    }
  }, [config.title]);

  const handleExportCsv = useCallback(() => {
    const series = config.series;
    const maxLen = Math.max(...series.map((s) => s.x.length));
    const header = ['x', ...series.map((s) => s.label)].join(',');
    const rows: string[] = [header];
    for (let i = 0; i < maxLen; i++) {
      const yValues = series.map((s) => s.y[i] ?? '');
      rows.push(`${series[0]?.x[i] ?? ''},${yValues.join(',')}`);
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
  }, [config.series, config.title]);

  const datasetRange = config.series.length
    ? {
        xMin: Math.min(...config.series[0].x),
        xMax: Math.max(...config.series[0].x),
        yMin: Math.min(...config.series.flatMap((s) => s.y.filter(isFiniteNumber))),
        yMax: Math.max(...config.series.flatMap((s) => s.y.filter(isFiniteNumber))),
      }
    : null;

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

  const { primary, comparison } = inspection;

  return (
    <section className={`eng-plot ${className || ''}`} aria-label={config.title || 'Engineering plot'}>
      <header className="eng-plot-header">
        {config.title && <h2 className="eng-plot-title">{config.title}</h2>}
        <div className="eng-plot-units">
          {config.xAxis.title}{config.xAxis.unit ? ` [${config.xAxis.unit}]` : ''}&nbsp;·&nbsp;
          {config.yAxis.title}{config.yAxis.unit ? ` [${config.yAxis.unit}]` : ''}
        </div>
        {config.description && <p className="eng-plot-description">{config.description}</p>}
      </header>

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
          <button type="button" onClick={handleResetView} aria-label="Reset zoom and pan to configured limits">
            Reset View
          </button>
          <button type="button" onClick={handleAutoscale} aria-label="Autoscale axes to data">
            Autoscale
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

      <div className="eng-plot-viewport" role="region" aria-label={config.title || 'Engineering plot'}>
        <div
          ref={containerRef}
          style={{ width: '100%', height, position: 'relative', minHeight: 200 }}
          aria-hidden="true"
        />
      </div>

      {hoverReadout && tooltipsEnabled && (
        <div className="eng-plot-readout" aria-live="polite">
          <span className="eng-plot-readout-label">{hoverReadout.x}</span>
          {hoverReadout.series.map((entry) => (
            <span key={entry.label} className="eng-plot-readout-series">
              <span
                className="eng-plot-readout-marker"
                style={{ background: entry.color, boxShadow: `0 0 0 1px ${entry.color}` }}
                aria-hidden="true"
              />
              {entry.label}: {entry.value}
            </span>
          ))}
        </div>
      )}

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
              <label>
                <input
                  type="checkbox"
                  checked={cursorReadoutEnabled}
                  onChange={(e) => setCursorReadoutEnabled(e.target.checked)}
                />
                Cursor readout
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
            <div className="eng-plot-settings-row">
              <label className="eng-plot-settings-label">Precision</label>
              <select
                value={sigFigs}
                onChange={(e) => setSigFigs(Number(e.target.value) as Precision)}
                className="eng-plot-settings-select"
              >
                {Object.entries(PRECISION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="eng-plot-settings-section">
            <h4 className="eng-plot-settings-section-title">Series visibility</h4>
            <div className="eng-plot-settings-series">
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
                    style={{ background: series.color || themeAccent(themeRef.current) }}
                  />
                  {series.label}
                </label>
              ))}
            </div>
          </div>

          {datasetRange && (
            <div className="eng-plot-settings-section">
              <h4 className="eng-plot-settings-section-title">Data</h4>
              <div className="eng-plot-settings-row">
                <span className="eng-plot-settings-label">X range:</span>
                <span className="eng-plot-settings-value">
                  {formatAxisValue(datasetRange.xMin, config.xAxis.unit, sigFigs)} to{' '}
                  {formatAxisValue(datasetRange.xMax, config.xAxis.unit, sigFigs)}
                </span>
                <span className="eng-plot-settings-label">Y range:</span>
                <span className="eng-plot-settings-value">
                  {formatAxisValue(datasetRange.yMin, config.yAxis.unit, sigFigs)} to{' '}
                  {formatAxisValue(datasetRange.yMax, config.yAxis.unit, sigFigs)}
                </span>
              </div>
              <button type="button" onClick={handleResetSettings} className="eng-plot-settings-reset">
                Reset Settings
              </button>
            </div>
          )}
        </div>
      )}

      {inspectable && (primary || comparison) && (
        <EngineeringPointInspector
          primary={primary ?? null}
          comparison={comparison ?? null}
          metrics={inspectorMetrics}
          metricValues={inspectorMetricValues}
          comparisonValues={inspectorComparisonValues}
          xUnit={config.xAxis.unit}
          yUnit={config.yAxis.unit}
          sigFigs={sigFigs}
          onClear={() => setInspection({ primary: null, comparison: null })}
        />
      )}

      <footer className="eng-plot-footer">
        {datasetRange && (
          <>
            <span className="eng-plot-footer-label">X:</span>
            <span className="eng-plot-footer-value">{formatAxisValue(datasetRange.xMin, config.xAxis.unit, sigFigs)} — {formatAxisValue(datasetRange.xMax, config.xAxis.unit, sigFigs)}</span>
            <span className="eng-plot-footer-label">Y:</span>
            <span className="eng-plot-footer-value">{formatAxisValue(datasetRange.yMin, config.yAxis.unit, sigFigs)} — {formatAxisValue(datasetRange.yMax, config.yAxis.unit, sigFigs)}</span>
          </>
        )}
      </footer>
    </section>
  );
}
