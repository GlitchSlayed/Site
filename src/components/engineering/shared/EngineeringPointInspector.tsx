// Polished click-to-inspect engineering readout card.
// Displays selected operating point data from an interactive plot.
// Reusable across engineering disciplines - not hardcoded to aircraft.
import type { EngineeringOutputValue } from '../../../lib/engineering/types';
import { formatResult } from '../../../lib/engineering/format';

interface InspectorMetric {
  id: string;
  label: string;
  unit?: string;
  significantFigures?: number;
  engineeringNotation?: boolean;
}

interface EngineeringPointInspectorProps {
  selected: { x: number; y: number; seriesIndex: number; seriesLabel: string } | null;
  metrics: InspectorMetric[];
  metricValues: Record<string, number>; // metricId -> value at selected point
  onClear: () => void;
  className?: string;
  title?: string;
}

export function EngineeringPointInspector({
  selected,
  metrics,
  metricValues,
  onClear,
  className,
  title = 'Selected Operating Point',
}: EngineeringPointInspectorProps) {
  if (!selected) return null;

  return (
    <section
      className={`eng-inspector ${className || ''}`}
      aria-label="Engineering point inspector"
    >
      <div className="eng-inspector-header">
        <h3 className="eng-inspector-title">{title}</h3>
        <span className="eng-inspector-indicator" aria-hidden="true">●</span>
        <button
          type="button"
          className="eng-inspector-clear"
          onClick={onClear}
          aria-label="Clear selection"
        >
          Clear selection
        </button>
      </div>

      <div className="eng-inspector-grid">
        {metrics.map((metric) => {
          const value = metricValues[metric.id];
          const formatted = formatResult({
            value,
            unit: metric.unit,
            label: metric.label,
            significantFigures: metric.significantFigures,
            engineeringNotation: metric.engineeringNotation,
          });
          return (
            <div key={metric.id} className="eng-inspector-metric">
              <span className="eng-inspector-metric-label">{metric.label}</span>
              <span className="eng-inspector-metric-value">{formatted.value}</span>
              {formatted.unit && <span className="eng-inspector-metric-unit">[{formatted.unit}]</span>}
            </div>
          );
        })}
      </div>

      <div className="eng-inspector-divider" />

      <p className="eng-inspector-selected">
        Selected at {selected.seriesLabel}: x = {selected.x.toLocaleString(undefined, { maximumFractionDigits: 3 })}, y = {selected.y.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      </p>
    </section>
  );
}
