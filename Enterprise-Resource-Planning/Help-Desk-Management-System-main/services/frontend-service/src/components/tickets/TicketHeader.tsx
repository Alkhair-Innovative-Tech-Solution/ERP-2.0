'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { THEME } from '../../lib/theme';
import { Ticket } from '../../types';
import { formatRelativeTime } from '../../lib/helpers';

interface TicketHeaderProps {
  ticket: Ticket;
  /** Extra actions slot — role-specific buttons (e.g. Assign, Edit) */
  actions?: React.ReactNode;
}

/**
 * Shared fixed header for all ticket detail views.
 * Used by requestor, moderator, and assignee ticket pages.
 */
export const TicketHeader: React.FC<TicketHeaderProps> = ({ ticket, actions }) => {
  const router = useRouter();

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
      {/* Top row — back + ID + badges + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => router.back()}
            className="flex-shrink-0 mt-0.5"
          >
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="min-w-0">
            {/* Ticket ID */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="text-sm font-bold font-mono"
                style={{ color: THEME.colors.primary }}
              >
                {ticket.ticketId}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Subject */}
            <h1
              className="text-base md:text-lg font-semibold text-gray-900 truncate"
              title={ticket.subject}
            >
              {ticket.subject}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(ticket.submittedDate)}
              </span>
              {ticket.department && (
                <span className="hidden sm:inline">{ticket.department}</span>
              )}
            </div>
          </div>
        </div>

        {/* Role-specific actions slot */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketHeader;
