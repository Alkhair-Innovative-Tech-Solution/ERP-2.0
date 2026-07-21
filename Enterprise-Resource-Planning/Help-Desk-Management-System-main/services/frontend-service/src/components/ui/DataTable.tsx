'use client';
import React, { useMemo, useState } from 'react';
import DebouncedInput from './DebouncedInput';
import EmptyState from './EmptyState';

type Accessor<T> = (row: T) => React.ReactNode;

export interface Column<T> {
  key: string;
  header: string;
  accessor: Accessor<T>;
  sortable?: boolean;
  width?: string;
}
function DataTable<T>({
  data, columns, initialSort, pageSize = 10, showSearch = true, onRowClick
}: {
  data: T[];
  columns: Column<T>[];
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  showSearch?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    return data.filter((row: any) =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(query.toLowerCase()))
    );
  }, [data, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return filtered;
    return [...filtered].sort((a: any, b: any) => {
      const va = String(a[sort.key] ?? '');
      const vb = String(b[sort.key] ?? '');
      return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {showSearch ? <DebouncedInput value={query} onChange={setQuery} /> : <div />}
        <div className="text-sm text-gray-600">Total: {sorted.length}</div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full bg-white text-sm text-gray-900">
          <thead>
            <tr className="bg-gray-50">
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="text-left px-4 py-3 font-medium text-gray-700 cursor-pointer select-none"
                  onClick={() => {
                    if (!col.sortable) return;
                    setPage(1);
                    setSort(prev => {
                      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
                      return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
                    });
                  }}
                >
                  {col.header}{col.sortable && sort?.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.length === 0 ? (
              <tr><td className="px-4 py-6" colSpan={columns.length}>
                <EmptyState title="No results" description="Try changing your search or filters." />
              </td></tr>
            ) : current.map((row, i) => (
              <tr
                key={i}
                className={`border-t hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-gray-900">{col.accessor(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1 border rounded bg-white text-gray-700 disabled:opacity-40">«</button>
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded bg-white text-gray-700 disabled:opacity-40">Prev</button>
        <span className="text-sm text-gray-700">Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 border rounded bg-white text-gray-700 disabled:opacity-40">Next</button>
        <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="px-2 py-1 border rounded bg-white text-gray-700 disabled:opacity-40">»</button>
      </div>
    </div>
  );
}

export default DataTable;
export { DataTable };