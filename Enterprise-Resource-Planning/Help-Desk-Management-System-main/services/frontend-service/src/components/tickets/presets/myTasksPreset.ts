// src/components/tickets/presets/myTasksPreset.ts
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function myTasksPreset(userId: string, role: string): TicketListPreset {
  return {
    scope: 'my-tasks',
    title: 'My Tasks',
    subtitle: 'Tickets assigned to you',

    queryKey: ['tickets', 'my-tasks', userId],
    fetchFn: async ({ page, pageSize, filters, baseFilters }) => {
      const apiFilters: Record<string, unknown> = { page, pageSize, ...baseFilters };
      if (filters.status !== 'all') apiFilters.status = filters.status;
      if (filters.priority !== 'all') apiFilters.priority = filters.priority;
      if (filters.department !== 'all') apiFilters.department = filters.department;
      if (filters.search) apiFilters.search = filters.search;
      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange);
        if (!Number.isNaN(days)) {
          const d = new Date();
          d.setDate(d.getDate() - days);
          apiFilters.createdAfter = d.toISOString();
        }
      }
      const response = await ticketService.getTickets(apiFilters as any);
      const results = Array.isArray(response) ? response : (response?.results ?? []);
      const count = Array.isArray(response) ? response.length : (response?.count ?? results.length);
      return { results, count };
    },
    baseFilters: { assigneeId: userId },

    columns: ['ticketId', 'subject', 'status', 'priority', 'progressPercent', 'submittedDate', 'actions'],
    priorityAccent: true,

    availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],

    emptyState: {
      title: 'No assigned tasks',
      message: 'You have nothing assigned to you right now.',
    },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
