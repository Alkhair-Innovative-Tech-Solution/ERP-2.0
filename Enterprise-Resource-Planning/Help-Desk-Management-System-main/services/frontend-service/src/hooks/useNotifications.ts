import { useEffect, useCallback } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/api/notificationService';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS, NotificationPayload } from '../config/socketEvents';
import { Notification } from '../types';

export const useNotifications = (autoFetch: boolean = true) => {
  const {
    notifications,
    unreadCount,
    setNotifications,
    addNotification,
    markAsRead: storeMarkAsRead,
    markAllAsRead: storeMarkAllAsRead,
    removeNotification,
    updateUnreadCount,
  } = useNotificationStore();

  const user = useAuthStore((s) => s.user);
  const { subscribe, unsubscribe } = useSocket();

  const fetchNotifications = useCallback(async (filters?: { read?: boolean }) => {
    if (!user?.id) return;
    try {
      const response = await notificationService.getNotifications(user.id, filters);
      setNotifications(response.results || []);
      updateUnreadCount(response.unreadCount || 0);
    } catch (error: any) {
      const isNetworkError = error?.isNetworkError || !error?.response;
      if (isNetworkError) {
        console.warn('API not available, using empty notifications list');
        setNotifications([]);
        updateUnreadCount(0);
      } else {
        console.error('Error fetching notifications:', error?.message || error);
      }
    }
  }, [user?.id, setNotifications, updateUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      storeMarkAsRead(id);
    } catch (error: any) {
      const isNetworkError = error?.isNetworkError || !error?.response;
      if (isNetworkError) {
        storeMarkAsRead(id);
      } else {
        console.error('Error marking notification as read:', error?.message || error);
      }
    }
  }, [storeMarkAsRead]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await notificationService.markAllAsRead(user.id);
      storeMarkAllAsRead();
    } catch (error: any) {
      const isNetworkError = error?.isNetworkError || !error?.response;
      if (isNetworkError) {
        storeMarkAllAsRead();
      } else {
        console.error('Error marking all as read:', error?.message || error);
      }
    }
  }, [user?.id, storeMarkAllAsRead]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      removeNotification(id);
    } catch (error: any) {
      const isNetworkError = error?.isNetworkError || !error?.response;
      if (isNetworkError) {
        removeNotification(id);
      } else {
        console.error('Error deleting notification:', error?.message || error);
      }
    }
  }, [removeNotification]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const count = await notificationService.getUnreadCount(user.id);
      updateUnreadCount(count || 0);
    } catch (error: any) {
      const isNetworkError = error?.isNetworkError || !error?.response;
      if (isNetworkError) {
        const localUnread = notifications.filter(n => !n.read).length;
        updateUnreadCount(localUnread);
      } else {
        console.error('Error refreshing unread count:', error?.message || error);
      }
    }
  }, [user?.id, updateUnreadCount, notifications]);

  useEffect(() => {
    const handleNewNotification = (data: NotificationPayload) => {
      const notification: Notification = {
        id: data.id,
        userId: '',
        type: data.type as any,
        title: data.title,
        message: data.message,
        ticketId: data.ticketId,
        timestamp: data.timestamp,
        read: false,
      };
      addNotification(notification);
      refreshUnreadCount();
    };

    subscribe(SOCKET_EVENTS.NOTIFICATION_NEW, handleNewNotification);
    return () => unsubscribe(SOCKET_EVENTS.NOTIFICATION_NEW, handleNewNotification);
  }, [subscribe, unsubscribe, addNotification, refreshUnreadCount]);

  useEffect(() => {
    if (autoFetch && user?.id) {
      fetchNotifications();
      refreshUnreadCount();
    }
  }, [autoFetch, user?.id, fetchNotifications, refreshUnreadCount]);

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshUnreadCount,
  };
};
