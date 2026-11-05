import type { PlotSeries } from './types';

/** Align independent scatter coordinates without dropping repeated measurements. */
export function alignScatterSeries(series: PlotSeries[]): PlotSeries[] {
  const x = [...new Set(series.flatMap(s => s.x))].sort((a, b) => a - b);
  if (x.some(value => !Number.isFinite(value))) throw new Error('Scatter X coordinates must be finite.');
  return series.flatMap(s => {
    if (s.x.length !== s.y.length) throw new Error(`${s.label}: X and Y lengths must match.`);
    const buckets = new Map<number, number[]>();
    s.x.forEach((value, i) => {
      const bucket = buckets.get(value) ?? [];
      bucket.push(s.y[i]);
      buckets.set(value, bucket);
    });
    const repeats = [...buckets.values()].reduce((max, values) => Math.max(max, values.length), 1);
    return Array.from({ length: repeats }, (_, i) => ({
      ...s,
      id: `${s.id}-observation-${i}`,
      label: i ? `${s.label} (repeat ${i + 1})` : s.label,
      x,
      y: x.map(value => buckets.get(value)?.[i] ?? NaN),
    }));
  });
}

export function csvCell(value: unknown): string {
  // Preserve real negative numbers; prevent text cells becoming spreadsheet formulas.
  let text = value == null ? '' : String(value);
  if (typeof value !== 'number' && /^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function safePageSize(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 10;
}
export function compareCells(a: unknown, b: unknown, descending = false): number {
  const absent = (value: unknown) => value == null || (typeof value === 'number' && !Number.isFinite(value));
  if (absent(a) || absent(b)) return absent(a) === absent(b) ? 0 : absent(a) ? 1 : -1;
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
  return descending ? -result : result;
}
export function heatmapError(data: number[][], ...ranges: Array<[number, number] | undefined>): string | null {
  if (!data.length || !data[0]?.length) return 'No heatmap data supplied.';
  if (data.some(row => row.length !== data[0].length)) return 'Heatmap rows must have equal lengths.';
  if (ranges.some(range => range && (!range.every(Number.isFinite) || range[0] >= range[1]))) return 'Heatmap ranges must contain two increasing finite values.';
  return null;
}

/** Shared-X alignment for independent line sampling. Never averages observations. */
export function alignLineSeries(series: PlotSeries[]): PlotSeries[] {
  const x = [...new Set(series.flatMap(s => s.x))].sort((a, b) => a - b);
  if (x.some(value => !Number.isFinite(value))) throw new Error('Line X coordinates must be finite.');
  return series.map(s => {
    if (s.x.length !== s.y.length) throw new Error(`${s.label}: X and Y lengths must match.`);
    if (new Set(s.x).size !== s.x.length) throw new Error(`${s.label}: repeated X values need ScatterPlot.`);
    const points = new Map(s.x.map((value, i) => [value, s.y[i]]));
    return { ...s, x, y: x.map(value => points.get(value) ?? NaN) };
  });
}
