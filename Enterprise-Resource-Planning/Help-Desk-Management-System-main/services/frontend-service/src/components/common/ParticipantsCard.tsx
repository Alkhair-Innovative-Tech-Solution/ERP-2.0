'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { THEME } from '../../lib/theme';
import { Ticket } from '../../types';
import { formatRelativeTime, getInitials, getAvatarColor } from '../../lib/helpers';
import { Users, User } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: string;
  joinDate: string;
  avatar?: string;
}

interface ParticipantsCardProps {
  ticket: Ticket;
}

export const ParticipantsCard: React.FC<ParticipantsCardProps> = ({ ticket }) => {
  const participants: Participant[] = [
    {
      id: ticket.requestorId,
      name: ticket.requestorName,
      role: 'requestor',
      joinDate: ticket.submittedDate,
    },
    ...(ticket.moderatorId && ticket.moderatorName
      ? [{
        id: ticket.moderatorId,
        name: ticket.moderatorName,
        role: 'Moderator',
        joinDate: ticket.assignedDate || ticket.submittedDate,
      }]
      : []),
    ...(ticket.assigneeId && ticket.assigneeName
      ? [{
        id: ticket.assigneeId,
        name: ticket.assigneeName,
        role: 'Assignee',
        joinDate: ticket.assignedDate || ticket.submittedDate,
      }]
      : []),
  ];

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'requestor':
        return THEME.colors.primary;
      case 'moderator':
        return '#8b5cf6';
      case 'assignee':
        return THEME.colors.success;
      default:
        return THEME.colors.gray;
    }
  };

  return (
    <Card className="rounded-2xl border-0" style={{ boxShadow: '0 2px 12px rgba(39,76,119,0.07)' }}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-3.5 h-3.5" style={{ color: THEME.colors.primary }} />
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: THEME.colors.medium }}>
            Participants
          </p>
        </div>
        {participants.length === 0 ? (
          <p className="text-sm text-gray-500">No participants yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                style={{
                  backgroundColor: `${getRoleColor(participant.role)}08`,
                  borderColor: `${getRoleColor(participant.role)}30`,
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: getAvatarColor(participant.name) }}
                >
                  {participant.avatar ? (
                    <img src={participant.avatar} alt={participant.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(participant.name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-none mb-0.5 truncate" style={{ color: THEME.colors.primary }}>
                    {participant.name}
                  </p>
                  <p className="text-[10px] leading-none capitalize" style={{ color: getRoleColor(participant.role) }}>
                    {participant.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
