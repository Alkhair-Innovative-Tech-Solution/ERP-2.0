/**
 * useSocket Hook
 * WebSocket connection and event management
 */

import { useEffect, useRef, useCallback } from 'react';
import { socketClient } from '../services/socket/socketClient';
import { SOCKET_EVENTS, SocketEvent } from '../config/socketEvents';
import { useAuthStore } from '../store/authStore';
import { initializeEventHandlers, cleanupEventHandlers } from '../services/eventHandlers';

type EventCallback = (data: any) => void;

export const useSocket = (url?: string) => {
  const { token, isAuthenticated } = useAuthStore();
  const callbacksRef = useRef<Map<string, EventCallback[]>>(new Map());

  // Connect socket
  const connect = useCallback((socketUrl: string, socketToken?: string) => {
    if (!socketUrl) return;
    
    const authToken = socketToken || token;
    if (!authToken) {
      console.warn('No token available for socket connection');
      return;
    }

    socketClient.connect(socketUrl, authToken);
    initializeEventHandlers();
  }, [token]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    socketClient.disconnect();
    cleanupEventHandlers();
  }, []);

  // Subscribe to event
  const subscribe = useCallback((event: SocketEvent | string, callback: EventCallback) => {
    socketClient.on(event, callback);
    
    // Track callback for cleanup
    if (!callbacksRef.current.has(event)) {
      callbacksRef.current.set(event, []);
    }
    callbacksRef.current.get(event)?.push(callback);
  }, []);

  // Unsubscribe from event
  const unsubscribe = useCallback((event: SocketEvent | string, callback: EventCallback) => {
    socketClient.off(event, callback);
    
    const callbacks = callbacksRef.current.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }, []);

  // Send message
  const send = useCallback((type: string, data: any) => {
    socketClient.send(type, data);
  }, []);

  // Auto-connect if URL provided
  useEffect(() => {
    if (url && isAuthenticated && token) {
      connect(url, token);
    }

    return () => {
      // Cleanup on unmount
      callbacksRef.current.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          socketClient.off(event, callback);
        });
      });
      callbacksRef.current.clear();
    };
  }, [url, isAuthenticated, token, connect]);

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
    isConnected: socketClient.isConnected(),
    state: socketClient.getState(),
  };
};

