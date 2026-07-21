// src/components/tickets/presets/myRequestsPreset.ts
import { Plus } from 'lucide-react';
import ticketService from '@/services/api/ticketService';
import type { TicketListPreset } from './types';

export function myRequestsPreset(userId: string, role: string): TicketListPreset {
  return {
    scope: 'my-requests',
    title: 'My Requests',
    subtitle: 'View and manage all your submitted tickets',

    queryKey: ['tickets', 'my-requests', userId],
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
    baseFilters: { requestorId: userId },

    columns: ['ticketId', 'subject', 'status', 'priority', 'department', 'submittedDate', 'actions'],
    priorityAccent: true,

    availableFilters: ['search', 'status', 'priority', 'department', 'dateRange'],

    emptyState: {
      title: 'No requests yet',
      message: 'Try adjusting your filters or create your first request.',
      cta: { label: 'New Request', href: `/${role}/new-request` },
    },
    primaryAction: { label: 'New Request', href: `/${role}/new-request`, icon: Plus },

    rowHref: (t) => `/${role}/ticket/${t.id}`,
  };
}
