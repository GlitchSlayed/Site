// Polished click-to-inspect engineering readout.
// Displays a primary operating point (and an optional comparison point) with
// coordinates, units, deltas, slopes, and model-derived metrics at each point.
import { formatResult, formatPercentageChange } from '../../../lib/engineering/format';
import { isFiniteNumber } from '../../../lib/engineering/validation';

interface InspectorMetric {
  id: string;
  label: string;
  unit?: string;
  significantFigures?: number;
  engineeringNotation?: boolean;
}

interface InspectionPoint {
  x: number;
  y: number;
  seriesIndex: number;
  seriesLabel: string;
  xText?: string;
  yText?: string;
}

interface EngineeringPointInspectorProps {
  primary: InspectionPoint | null;
  comparison: InspectionPoint | null;
  metrics: InspectorMetric[];
  metricValues: Record<string, number>; // metricId -> value at primary point
  comparisonValues: Record<string, number>; // metricId -> value at comparison point
  onClear: () => void;
  className?: string;
  title?: string;
  xUnit?: string;
  yUnit?: string;
  sigFigs?: number;
}

function formatPoint(value: number, unit: string | undefined, text?: string, sigFigs = 4): string {
  if (text) return text;
  return formatResult({ value, unit, significantFigures: sigFigs }).value;
}

export function EngineeringPointInspector({
  primary,
  comparison,
  metrics,
  metricValues = {},
  comparisonValues = {},
  onClear,
  className,
  title = 'Selected Operating Point',
  xUnit,
  yUnit,
  sigFigs = 4,
}: EngineeringPointInspectorProps) {
  if (!primary && !comparison) return null;

  const hasComparison = comparison !== null;

  const deltaX = primary && comparison ? comparison.x - primary.x : 0;
  const deltaY = primary && comparison ? comparison.y - primary.y : 0;
  const slope = primary && comparison && deltaX !== 0 ? deltaY / deltaX : null;

  return (
    <section className={`eng-inspector ${className || ''}`} aria-label="Engineering point inspector">
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
        {[
          { point: primary, label: 'Operating point' },
          { point: comparison, label: 'Comparison point' },
        ].filter((entry) => entry.point !== null).map((entry) => (
          <div key={entry.label === 'Operating point' ? 'primary' : 'comparison'} className="eng-inspector-metric">
            <span className="eng-inspector-metric-label">{entry.label}</span>
            <div className="eng-inspector-point">
              <span className="eng-inspector-series">{entry.point!.seriesLabel}</span>
              <span className="eng-inspector-coord">
                x = {formatPoint(entry.point!.x, xUnit, entry.point!.xText, sigFigs)}
              </span>
              <span className="eng-inspector-coord">
                y = {formatPoint(entry.point!.y, yUnit, entry.point!.yText, sigFigs)}
              </span>
            </div>
          </div>
        ))}

        {hasComparison && primary && comparison && (
          <div className="eng-inspector-metric eng-inspector-metric--delta">
            <span className="eng-inspector-metric-label">Difference</span>
            <div className="eng-inspector-delta">
              <span className="eng-inspector-delta-item">
                <span className="eng-inspector-delta-label">Δx</span>
                <span className="eng-inspector-delta-value">{formatPoint(deltaX, xUnit, undefined, sigFigs)}</span>
              </span>
              <span className="eng-inspector-delta-item">
                <span className="eng-inspector-delta-label">Δy</span>
                <span className="eng-inspector-delta-value">{formatPoint(deltaY, yUnit, undefined, sigFigs)}</span>
              </span>
              {slope !== null && (
                <span className="eng-inspector-delta-item">
                  <span className="eng-inspector-delta-label">Slope Δy/Δx</span>
                  <span className="eng-inspector-delta-value">{formatPoint(slope, undefined, undefined, sigFigs)}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {metrics.length > 0 && (
        <>
          <div className="eng-inspector-divider" />
          <div className="eng-inspector-grid">
            {metrics.map((metric) => {
              const primaryValue = metricValues[metric.id];
              const comparisonValue = comparisonValues[metric.id];
              const primaryFormatted = formatResult({
                value: primaryValue,
                unit: metric.unit,
                label: metric.label,
                significantFigures: metric.significantFigures,
                engineeringNotation: metric.engineeringNotation,
              });
              const comparisonFormatted = comparison !== null
                ? formatResult({
                    value: comparisonValue,
                    unit: metric.unit,
                    label: metric.label,
                    significantFigures: metric.significantFigures,
                    engineeringNotation: metric.engineeringNotation,
                  })
                : null;
              const delta =
                primary !== null && comparison !== null && isFiniteNumber(primaryValue) && isFiniteNumber(comparisonValue)
                  ? comparisonValue - primaryValue
                  : null;
              const deltaUnit = metric.unit && metric.unit !== '-' ? metric.unit : undefined;
              const deltaFormatted =
                delta !== null ? formatResult({ value: delta, unit: deltaUnit, significantFigures: metric.significantFigures }).value : null;
              const percentChange =
                primary !== null && comparison !== null && isFiniteNumber(primaryValue) && isFiniteNumber(comparisonValue)
                  ? formatPercentageChange(comparisonValue, primaryValue, metric.significantFigures)
                  : null;

              return (
                <div key={metric.id} className="eng-inspector-metric">
                  <span className="eng-inspector-metric-label">{metric.label}</span>
                  <div className="eng-inspector-metric-row">
                    <span className="eng-inspector-metric-value">{primaryFormatted.value}</span>
                    {primaryFormatted.unit && <span className="eng-inspector-metric-unit">[{primaryFormatted.unit}]</span>}
                    {comparisonFormatted && (
                      <span className="eng-inspector-metric-value eng-inspector-metric-value--compare">
                        {comparisonFormatted.value}
                        {comparisonFormatted.unit && <span className="eng-inspector-metric-unit">[{comparisonFormatted.unit}]</span>}
                      </span>
                    )}
                    {deltaFormatted !== null && (
                      <span className="eng-inspector-metric-value eng-inspector-metric-value--delta">
                        {deltaFormatted}
                        {deltaUnit && <span className="eng-inspector-metric-unit">[{deltaUnit}]</span>}
                      </span>
                    )}
                    {percentChange && <span className="eng-inspector-metric-change">{percentChange}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="eng-inspector-footer">
        {primary && (
          <p className="eng-inspector-selected">
            Selected at {primary.seriesLabel}: x = {formatPoint(primary.x, xUnit, primary.xText, sigFigs)}, y = {formatPoint(primary.y, yUnit, primary.yText, sigFigs)}
          </p>
        )}
        {hasComparison && comparison && (
          <p className="eng-inspector-selected eng-inspector-selected--compare">
            Compared at {comparison.seriesLabel}: x = {formatPoint(comparison.x, xUnit, comparison.xText, sigFigs)}, y = {formatPoint(comparison.y, yUnit, comparison.yText, sigFigs)}
          </p>
        )}
      </div>
    </section>
  );
}
