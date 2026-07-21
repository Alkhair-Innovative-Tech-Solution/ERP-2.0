// src/hooks/useUrlFilters.ts
'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  DEFAULT_FILTERS,
  FilterKey,
  FilterValues,
} from '@/components/tickets/presets/types';

export function useUrlFilters(availableFilters: FilterKey[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<FilterValues>(() => {
    const next = { ...DEFAULT_FILTERS };
    availableFilters.forEach(key => {
      const value = searchParams.get(key);
      if (value) next[key] = value;
    });
    return next;
  }, [availableFilters, searchParams]);

  const writeToUrl = useCallback(
    (next: FilterValues) => {
      const params = new URLSearchParams();
      availableFilters.forEach(key => {
        const value = next[key];
        if (value && value !== 'all') params.set(key, value);
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [availableFilters, pathname, router]
  );

  const setFilters = useCallback(
    (next: FilterValues) => writeToUrl(next),
    [writeToUrl]
  );

  const clearFilters = useCallback(() => writeToUrl(DEFAULT_FILTERS), [writeToUrl]);

  return { filters, setFilters, clearFilters };
}
