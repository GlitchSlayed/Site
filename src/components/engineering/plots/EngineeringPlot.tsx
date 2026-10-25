// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';

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
      setLoadError(error instanceof Error ? error : new Error('Failed to load plot library'));
    }
  }, []);

  const buildSeries = (): any[] => {
    // uPlot: series[0] is the shared x series (no label -> hidden from legend).
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
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 16, label: { text: xTitle } }, // bottom x axis
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 34, label: { text: yTitle } }, // left y axis
    ];
  };

  const initChart = useCallback(() => {
    const uPlot = uPlotConstructorRef.current;
    const container = containerRef.current;
    if (!uPlot || !container) return;

    // Destroy any previous instance.
    if (chartInstanceRef.current && chartInstanceRef.current.destroy) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const data: number[][] = [];
    if (config.series.length) {
      data.push([...config.series[0].x]);
      for (const s of config.series) data.push([...s.y]);
    }

    const width = container.clientWidth || 600;
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
      const inst = new uPlot(opts, data, container);
      chartInstanceRef.current = inst;
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error('Failed to initialize plot'));
    }
  }, [config, height]);

  const updateChartData = useCallback(() => {
    const inst = chartInstanceRef.current;
    if (!inst || !inst.setData) return;

    const data: number[][] = [];
    if (config.series.length) {
      data.push([...config.series[0].x]);
      for (const s of config.series) data.push([...s.y]);
    }

    try {
      inst.setData(data, false);
    } catch {
      // If setData fails, reinitialize.
      initChart();
    }
  }, [config, initChart]);

  // Theme change redraw.
  useEffect(() => {
    if (!mountedRef.current || !chartInstanceRef.current) return;
    const observer = new MutationObserver(() => {
      // Rebuild axes/stroke colors reflect theme.
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
        inst.setSize(box.clientWidth || 600, height);
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
      inst.setSize(box.clientWidth || 600, height);
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
    } catch {
      // reset not supported; no-op
    }
  };

  const handleExportSvg = () => {
    // uPlot does not provide toSVG(). SVG export is intentionally unavailable.
    // Use PNG export instead.
  };

  const handleExportPng = () => {
    const inst = chartInstanceRef.current;
    if (!inst) return;
    try {
      // uPlot renders to canvas; extract the canvas from the container.
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(config.title || 'plot').replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // PNG export not supported in this build.
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

  const xLabel = `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`;
  const yLabel = `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`;

  return (
    <section className={`eng-plot ${className || ''}`} aria-label={config.title || 'Engineering plot'}>
      {config.title && <h2 className="eng-plot-title">{config.title}</h2>}
      {config.description && <p className="eng-plot-description">{config.description}</p>}
      <div
        ref={containerRef}
        style={{ width: '100%', height, position: 'relative' }}
        aria-hidden="true"
      />
      <div className="eng-plot-axes">
        <span className="eng-plot-axislabel eng-plot-yaxislabel">{yLabel}</span>
        <span className="eng-plot-axislabel eng-plot-xaxislabel">{xLabel}</span>
      </div>
      <div className="eng-plot-actions">
        <button type="button" onClick={handleResetView} aria-label="Reset zoom and pan">
          Reset view
        </button>
        <button type="button" onClick={handleExportPng} aria-label="Export plot as PNG">
          Export PNG
        </button>
        <button type="button" onClick={handleExportSvg} aria-label="Export plot as SVG" disabled>
          Export SVG (not supported)
        </button>
        <button type="button" onClick={handleExportCsv} aria-label="Export data as CSV">
          Export CSV
        </button>
      </div>
    </section>
  );
}
