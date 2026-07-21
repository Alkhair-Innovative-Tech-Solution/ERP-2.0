// src/hooks/useUrlFilters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUrlFilters } from './useUrlFilters';
import { DEFAULT_FILTERS } from '@/components/tickets/presets/types';

const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/requestor/requests',
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
});

describe('useUrlFilters', () => {
  it('returns default filters when URL has no params', () => {
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    expect(result.current.filters).toEqual(DEFAULT_FILTERS);
  });

  it('reads filters from URL params on mount', () => {
    mockSearchParams = new URLSearchParams('status=in_progress&priority=high');
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    expect(result.current.filters.status).toBe('in_progress');
    expect(result.current.filters.priority).toBe('high');
    expect(result.current.filters.search).toBe('');
  });

  it('writes filters to URL on change (omitting "all" and empty)', () => {
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    act(() => {
      result.current.setFilters({ ...DEFAULT_FILTERS, status: 'resolved', search: 'printer' });
    });
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringMatching(/\/requestor\/requests\?.*status=resolved.*search=printer|\/requestor\/requests\?.*search=printer.*status=resolved/),
      { scroll: false }
    );
  });

  it('clearFilters resets to defaults and clears URL', () => {
    mockSearchParams = new URLSearchParams('status=in_progress');
    const { result } = renderHook(() => useUrlFilters(['search', 'status', 'priority', 'department', 'dateRange']));
    act(() => { result.current.clearFilters(); });
    expect(mockReplace).toHaveBeenCalledWith('/requestor/requests', { scroll: false });
  });

  it('ignores filter keys not in availableFilters', () => {
    mockSearchParams = new URLSearchParams('status=in_progress&priority=high');
    const { result } = renderHook(() => useUrlFilters(['search', 'status']));
    expect(result.current.filters.status).toBe('in_progress');
    expect(result.current.filters.priority).toBe('all'); // default, not read
  });
});
