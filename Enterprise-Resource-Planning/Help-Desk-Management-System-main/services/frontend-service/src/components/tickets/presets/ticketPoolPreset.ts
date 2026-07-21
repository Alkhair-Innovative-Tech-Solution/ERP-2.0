// src/components/tickets/presets/ticketPoolPreset.ts
import { XCircle, Clock } from 'lucide-react';
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function ticketPoolPreset(role: string): TicketListPreset {
  const runBulk = async (
    ticketIds: string[],
    verb: string,
    fn: (id: string) => Promise<unknown>,
  ) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`${verb} ${ticketIds.length} ticket(s)?`)
      : false;
    if (!confirmed) return;
    for (const id of ticketIds) {
      try { await fn(id); } catch (e) { console.error(`Bulk ${verb} failed on ${id}`, e); }
    }
    // Trigger refetch via query invalidation upstream — for simplicity, hard reload.
    if (typeof window !== 'undefined') window.location.reload();
  };

  return {
    scope: 'ticket-pool',
    title: 'Ticket Pool',
    subtitle: 'Unassigned tickets awaiting moderator action',

    queryKey: ['tickets', 'ticket-pool'],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { status: 'submitted' },

    columns: ['ticketId', 'subject', 'priority', 'department', 'requestor', 'submittedDate', 'actions'],

    availableFilters: ['search', 'priority', 'department', 'dateRange'],

    enableBulkActions: true,
    bulkActions: [
      {
        id: 'reject',
        label: 'Reject',
        icon: XCircle,
        variant: 'danger',
        onRun: (ids) => runBulk(ids, 'Reject', (id) => ticketService.rejectTicket(id, 'Bulk rejection')),
      },
      {
        id: 'postpone',
        label: 'Postpone',
        icon: Clock,
        variant: 'outline',
        onRun: (ids) => runBulk(ids, 'Postpone', (id) => ticketService.postponeTicket(id, 'Bulk postponement')),
      },
    ],

    emptyState: {
      title: 'Ticket pool is empty',
      message: 'No tickets currently need moderator action.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
