// src/components/tickets/presets/types.ts
import type { LucideIcon } from 'lucide-react';
import type { Ticket } from '@/types';
import type { SelectOption } from '@/components/ui/Select';

export type ColumnKey =
  | 'ticketId'
  | 'subject'
  | 'status'
  | 'priority'
  | 'department'
  | 'assignee'
  | 'requestor'
  | 'submittedDate'
  | 'progressPercent'
  | 'completionPreview'
  | 'actions';

export type FilterKey = 'search' | 'status' | 'priority' | 'department' | 'dateRange';

export interface FilterValues {
  search: string;
  status: string;
  priority: string;
  department: string;
  dateRange: string;
}

export const DEFAULT_FILTERS: FilterValues = {
  search: '',
  status: 'all',
  priority: 'all',
  department: 'all',
  dateRange: 'all',
};

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'danger' | 'outline';
  onRun: (ticketIds: string[]) => Promise<void>;
}

export interface TicketListResult {
  results: Ticket[];
  count: number;
}

export interface FetchParams {
  page: number;
  pageSize: number;
  filters: FilterValues;
  baseFilters: Record<string, string>;
}

export interface TicketListPreset {
  scope: 'my-requests' | 'my-tasks' | 'ticket-pool' | 'review-queue';
  title: string;
  subtitle?: string;

  queryKey: readonly unknown[];
  fetchFn: (params: FetchParams) => Promise<TicketListResult>;
  baseFilters?: Record<string, string>;

  columns: ColumnKey[];
  priorityAccent?: boolean;
  enableBulkActions?: boolean;
  bulkActions?: BulkAction[];

  availableFilters: FilterKey[];
  statusOptions?: SelectOption[];

  emptyState: {
    title: string;
    message: string;
    cta?: { label: string; href: string };
  };
  primaryAction?: { label: string; href: string; icon?: LucideIcon };

  rowHref: (t: Ticket) => string;
}
