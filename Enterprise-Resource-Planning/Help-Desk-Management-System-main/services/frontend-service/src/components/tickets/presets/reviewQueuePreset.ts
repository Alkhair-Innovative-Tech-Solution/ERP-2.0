// src/components/tickets/presets/reviewQueuePreset.ts
import ticketService from '@/services/api/ticketService';
import type { SelectOption } from '@/components/ui/Select';
import type { TicketListPreset } from './types';

const REVIEW_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
];

export function reviewQueuePreset(role: string): TicketListPreset {
  return {
    scope: 'review-queue',
    title: 'Review Queue',
    subtitle: 'Completed tickets awaiting final review',

    queryKey: ['tickets', 'review-queue'],
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
    baseFilters: { status: 'completed' },

    columns: ['ticketId', 'subject', 'assignee', 'completionPreview', 'submittedDate', 'actions'],

    availableFilters: ['search', 'status', 'priority', 'department'],
    statusOptions: REVIEW_STATUS_OPTIONS,

    emptyState: {
      title: 'Nothing to review',
      message: 'No completed tickets are currently waiting for review.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
