/**
 * WebSocket Client for Django Channels
 * Handles real-time communication for chat, notifications, and ticket updates
 */

import { ENV } from '../../config/env';
import { SOCKET_EVENTS, SocketEvent } from '../../config/socketEvents';

type EventCallback = (data: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting = false;
  private connectionUrl: string | null = null;
  private token: string | null = null;

  /**
   * Connect to WebSocket
   */
  connect(url: string, token: string): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.connectionUrl = url;
    this.token = token;
    this.isConnecting = true;

    try {
      const wsUrl = url.startsWith('ws') ? url : `${ENV.WS_URL}${url}`;
      this.ws = new WebSocket(wsUrl, [token]);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit(SOCKET_EVENTS.CONNECT, {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        // Silently handle WebSocket errors - don't break the UI
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
          console.warn('WebSocket connection error (non-blocking):', error);
        }
        this.emit(SOCKET_EVENTS.ERROR, { error });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.emit(SOCKET_EVENTS.DISCONNECT, {});
        
        if (this.connectionUrl && this.token) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      if (this.connectionUrl && this.token) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(this.connectionUrl, this.token);
      }
    }, delay);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any): void {
    const { type, ...payload } = data;
    
    if (type) {
      this.emit(type, payload);
    } else {
      // Handle Django Channels format
      if (data.type) {
        this.emit(data.type, data.data || data);
      }
    }
  }

  /**
   * Send message through WebSocket
   */
  send(type: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  /**
   * Subscribe to event
   */
  on(event: SocketEvent | string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unsubscribe from event
   */
  off(event: SocketEvent | string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: SocketEvent | string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionUrl = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.listeners.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    if (this.isConnecting) return 'connecting';
    
    const states = ['connecting', 'open', 'closing', 'closed'];
    return states[this.ws.readyState] as any;
  }
}

export const socketClient = new SocketClient();
export default socketClient;
