// Interactive scientific plot built on uPlot, loaded lazily only when visible.
// uPlot has no eval/new-Function dependency, so it works under strict CSP.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';

interface EngineeringPlotProps {
  config: EngineeringPlotConfig;
  className?: string;
  height?: number;
}

const UPLOT_MODULE = 'uplot';

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

export function EngineeringPlot({ config, className, height = 400 }: EngineeringPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const mountedRef = useRef(false);
  const lastDataRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (uRef.current) {
      setLoaded(true);
      return;
    }
    try {
      // Dynamic import: uPlot is never part of the site-wide bundle.
      const mod = await import(UPLOT_MODULE);
      uRef.current = (mod.default ?? mod) as any;
      setLoaded(true);
      setLoadError(null);
      if (mountedRef.current && containerRef.current) {
        draw();
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
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 16 }, // bottom x axis
      { show: true, stroke: textColor(), grid: { stroke: gridColor() }, size: 34 }, // left y axis
    ];
  };

  const draw = useCallback(() => {
    const u = uRef.current;
    const container = containerRef.current;
    if (!u || !container) return;

    // Destroy previous instance if any.
    if (u.destroy) u.destroy();

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
      xAxis: { ...config.xAxis.range && { min: config.xAxis.range[0], max: config.xAxis.range[1] } },
      yAxis: { ...config.yAxis.range && { min: config.yAxis.range[0], max: config.yAxis.range[1] } },
      cursor: {
        show: config.tooltips !== false,
        x: true,
        y: true,
        lock: 'x',
        points: { show: true, size: 5, stroke: '#fff', width: 0 },
      },
      legend: { show: config.legend !== false, width: 240, live: true },
    };

    try {
      const inst = new u(opts, data, container);
      uRef.current = inst;
      lastDataRef.current = JSON.stringify(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error('Failed to initialize plot'));
    }
  }, [config, height]);

  // Theme change redraw.
  useEffect(() => {
    if (!mountedRef.current || !uRef.current || !containerRef.current) return;
    const observer = new MutationObserver(() => {
      draw();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      if (uRef.current && uRef.current.destroy) {
        uRef.current.destroy();
      }
      uRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!loaded || !uRef.current || !containerRef.current) return;
    draw();
    const resizeObserver = new ResizeObserver(() => {
      const inst = uRef.current;
      if (!inst) return;
      const box = containerRef.current!;
      if (inst.setSize) inst.setSize(box.clientWidth || 600, height);
      else draw();
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', onResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [loaded, draw, height]);

  const onResize = () => {
    const inst = uRef.current;
    const box = containerRef.current;
    if (!inst || !box) return;
    if (inst.setSize) inst.setSize(box.clientWidth || 600, height);
    else draw();
  };

  const handleResetView = () => {
    const inst = uRef.current;
    if (!inst) return;
    try {
      if (inst.setScale) {
        inst.setScale({ x: { min: config.xAxis.range?.[0], max: config.xAxis.range?.[1] } });
      }
    } catch {
      // reset not supported; no-op
    }
  };

  const handleExportSvg = () => {
    const inst = uRef.current;
    if (!inst || !inst.toSVG) return;
    try {
      const svg = inst.toSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(config.title || 'plot').replace(/\s+/g, '_')}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // SVG export not supported in this build.
    }
  };

  const handleExportPng = () => {
    const inst = uRef.current;
    if (!inst || !inst.toSVG) return;
    try {
      const svg = inst.toSVG();
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = isDark() ? '#0a0a0a' : '#ffffff';
        ctx.fillRect(0, 0, 1000, 600);
        ctx.drawImage(img, 0, 0, 1000, 600);
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(config.title || 'plot').replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
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
        <button type="button" onClick={handleExportSvg} aria-label="Export plot as SVG">
          Export SVG
        </button>
        <button type="button" onClick={handleExportCsv} aria-label="Export data as CSV">
          Export CSV
        </button>
      </div>
    </section>
  );
}
