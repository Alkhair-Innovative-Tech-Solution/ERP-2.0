'use client';

import React from 'react';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { Button } from '../ui/Button';
import { Eye } from 'lucide-react';
import { Ticket } from '../../types';
import { formatRelativeTime, truncateText } from '../../lib/helpers';

interface TicketCardProps {
  ticket: Ticket;
  onView: (ticketId: string) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onView }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onView(ticket.id)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline truncate block w-full text-left"
            >
              {ticket.ticketId}
            </button>
            <h3 
              className="text-base sm:text-lg font-semibold mt-1 text-gray-900 line-clamp-2"
              title={ticket.subject}
            >
              {ticket.subject}
            </h3>
          </div>
        </div>

        {/* Description */}
        {ticket.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {truncateText(ticket.description, 100)}
          </p>
        )}

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 pt-2 border-t border-gray-100">
          <span className="font-medium">{ticket.department}</span>
          <span className="text-gray-400">•</span>
          <span>{formatRelativeTime(ticket.submittedDate)}</span>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onView(ticket.id)}
            leftIcon={<Eye className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};
