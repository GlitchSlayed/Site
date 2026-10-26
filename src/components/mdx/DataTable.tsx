import React, { useState, useMemo } from 'react';
import { formatNumber } from '../../lib/engineering/format';

export interface DataTableColumn {
  key: string;
  label: string;
  unit?: string;
  align?: 'left' | 'center' | 'right';
  format?: (val: any) => string;
  sortable?: boolean;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: Array<Record<string, any>>;
  title?: string;
  description?: string;
  pageSize?: number;
  searchable?: boolean;
  downloadable?: boolean;
  className?: string;
}

type SortOrder = 'asc' | 'desc' | null;

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  title,
  description,
  pageSize = 10,
  searchable = true,
  downloadable = true,
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activePageSize, setActivePageSize] = useState<number | 'all'>(pageSize);

  // Filter rows based on search text
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const query = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [data, columns, search]);

  // Sort filtered rows
  const sortedData = useMemo(() => {
    if (!sortKey || !sortOrder) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortKey, sortOrder]);

  // Handle column header click for sorting
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortKey(null);
        setSortOrder(null);
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalRows = sortedData.length;
  const isAll = activePageSize === 'all';
  const rowsPerPage = isAll ? totalRows : activePageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / (rowsPerPage || 1)));
  const pageIndex = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    if (isAll) return sortedData;
    const start = (pageIndex - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, isAll, pageIndex, rowsPerPage]);

  // Export CSV download
  const handleExportCSV = () => {
    const headers = columns.map((col) => `"${(col.label + (col.unit ? ` [${col.unit}]` : '')).replace(/"/g, '""')}"`);
    const rows = sortedData.map((row) =>
      columns
        .map((col) => {
          const val = row[col.key];
          if (val === undefined || val === null) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title ? title.toLowerCase().replace(/\s+/g, '_') : 'data'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`eng-data-table-wrapper ${className}`}>
      {(title || description || searchable || downloadable) && (
        <div className="eng-table-toolbar">
          <div className="eng-table-info">
            {title && <h4 className="eng-table-title">{title}</h4>}
            {description && <p className="eng-table-desc">{description}</p>}
          </div>

          <div className="eng-table-actions">
            {searchable && (
              <div className="eng-table-search">
                <input
                  type="text"
                  placeholder="Search data..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  onInput={(e) => {
                    setSearch((e.target as HTMLInputElement).value);
                    setCurrentPage(1);
                  }}
                  className="eng-table-search-input"
                  aria-label="Search table data"
                />
              </div>
            )}
            {downloadable && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="eng-table-export-btn"
                title="Export data as CSV"
              >
                CSV ⤓
              </button>
            )}
          </div>
        </div>
      )}

      <div className="eng-table-responsive">
        <table className="eng-data-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const isSortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && handleSort(col.key)}
                    className={`${isSortable ? 'sortable' : ''} align-${col.align || 'left'} ${isSorted ? `sorted-${sortOrder}` : ''}`}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    <span className="th-content">
                      <span>{col.label}</span>
                      {col.unit && <span className="th-unit"> [{col.unit}]</span>}
                      {isSortable && (
                        <span className="th-sort-icon">
                          {isSorted ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="eng-table-empty">
                  No matching data found
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col) => {
                    const rawVal = row[col.key];
                    let displayVal = '—';
                    if (col.format) {
                      displayVal = col.format(rawVal);
                    } else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
                      displayVal = formatNumber(rawVal, { sigFigs: 4, thousands: true });
                    } else if (rawVal !== undefined && rawVal !== null) {
                      displayVal = String(rawVal);
                    }
                    return (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align || 'left' }}
                        className={`align-${col.align || 'left'}`}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="eng-table-pagination">
        <div className="eng-pagination-summary">
          {totalRows > 0 ? (
            <span>
              Showing {isAll ? 1 : (pageIndex - 1) * rowsPerPage + 1} to{' '}
              {isAll ? totalRows : Math.min(pageIndex * rowsPerPage, totalRows)} of {totalRows} entries
            </span>
          ) : (
            <span>0 entries</span>
          )}
        </div>

        <div className="eng-pagination-controls">
          <label className="eng-pagination-size-select">
            <span>Rows:</span>
            <select
              value={activePageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                setActivePageSize(val);
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </label>

          {!isAll && totalPages > 1 && (
            <div className="eng-pagination-buttons">
              <button
                type="button"
                disabled={pageIndex <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="eng-page-btn"
                aria-label="Previous Page"
              >
                ‹
              </button>
              <span className="eng-page-indicator">
                {pageIndex} / {totalPages}
              </span>
              <button
                type="button"
                disabled={pageIndex >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="eng-page-btn"
                aria-label="Next Page"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataTable;
