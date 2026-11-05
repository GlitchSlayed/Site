import { formatNumber } from '../../lib/engineering/format';
export interface MeasurementProps {
  label: string;
  value: number;
  unit: string;
  uncertainty?: number;
  uncertaintyLabel?: string;
  method?: string;
  conditions?: string;
  significantFigures?: number;
}
/** Shows author-supplied uncertainty; never invents a confidence level. */
export function Measurement({ label, value, unit, uncertainty, uncertaintyLabel = 'Reported uncertainty', method, conditions, significantFigures = 4 }: MeasurementProps) {
  const invalid = !Number.isFinite(value) || (uncertainty !== undefined && (!Number.isFinite(uncertainty) || uncertainty < 0));
  if (invalid) return <p role="alert">{label}: supply a finite value and nonnegative uncertainty.</p>;
  const format = (number: number) => formatNumber(number, { sigFigs: significantFigures });
  return <figure className="mdx-measurement">
    <figcaption className="mdx-block-label">{label}</figcaption>
    <p className="mdx-measurement-value">{format(value)}{uncertainty !== undefined && <> ± {format(uncertainty)}</>} <span>{unit}</span></p>
    {uncertainty !== undefined && <p>{uncertaintyLabel}</p>}
    {method && <p><strong>Method:</strong> {method}</p>}
    {conditions && <p><strong>Conditions:</strong> {conditions}</p>}
  </figure>;
}
