/**
 * WebSocket Event Handlers
 * Centralized event handling for real-time updates
 */

import { socketClient } from './socket/socketClient';
import { SOCKET_EVENTS, NotificationPayload, TicketUpdatePayload, ChatMessagePayload } from '../config/socketEvents';
import { useNotificationStore } from '../store/notificationStore';
import { useTicketStore } from '../store/ticketStore';

/**
 * Initialize event handlers
 */
export const initializeEventHandlers = (): void => {
  // Notification handlers
  socketClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, (data: NotificationPayload) => {
    const { addNotification, updateUnreadCount } = useNotificationStore.getState();
    
    const notification = {
      id: data.id,
      userId: '', // Will be set by backend
      type: data.type as any,
      title: data.title,
      message: data.message,
      ticketId: data.ticketId,
      timestamp: data.timestamp,
      read: false,
    };
    
    addNotification(notification);
    
    // Update unread count
    const { unreadCount } = useNotificationStore.getState();
    updateUnreadCount(unreadCount + 1);
    
    // Show browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/favicon.ico',
        });
      }
    }
  });

  // Ticket update handlers
  socketClient.on(SOCKET_EVENTS.TICKET_UPDATED, (data: TicketUpdatePayload) => {
    const { updateTicket } = useTicketStore.getState();
    updateTicket(data.ticketId, data.changes);
  });

  socketClient.on(SOCKET_EVENTS.TICKET_ASSIGNED, (data: TicketUpdatePayload) => {
    const { updateTicket } = useTicketStore.getState();
    updateTicket(data.ticketId, {
      status: 'assigned',
      ...data.changes,
    });
  });

  socketClient.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, (data: TicketUpdatePayload) => {
    const { updateTicket } = useTicketStore.getState();
    updateTicket(data.ticketId, {
      status: data.changes.status,
    });
  });

  socketClient.on(SOCKET_EVENTS.TICKET_PRIORITY_CHANGED, (data: TicketUpdatePayload) => {
    const { updateTicket } = useTicketStore.getState();
    updateTicket(data.ticketId, {
      priority: data.changes.priority,
    });
  });

  socketClient.on(SOCKET_EVENTS.TICKET_COMMENT_ADDED, (data: any) => {
    const { updateTicket } = useTicketStore.getState();
    const { activeTicket } = useTicketStore.getState();
    
    if (activeTicket?.id === data.ticketId) {
      // Add comment to active ticket
      const comments = activeTicket.comments || [];
      updateTicket(data.ticketId, {
        comments: [...comments, data.comment],
      });
    }
  });

  // Connection handlers
  socketClient.on(SOCKET_EVENTS.CONNECT, () => {
    console.log('Socket connected successfully');
  });

  socketClient.on(SOCKET_EVENTS.DISCONNECT, () => {
    console.log('Socket disconnected');
  });

  socketClient.on(SOCKET_EVENTS.ERROR, (data: any) => {
    console.error('Socket error:', data);
  });
};

/**
 * Request browser notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Cleanup event handlers
 */
export const cleanupEventHandlers = (): void => {
  // Remove all listeners
  Object.values(SOCKET_EVENTS).forEach(event => {
    socketClient.off(event, () => {});
  });
};

