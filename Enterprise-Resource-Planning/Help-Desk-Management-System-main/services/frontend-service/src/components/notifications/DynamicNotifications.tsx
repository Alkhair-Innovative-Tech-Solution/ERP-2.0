'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useNotifications } from '../../hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Search, AlertCircle, Info, CheckCircle, AlertTriangle, X, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { THEME } from '../../lib/theme';
import DataTable, { Column } from '../ui/DataTable';
import ConfirmModal from '../modals/ConfirmModal';

const DynamicNotifications: React.FC = () => {
  const { user } = useAuth();
  const { notifications, fetchNotifications } = useNotifications(true);
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [confirm, setConfirm] = useState<{ open: boolean; action?: 'markAll' }>({ open: false });
  const [processing, setProcessing] = useState(false);

  const items = (tab === 'unread' ? notifications.filter(n => !n.read) : notifications)
    .filter(n => !searchTerm || n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.message.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(n => filterType === 'all' ? true : n.type === filterType);

  const markAsRead = (notificationId: string) => {
    try {
      const raw = localStorage.getItem('helpdesk_notifications');
      if (!raw) return fetchNotifications();
      const all = JSON.parse(raw);
      const idx = all.findIndex((n: any) => n.id === notificationId);
      if (idx !== -1) all[idx].read = true;
      localStorage.setItem('helpdesk_notifications', JSON.stringify(all));
    } finally {
      fetchNotifications();
    }
  };

  const markAllAsRead = () => {
    setConfirm({ open: true, action: 'markAll' });
  };

  const deleteNotification = (notificationId: string) => {
    try {
      const raw = localStorage.getItem('helpdesk_notifications');
      if (!raw) return fetchNotifications();
      const all = JSON.parse(raw);
      const remaining = all.filter((n: any) => n.id !== notificationId);
      localStorage.setItem('helpdesk_notifications', JSON.stringify(remaining));
    } finally {
      fetchNotifications();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
      case 'ticket_completed':
        return <CheckCircle className="w-5 h-5" style={{ color: THEME.colors.primary }} />;
      case 'warning':
      case 'urgent':
        return <AlertTriangle className="w-5 h-5" style={{ color: THEME.colors.medium }} />;
      case 'info':
      case 'ticket_assigned':
      case 'new_comment':
        return <Info className="w-5 h-5" style={{ color: THEME.colors.light }} />;
      case 'ticket_rejected':
        return <AlertCircle className="w-5 h-5" style={{ color: THEME.colors.gray }} />;
      default:
        return <Bell className="w-5 h-5" style={{ color: THEME.colors.gray }} />;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'success':
      case 'ticket_completed':
        return { backgroundColor: THEME.colors.background, borderColor: THEME.colors.primary };
      case 'warning':
      case 'urgent':
        return { backgroundColor: THEME.colors.background, borderColor: THEME.colors.medium };
      case 'info':
      case 'ticket_assigned':
      case 'new_comment':
        return { backgroundColor: THEME.colors.background, borderColor: THEME.colors.light };
      case 'ticket_rejected':
        return { backgroundColor: THEME.colors.background, borderColor: THEME.colors.gray };
      default:
        return { backgroundColor: THEME.colors.background, borderColor: THEME.colors.gray };
    }
  };

  const getRoleSpecificTitle = (role: string) => {
    switch (role) {
      case 'requestor':
        return 'Your Request Notifications';
      case 'moderator':
        return 'Moderation Notifications';
      case 'assignee':
        return 'Task Assignment Notifications';
      case 'admin':
        return 'System Notifications';
      default:
        return 'Notifications';
    }
  };

  const getRoleSpecificDescription = (role: string) => {
    switch (role) {
      case 'requestor':
        return 'Stay updated on your request status, approvals, and completions';
      case 'moderator':
        return 'Monitor new requests, assignments, and system alerts';
      case 'assignee':
        return 'Track your assigned tasks and work updates';
      case 'admin':
        return 'System-wide notifications and administrative alerts';
      default:
        return 'Your notification center';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;
  const completedCount = notifications.filter(n => n.type === 'success' || n.type === 'ticket_completed').length;
  const gotoRelated = (n: any) => {
    if (!n.ticketId) return;
    const role = user?.role;
    if (role === 'admin') router.push(`/admin/requests`);
    else router.push(`/${role}/ticket/${n.ticketId}?from=notifications`);
  };

  const columns: Column<any>[] = [
    {
      key: 'title', header: 'Title', sortable: true, accessor: (r) => (
        <button onClick={() => gotoRelated(r)} className={`font-medium text-left ${!r.read ? 'text-gray-900' : 'text-gray-700'} hover:underline`}>{r.title}</button>
      )
    },
    {
      key: 'message', header: 'Message', accessor: (r) => (
        <div className="truncate max-w-[480px] text-gray-700">{r.message}</div>
      )
    },
    {
      key: 'type', header: 'Type', sortable: true, accessor: (r) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium border ${r.type === 'success' || r.type === 'ticket_completed'
              ? 'bg-green-50 text-green-700 border-green-200'
              : r.type === 'warning' || r.type === 'urgent'
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                : r.type === 'ticket_rejected'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
        >
          {r.type.replace('ticket_', '')}
        </span>
      )
    },
    { key: 'timestamp', header: 'Time', sortable: true, accessor: (r) => new Date(r.timestamp).toLocaleString() },
    {
      key: 'actions', header: 'Actions', accessor: (r) => (
        <div className="flex items-center gap-2">
          {!r.read && (
            <button onClick={() => markAsRead(r.id)} className="px-2 py-1 border rounded text-gray-700">Mark read</button>
          )}
          {r.ticketId ? (
            <button onClick={() => gotoRelated(r)} className="px-2 py-1 border rounded text-blue-700">Open</button>
          ) : null}
          <button onClick={() => deleteNotification(r.id)} className="px-2 py-1 border rounded text-gray-700">Delete</button>
        </div>
      )
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: THEME.colors.primary }}>
            <Bell className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: THEME.colors.primary }}>
            {getRoleSpecificTitle(user.role)}
          </h1>
          <p className="text-sm" style={{ color: THEME.colors.gray }}>{getRoleSpecificDescription(user.role)}</p>
          {unreadCount > 0 && (
            <div className="mt-3">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow" style={{ backgroundColor: THEME.colors.medium }}>
                <AlertCircle className="w-4 h-4 mr-2" />
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Compact Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg border bg-white text-center">
            <div className="text-xs text-gray-500">TOTAL</div>
            <div className="text-2xl font-bold" style={{ color: THEME.colors.primary }}>{notifications.length}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white text-center">
            <div className="text-xs text-gray-500">UNREAD</div>
            <div className="text-2xl font-bold text-yellow-600">{unreadCount}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white text-center">
            <div className="text-xs text-gray-500">READ</div>
            <div className="text-2xl font-bold text-green-600">{readCount}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white text-center">
            <div className="text-xs text-gray-500">COMPLETED</div>
            <div className="text-2xl font-bold text-green-700">{completedCount}</div>
          </div>
        </div>

        {/* Tabs + Filters and Search */}
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Notifications</h3>
              <div className="flex gap-2">
                <button onClick={() => setTab('all')} className={`px-3 py-1 rounded border text-sm ${tab === 'all' ? 'bg-white text-gray-900' : 'text-gray-700'}`}>All</button>
                <button onClick={() => setTab('unread')} className={`px-3 py-1 rounded border text-sm ${tab === 'unread' ? 'bg-white text-gray-900' : 'text-gray-700'}`}>Unread</button>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 border rounded-lg transition-all duration-200 text-sm"
                    style={{ borderColor: THEME.colors.gray }}
                    onFocus={(e) => e.target.style.borderColor = THEME.colors.primary}
                    onBlur={(e) => e.target.style.borderColor = THEME.colors.gray}
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2.5 border rounded-lg transition-all duration-200 text-sm bg-white"
                  style={{ borderColor: THEME.colors.gray }}
                  onFocus={(e) => e.target.style.borderColor = THEME.colors.primary}
                  onBlur={(e) => e.target.style.borderColor = THEME.colors.gray}
                >
                  <option value="all">All Types</option>
                  <option value="success">Success</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="ticket_assigned">Assigned</option>
                  <option value="ticket_completed">Completed</option>
                  <option value="ticket_rejected">Rejected</option>
                </select>
              </div>

              {/* Mark All as Read */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="inline-flex items-center px-4 py-2 text-white text-sm font-semibold rounded-md transition-all duration-200 shadow"
                  style={{ backgroundColor: THEME.colors.primary }}
                >
                  <CheckCheck className="w-5 h-5 mr-2" />
                  Mark All Read
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Notifications Table */}
        <Card className="bg-white shadow border border-gray-100">
          <CardContent className="p-4">
            <DataTable data={items} columns={columns} initialSort={{ key: 'timestamp', dir: 'desc' }} pageSize={8} showSearch={false} />
          </CardContent>
        </Card>

        <ConfirmModal
          isOpen={confirm.open}
          title={'Mark all notifications as read?'}
          description={'This will mark all unseen notifications as read.'}
          loading={processing}
          onClose={() => setConfirm({ open: false })}
          onConfirm={async () => {
            try {
              setProcessing(true);
              const raw = localStorage.getItem('helpdesk_notifications');
              if (raw) {
                const all = JSON.parse(raw).map((n: any) => ({ ...n, read: true }));
                localStorage.setItem('helpdesk_notifications', JSON.stringify(all));
              }
            } finally {
              setProcessing(false);
              setConfirm({ open: false });
              fetchNotifications();
            }
          }}
        />
      </div>
    </div>
  );
};

export default DynamicNotifications;
