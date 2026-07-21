import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { User } from 'lucide-react';
import { THEME } from '../../lib/theme';
import { Ticket } from '../../types';

interface requestorDetailsCardProps {
  ticket: Ticket;
}

export const requestorDetailsCard: React.FC<requestorDetailsCardProps> = ({ ticket }) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: THEME.colors.primary }}>
          <User className="w-5 h-5" />
          requestor Details
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-600">Name:</span>
            <span className="ml-2 text-gray-900">{ticket.requestorName}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">Department:</span>
            <span className="ml-2 text-gray-900">{ticket.department}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">Priority:</span>
            <span className="ml-2 text-gray-900 capitalize">{ticket.priority}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">Submitted:</span>
            <span className="ml-2 text-gray-900">
              {new Date(ticket.submittedDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

