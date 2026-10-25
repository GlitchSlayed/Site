// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';
import {
  clamp,
  isFiniteNumber,
} from '../../../lib/engineering/validation';

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
}

export function EngineeringPlot({ config, className, height = 400 }: EngineeringPlotProps) {
  // Separate the library constructor from the instantiated chart.
  const uPlotConstructorRef = useRef<any>(null);
  const chartInstanceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [initError, setInitError] = useState<Error | null>(null);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    if (uPlotConstructorRef.current) {
      setLoaded(true);
      return;
    }
    try {
      // String-literal dynamic import so Vite code-splits uPlot into its own chunk.
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

  // Validate and sanitize plot data before passing to uPlot.
  const validateData = useCallback(
    (series: PlotSeries[]): { valid: boolean; data: number[][]; error: string | null } => {
      if (!series.length) {
        return { valid: false, data: [], error: 'No data series configured.' };
      }

      const x = series[0].x;
      if (!x.length) {
        return { valid: false, data: [], error: 'No X data points.' };
      }

      // Ensure X is sorted ascending.
      const xSorted = [...x].sort((a, b) => a - b);
      const isSorted = x.every((v, i) => i === 0 || v >= x[i - 1]);
      if (!isSorted) {
        console.warn('[EngineeringPlot] X values were not sorted; sorted for uPlot.');
      }

      const data: number[][] = [xSorted];

      for (const s of series) {
        if (!s.y || s.y.length !== xSorted.length) {
          console.error(
            `[EngineeringPlot] Series "${s.label}" Y length (${s.y?.length ?? 0}) ` +
              `does not match X length (${xSorted.length}).`,
          );
          return {
            valid: false,
            data: [],
            error: `Data length mismatch for series "${s.label}".`,
          };
        }

        const ySanitized: number[] = [];
        for (let i = 0; i < xSorted.length; i++) {
          const y = s.y[i];
          if (!isFiniteNumber(y)) {
            ySanitized.push(0);
            console.warn(
              `[EngineeringPlot] Series "${s.label}" has nonfinite Y at index ${i}; replaced with 0.`,
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
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 18, label: { text: xTitle, rotate: 0 } }, // bottom x axis
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 36, label: { text: yTitle, rotate: 0 } }, // left y axis
    ];
  };

  const initChart = useCallback(() => {
    const uPlot = uPlotConstructorRef.current;
    const container = containerRef.current;
    if (!uPlot || !container) return;

    // Abort if container has no width yet; will retry on resize.
    const width = container.clientWidth;
    if (width <= 0) {
      return;
    }

    // Destroy any previous instance.
    if (chartInstanceRef.current && chartInstanceRef.current.destroy) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const validation = validateData(config.series);
    if (!validation.valid) {
      setInitError(new Error(validation.error ?? 'Unknown plot error.'));
      return;
    }
    setInitError(null);

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

    // Apply axis ranges if configured.
    if (config.xAxis.range) {
      opts.scales.x.min = config.xAxis.range[0];
      opts.scales.x.max = config.xAxis.range[1];
    }
    if (config.yAxis.range) {
      opts.scales.y.min = config.yAxis.range[0];
      opts.scales.y.max = config.yAxis.range[1];
    }

    try {
      const inst = new uPlot(opts, validation.data, container);
      chartInstanceRef.current = inst;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to initialize plot');
      console.error('[EngineeringPlot] uPlot construction failed:', err);
      setInitError(err);
    }
  }, [config, height, validateData]);

  // Theme change redraw.
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
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [loaded, initChart, height]);

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
    </section>
  );
}
