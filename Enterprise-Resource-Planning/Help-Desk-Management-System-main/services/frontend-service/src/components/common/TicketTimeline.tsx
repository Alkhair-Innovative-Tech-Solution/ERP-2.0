import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import {
  CheckCircle,
  UserPlus,
  MessageSquare,
  XCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { THEME } from '../../lib/theme';
import { Ticket } from '../../types';
import { formatRelativeTime, formatDate } from '../../lib/helpers';
import ticketService, { AuditLogEntry } from '../../services/api/ticketService';

interface TicketTimelineProps {
  ticket: Ticket;
}

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ ticket }) => {
  const [timelineEvents, setTimelineEvents] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!ticket.id) return;
      try {
        const history = await ticketService.getHistory(ticket.id);
        setTimelineEvents(history);
      } catch (error) {
        console.error('Failed to load timeline:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [ticket.id]);

  const getEventIcon = (action: string, changes: any = {}) => {
    if (action === 'create') return CheckCircle;
    if (changes.status) {
      const status = changes.status.new;
      if (status === 'resolved' || status === 'completed') return CheckCircle;
      if (status === 'rejected') return XCircle;
      if (status === 'assigned') return UserPlus;
      return RefreshCw;
    }
    if (changes.assignee_id) return UserPlus;
    return Clock;
  };

  const getEventColor = (action: string, changes: any = {}) => {
    if (action === 'create') return '#10b981';
    if (changes.status) {
      const status = changes.status.new;
      if (status === 'resolved' || status === 'completed') return '#10b981';
      if (status === 'rejected') return '#ef4444';
      if (status === 'assigned') return '#3b82f6';
      return '#8b5cf6';
    }
    if (changes.assignee_id) return '#3b82f6';
    return '#6b7280';
  };

  const getEventDescription = (item: AuditLogEntry) => {
    if (item.reason) return item.reason;
    if (item.changes.status) {
      return `Status changed from ${item.changes.status.old} to ${item.changes.status.new}`;
    }
    if (item.changes.assignee_id) {
      return 'Assignee updated';
    }
    return 'Ticket updated';
  };

  // Combine creation event (which might not be in audit log if legacy) with fetched logs
  const combinedEvents = [
    // Creation event (derived from ticket data as fallback or explicit first item)
    {
      id: 'create',
      action_type: 'create',
      category: 'ticket',
      model_name: 'Ticket',
      object_id: ticket.id,
      performed_by_id: ticket.requestorId,
      old_state: {},
      new_state: {},
      changes: {},
      reason: `Ticket created by ${ticket.requestorName}`,
      timestamp: ticket.submittedDate
    },
    ...timelineEvents
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>
          Timeline
        </h3>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Timeline Items */}
          <div className="space-y-4">
            {combinedEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No timeline events</p>
            ) : (
              combinedEvents.map((item, index) => {
                const Icon = getEventIcon(item.action_type, item.changes);
                const color = getEventColor(item.action_type, item.changes);
                // Deduplicate creation if audit log also returns it (though usually safe to show)
                // logic here assumes audit log might not have 'create' or it's different.

                return (
                  <div key={item.id + index} className="relative flex items-start gap-4">
                    {/* Timeline Dot */}
                    <div
                      className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color + '20' }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {item.action_type === 'create' ? 'Ticket Created' : (item.changes.status ? 'Status Updated' : 'Updated')}
                          </p>
                          <p className="text-sm text-gray-700 mb-2">
                            {getEventDescription(item as AuditLogEntry)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {/* We don't have user name resolution in AuditLog yet often, might need enhancement */}
                            <span>{formatRelativeTime(item.timestamp)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(item.timestamp, 'short')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
