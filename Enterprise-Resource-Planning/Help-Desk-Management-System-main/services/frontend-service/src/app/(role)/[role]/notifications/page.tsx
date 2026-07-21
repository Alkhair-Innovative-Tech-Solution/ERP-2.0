'use client';

import React, { useState, useMemo } from 'react';
import { useNotifications } from '../../../../hooks/useNotifications';
import { Card, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { NotificationCard } from '../../../../components/notifications/NotificationCard';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { CheckCheck, Bell } from 'lucide-react';
import { THEME } from '../../../../lib/theme';
import { Notification } from '../../../../types';
import { PageContainer } from '../../../../components/layout/PageContainer';

type FilterType = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications(true);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    if (activeFilter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (activeFilter === 'read') {
      filtered = filtered.filter(n => n.read);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return filtered;
  }, [notifications, activeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / pageSize);
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  // Counts
  const unreadCount_filtered = filteredNotifications.filter(n => !n.read).length;
  const readCount_filtered = filteredNotifications.filter(n => n.read).length;

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    if (activeFilter === 'unread') {
      setActiveFilter('all');
    }
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <PageContainer className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#274c77' }}>
              Notifications
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {unreadCount > 0 
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up! No new notifications'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<CheckCheck className="w-5 h-5" />}
              onClick={handleMarkAllAsRead}
              className="w-full sm:w-auto"
            >
              Mark All as Read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => handleFilterChange('unread')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                  activeFilter === 'unread'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Unread ({unreadCount})
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleFilterChange('read')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === 'read'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Read ({readCount_filtered})
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Notification List */}
        {paginatedNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 sm:p-12">
              <EmptyState
                title={
                  activeFilter === 'unread' 
                    ? 'No Unread Notifications'
                    : activeFilter === 'read'
                    ? 'No Read Notifications'
                    : 'No Notifications'
                }
                description={
                  activeFilter === 'unread'
                    ? "You're all caught up! No unread notifications."
                    : activeFilter === 'read'
                    ? "You haven't read any notifications yet."
                    : "You don't have any notifications yet."
                }
                icon={<Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {paginatedNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRead={() => markAsRead(notification.id)}
                onDelete={() => deleteNotification(notification.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredNotifications.length > pageSize && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredNotifications.length)} of {filteredNotifications.length} notifications
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    ««
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ‹ Prev
                  </Button>
                  <span className="text-sm text-gray-700 px-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next ›
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                  >
                    »»
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </PageContainer>
  );
}

