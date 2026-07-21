import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketListView } from './TicketListView';
import type { TicketListPreset } from './presets/types';

const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/requestor/requests',
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const basePreset = (overrides: Partial<TicketListPreset> = {}): TicketListPreset => ({
  scope: 'my-requests',
  title: 'My Requests',
  queryKey: ['tickets', 'my-requests'],
  fetchFn: vi.fn().mockResolvedValue({ results: [], count: 0 }),
  columns: ['ticketId', 'subject', 'status', 'priority', 'submittedDate', 'actions'],
  availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],
  emptyState: { title: 'No tickets', message: 'Nothing here yet.' },
  rowHref: (t) => `/requestor/ticket/${t.id}`,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('TicketListView', () => {
  it('shows the title and subtitle', async () => {
    render(<TicketListView preset={basePreset({ subtitle: 'All yours' })} />, { wrapper });
    expect(await screen.findByText('My Requests')).toBeInTheDocument();
    expect(screen.getByText('All yours')).toBeInTheDocument();
  });

  it('shows empty state when results array is empty', async () => {
    render(<TicketListView preset={basePreset()} />, { wrapper });
    expect(await screen.findByText('No tickets')).toBeInTheDocument();
  });

  it('shows error state and retry when fetchFn rejects', async () => {
    const preset = basePreset({
      fetchFn: vi.fn().mockRejectedValue(new Error('boom')),
    });
    render(<TicketListView preset={preset} />, { wrapper });
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls fetchFn with base filters merged in', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ results: [], count: 0 });
    render(
      <TicketListView preset={basePreset({ fetchFn, baseFilters: { requestorId: 'u-1' } })} />,
      { wrapper }
    );
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const callArg = fetchFn.mock.calls[0][0];
    expect(callArg.baseFilters).toEqual({ requestorId: 'u-1' });
    expect(callArg.page).toBe(1);
  });
});
