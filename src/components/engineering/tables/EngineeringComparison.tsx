// Engineering comparison table: multiple configurations, units, explicit
// percentage annotations, sorting, expandable notes, CSV export.
//
// Percentage differences are NOT auto-calculated. They must be provided
// explicitly via row.annotations[columnIndex] (e.g. "(+15.1%)").
import { useMemo, useState } from 'react';
import type { EngineeringComparisonConfig, ComparisonRow } from '../../../lib/engineering/types';
import { formatResult } from '../../../lib/engineering/format';
import { isFiniteNumber } from '../../../lib/engineering/validation';

interface EngineeringComparisonProps {
  config: EngineeringComparisonConfig;
  className?: string;
}

export function EngineeringComparison({ config, className }: EngineeringComparisonProps) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const referenceId = config.referenceConfigId || config.configurations[0]?.id;
  const referenceIndex = config.configurations.findIndex((c) => c.id === referenceId);

  const toggleNote = (rowId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleSort = (rowId: string) => {
    if (sortBy === rowId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(rowId);
      setSortDirection('asc');
    }
  };

  const sortedRows = useMemo(() => {
    const rows = [...config.rows];
    if (!sortBy) return rows;
    const colIndex = rows.findIndex((r) => r.id === sortBy);
    if (colIndex < 0) return rows;
    rows.sort((a, b) => {
      const av = Number(a.values[colIndex]);
      const bv = Number(b.values[colIndex]);
      const aNum = Number.isFinite(av);
      const bNum = Number.isFinite(bv);
      if (aNum && bNum) {
        return sortDirection === 'asc' ? av - bv : bv - av;
      }
      return String(a.values[colIndex]).localeCompare(String(b.values[colIndex]));
    });
    return rows;
  }, [config.rows, sortBy, sortDirection]);

  const formatCell = (value: string | number, unit?: string): string => {
    if (typeof value === 'string') return value;
    if (!isFiniteNumber(value)) return '—';
    return formatResult({ value, unit, significantFigures: 4 }).value;
  };

  // Extract explicit percentage annotation for a cell, if provided.
  // Accepts both parenthesized "(+5%)" and plain "+5%" formats.
  const getAnnotation = (row: ComparisonRow, colIndex: number): string | null => {
    const ann = row.annotations?.[colIndex];
    if (!ann) return null;
    // Validate the annotation looks like a percentage: (+15.1%), (-8.4%), (±2.0%), +5%, -3%
    const normalized = ann.trim();
    if (/^\([+-]?\d+(\.\d+)?%\)$/.test(normalized) || /^\(±\d+(\.\d+)?%\)$/.test(normalized)) {
      return normalized;
    }
    if (/^[+-]?\d+(\.\d+)?%$/.test(normalized)) {
      return `(${normalized})`;
    }
    return null;
  };

  return (
    <section className={`eng-comparison ${className || ''}`} aria-label="Engineering comparison">
      {config.title && <h2 className="eng-comparison-title">{config.title}</h2>}
      <div className="eng-comparison-wrapper">
        <table className="eng-comparison-table">
          <caption className="eng-comparison-caption">{config.title || 'Comparison'}</caption>
          <thead>
            <tr>
              <th>Property</th>
              <th className="eng-unit-header">Unit</th>
              {config.configurations.map((cfg) => (
                <th
                  key={cfg.id}
                  className={`eng-config-header ${cfg.id === referenceId ? 'eng-reference' : ''}`}
                  onClick={() => handleSort(cfg.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSort(cfg.id)}
                >
                  {cfg.label}
                  {cfg.id === referenceId && (
                    <span className="eng-reference-badge">reference</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => {
              const isAlt = rowIdx % 2 === 1;
              const highlightDiff = row.highlight && referenceIndex >= 0;
              return (
                <tr
                  key={row.id}
                  className={`eng-comparison-row ${isAlt ? 'eng-row-alt' : ''}`}
                >
                  <td className="eng-property-cell">{row.label}</td>
                  <td className="eng-unit-cell">{row.unit || '-'}</td>
                  {config.configurations.map((cfg, ci) => {
                    const isReference = cfg.id === referenceId;
                    const cell = formatCell(row.values[ci], row.unit);
                    const annotation = getAnnotation(row, ci);
                    return (
                      <td
                        key={cfg.id}
                        className={`eng-value-cell ${isReference ? 'eng-reference-cell' : ''} ${
                          highlightDiff ? 'eng-highlight' : ''
                        }`}
                      >
                        <span className="eng-value-main">{cell}</span>
                        {annotation && (
                          <span className="eng-percent-annotation"> {annotation}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {config.notes && config.notes.length > 0 && (
        <div className="eng-comparison-notes">
          <h3>Notes</h3>
          {config.notes.map((note) => (
            <div key={note.rowId} className="eng-note">
              <button
                type="button"
                className="eng-note-toggle"
                aria-expanded={expanded.has(note.rowId)}
                onClick={() => toggleNote(note.rowId)}
              >
                {expanded.has(note.rowId) ? '▾' : '▸'} {note.title}
              </button>
              {expanded.has(note.rowId) && <p className="eng-note-body">{note.body}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="eng-comparison-actions">
        <button type="button" onClick={handleExportCsv} aria-label="Export comparison as CSV">
          Export CSV
        </button>
      </div>
    </section>
  );

  function handleExportCsv() {
    const header = ['Property', 'Unit', ...config.configurations.map((c) => c.label)].join(',');
    const lines = [header];
    for (const row of config.rows) {
      lines.push(
        [
          `"${row.label}"`,
          `"${row.unit || ''}"`,
          ...row.values.map((v) => `"${String(v).replace(/"/g, '""')}"`),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(config.title || 'comparison').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
