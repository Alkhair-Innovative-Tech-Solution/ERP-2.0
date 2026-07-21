import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortableData<T extends Record<string, any>>(
  data: T[],
  initialConfig: SortConfig | null = null
) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialConfig);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        comparison = aVal === bVal ? 0 : aVal ? -1 : 1;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return { sortedData, sortConfig, requestSort };
}
