// Interactive scientific plot built on Plotly.js, loaded lazily only when visible.
// All calculations remain in the model layer; this component only renders.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineeringPlotConfig, PlotSeries } from '../../../lib/engineering/types';

interface EngineeringPlotProps {
  config: EngineeringPlotConfig;
  className?: string;
  height?: number;
}

const PLOTLY_MODULE = 'plotly.js-dist-min';

function isLightTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';
}

export function EngineeringPlot({ config, className, height = 400 }: EngineeringPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [plotId, setPlotId] = useState<number | null>(null);
  const mountedRef = useRef(false);
  const lastDataRef = useRef<string | null>(null);

  const loadPlotly = useCallback(async () => {
    if (plotlyRef.current) {
      setLoaded(true);
      return;
    }
    try {
      // Dynamic import: Plotly is never part of the site-wide bundle.
      const module = await import(PLOTLY_MODULE);
      plotlyRef.current = module;
      setLoaded(true);
      setLoadError(null);
      if (mountedRef.current && containerRef.current) {
        drawPlot(module);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error('Failed to load Plotly'));
    }
  }, []);

  const traceForSeries = (series: PlotSeries) => ({
    x: series.x,
    y: series.y,
    mode: series.mode ?? 'lines',
    name: series.label,
    type: 'scatter' as const,
    line: series.color ? { color: series.color } : undefined,
    marker: series.color ? { color: series.color, size: 6 } : undefined,
    visible: series.visible !== false,
    hovertemplate: `${series.label}<br>%{xaxis.title.text}: %{x}<br>%{yaxis.title.text}: %{y}<extra></extra>`,
  });

  const layoutFor = (): any => {
    const dark = !isLightTheme();
    return {
      title: { text: config.title || '', font: { size: 16 } },
      font: { size: 12 },
      xaxis: {
        title: `${config.xAxis.title}${config.xAxis.unit ? ` (${config.xAxis.unit})` : ''}`,
        type: config.xAxis.type ?? 'linear',
        range: config.xAxis.range,
        automargin: true,
      },
      yaxis: {
        title: `${config.yAxis.title}${config.yAxis.unit ? ` (${config.yAxis.unit})` : ''}`,
        type: config.yAxis.type ?? 'linear',
        range: config.yAxis.range,
        automargin: true,
      },
      showlegend: config.legend !== false,
      legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 },
      hovermode: 'closest',
      template: dark ? 'plotly_dark' : 'plotly',
      margin: { l: 60, r: 20, t: 60, b: 60 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
    };
  };

  const drawPlot = useCallback(
    (plotly: any) => {
      if (!containerRef.current) return;
      const data = config.series.map(traceForSeries) as any;
      const dataSignature = JSON.stringify(data);
      if (dataSignature === lastDataRef.current && plotId !== null) {
        PlotlyUpdate(plotly, containerRef.current, data, layoutFor());
        return;
      }
      lastDataRef.current = dataSignature;
      if (plotId !== null) {
        plotly.react(containerRef.current, data, layoutFor(), { responsive: true });
      } else {
        plotly.newPlot(containerRef.current, data, layoutFor(), {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        });
        setPlotId(Date.now());
      }
    },
    [config],
  );

  // Theme change handler.
  useEffect(() => {
    if (!mountedRef.current || !plotlyRef.current || !containerRef.current) return;
    const observer = new MutationObserver(() => {
      drawPlot(plotlyRef.current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [drawPlot]);

  useEffect(() => {
    mountedRef.current = true;
    loadPlotly();
    return () => {
      mountedRef.current = false;
    };
  }, [loadPlotly]);

  useEffect(() => {
    if (!loaded || !plotlyRef.current || !containerRef.current) return;
    drawPlot(plotlyRef.current as any);
    // Resize handling.
    const resizeObserver = new ResizeObserver(() => {
      (plotlyRef.current as any).Plotly?.Plots?.resize?.(containerRef.current);
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', onResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [loaded, drawPlot]);

  const onResize = () => {
    if (plotlyRef.current && containerRef.current) {
      (plotlyRef.current as any).Plots.resize(containerRef.current);
    }
  };

  const handleResetView = () => {
    if (!plotlyRef.current || !containerRef.current) return;
    plotlyRef.current.relayout(containerRef.current, {
      'xaxis.autorange': true,
      'yaxis.autorange': true,
    });
  };

  const handleExportPng = () => {
    if (!plotlyRef.current || !containerRef.current) return;
    plotlyRef.current.downloadImage(containerRef.current, { format: 'png', width: 1000, height: 600 });
  };

  const handleExportSvg = async () => {
    if (!plotlyRef.current || !containerRef.current) return;
    try {
      const svg = await plotlyRef.current.toSVG(containerRef.current, { width: 1000, height: 600 });
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
      // SVG export not supported in this Plotly build.
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

  const PlotlyUpdate = (
    plotly: any,
    container: HTMLDivElement,
    data: any[],
    layout: any,
  ) => {
    plotly.react(container, data, layout, { responsive: true });
  };
  if (loadError) {
    return (
      <div className={`eng-plot eng-plot-error ${className || ''}`} role="alert" aria-live="polite">
        <p>Unable to load the interactive plot.</p>
        <button type="button" onClick={loadPlotly} aria-label="Retry loading plot">
          Retry
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`eng-plot eng-plot-loading ${className || ''}`} style={{ height }}>
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
      <div ref={containerRef} style={{ width: '100%', height }} />
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
      <p className="eng-plot-axes" id={`eng-plot-axes-${plotId}`}>
        {xLabel} &mdash; {yLabel}
      </p>
    </section>
  );
}
