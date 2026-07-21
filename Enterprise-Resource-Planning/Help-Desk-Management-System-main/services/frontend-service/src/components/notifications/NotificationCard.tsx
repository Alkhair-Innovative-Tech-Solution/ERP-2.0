'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/Button';
import {
  Check,
  X,
  Bell,
  Ticket,
  UserPlus,
  RefreshCw,
  MessageSquare,
  AtSign,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Eye
} from 'lucide-react';
import { Notification } from '../../types';
import { THEME } from '../../lib/theme';
import { formatRelativeTime, truncateText } from '../../lib/helpers';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';

interface NotificationCardProps {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onRead,
  onDelete,
}) => {
  const router = useRouter();
  const { user } = useAuth();

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.read) {
      onRead();
    }
    if (notification.ticketId) {
      const role = user?.role || 'requestor';
      router.push(`/${role}/ticket/${notification.ticketId}`);
    } else if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRead();
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'ticket_created':
        return Ticket;
      case 'ticket_assigned':
        return UserPlus;
      case 'status_changed':
        return RefreshCw;
      case 'new_message':
      case 'ticket_comment':
      case 'new_comment':
        return MessageSquare;
      case 'mention':
        return AtSign;
      case 'approval_request':
        return CheckCircle;
      case 'ticket_completed':
      case 'ticket_resolved':
        return CheckCircle;
      case 'reopen_request':
        return RefreshCw;
      case 'postponement':
        return Clock;
      case 'sla_reminder':
        return AlertCircle;
      case 'ticket_rejected':
        return X;
      case 'ticket_approved':
        return CheckCircle;
      case 'success':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertCircle;
      default:
        return Bell;
    }
  };

  const getNotificationColor = () => {
    switch (notification.type) {
      case 'ticket_created':
      case 'ticket_assigned':
        return '#3b82f6'; // blue
      case 'status_changed':
        return '#8b5cf6'; // purple
      case 'new_message':
      case 'mention':
      case 'ticket_comment':
        return '#f59e0b'; // amber
      case 'approval_request':
        return '#10b981'; // green
      case 'ticket_completed':
      case 'ticket_resolved':
      case 'ticket_approved':
      case 'success':
        return '#10b981'; // green
      case 'reopen_request':
        return '#f59e0b'; // amber
      case 'postponement':
        return '#6366f1'; // indigo
      case 'sla_reminder':
        return '#ef4444'; // red
      case 'ticket_rejected':
      case 'error':
        return '#ef4444'; // red
      case 'warning':
        return '#f59e0b'; // amber
      default:
        return THEME.colors.primary;
    }
  };

  const Icon = getNotificationIcon();
  const color = getNotificationColor();

  return (
    <Card
      className={`transition-all hover:shadow-md cursor-pointer ${!notification.read
          ? 'border-l-4 bg-blue-50'
          : 'bg-white opacity-90'
        }`}
      style={{
        borderLeftColor: !notification.read ? color : 'transparent',
      }}
      onClick={handleView}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: color + '20',
            }}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4
                className={`text-sm sm:text-base font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'
                  }`}
              >
                {notification.title}
              </h4>
              {!notification.read && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
              {truncateText(notification.message, 150)}
            </p>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500">
                {formatRelativeTime(notification.timestamp)}
              </p>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAsRead}
                    className="text-xs px-2 py-1 h-auto"
                    title="Mark as read"
                  >
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">Mark Read</span>
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleView}
                  className="text-xs px-2 py-1 h-auto"
                  leftIcon={<Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                >
                  <span className="hidden sm:inline">View</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-xs px-2 py-1 h-auto"
                  title="Delete"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: THEME.colors.error }} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

