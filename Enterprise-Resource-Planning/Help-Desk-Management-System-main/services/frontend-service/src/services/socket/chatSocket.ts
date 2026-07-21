/**
 * WebSocket Client for Real-time Chat
 * Connects to communication-service WebSocket endpoint
 */

import { ENV } from '../../config/env';

export interface WebSocketMessage {
    type: 'message' | 'typing' | 'read' | 'presence' | 'error';
    data: {
        id?: string;
        ticket_id?: string;
        sender_id?: string;
        sender_name?: string;
        sender_role?: string;
        employee_code?: string;
        message?: string;
        mentions?: string[];
        created_at?: string;
        error?: string;
    };
}

export interface ChatSocketOptions {
    onMessage: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    onTyping?: (userId: string) => void;
}

class ChatSocketClient {
    private socket: WebSocket | null = null;
    private ticketId: string | null = null;
    private token: string | null = null;
    private options: ChatSocketOptions | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private isConnecting = false;

    /**
     * Connect to WebSocket for a specific ticket
     */
    connect(ticketId: string, token: string, options: ChatSocketOptions): void {
        if (this.isConnecting) return;

        this.ticketId = ticketId;
        this.token = token;
        this.options = options;
        this.isConnecting = true;

        this.createConnection();
    }

    private createConnection(): void {
        if (!this.ticketId || !this.token) {
            console.error('Cannot create WebSocket: missing ticketId or token');
            return;
        }

        // IMPORTANT: URL encode the token to handle special characters
        const encodedToken = encodeURIComponent(this.token);

        // Use ENV.WS_URL (respects NEXT_PUBLIC_WS_URL env var for dev vs prod)
        const wsBase = ENV.WS_URL.replace(/\/+$/, '');
        const wsUrl = `${wsBase}/chat/${this.ticketId}/?token=${encodedToken}`;

        console.log('🔌 Connecting to WebSocket for ticket:', this.ticketId);

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = this.handleOpen.bind(this);
            this.socket.onmessage = this.handleMessage.bind(this);
            this.socket.onclose = this.handleClose.bind(this);
            this.socket.onerror = this.handleError.bind(this);
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    private handleOpen(): void {
        console.log('🔌 WebSocket connected to ticket:', this.ticketId);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.options?.onConnect?.();

        // Start ping interval to keep connection alive
        this.startPing();
    }

    private handleMessage(event: MessageEvent): void {
        try {
            const data = JSON.parse(event.data) as WebSocketMessage;

            if (data.type === 'typing' && data.data.sender_id) {
                this.options?.onTyping?.(data.data.sender_id);
                return;
            }

            this.options?.onMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    private handleClose(event: CloseEvent): void {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPing();
        this.options?.onDisconnect?.();

        // Attempt reconnection if not intentionally closed
        if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
        }
    }

    private handleError(error: Event): void {
        // Suppress empty WebSocket errors that don't affect functionality
        if (error && Object.keys(error).length > 0) {
            console.warn('⚠️ WebSocket error:', {
                type: error.type,
                target: (error.target as WebSocket)?.url,
                readyState: (error.target as WebSocket)?.readyState
            });
        }
        this.isConnecting = false;
        this.options?.onError?.(error);
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('Max reconnection attempts reached');
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.createConnection();
        }, delay);
    }

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Ping every 30 seconds
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Send a chat message
     */
    sendMessage(message: string, mentions: string[] = []): boolean {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected');
            return false;
        }

        try {
            this.socket.send(JSON.stringify({
                type: 'message',
                message,
                mentions
            }));
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    /**
     * Send typing indicator
     */
    sendTyping(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        try {
            this.socket.send(JSON.stringify({ type: 'typing' }));
        } catch (error) {
            console.warn('Error sending typing indicator:', error);
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect(): void {
        this.stopPing();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }

        this.ticketId = null;
        this.token = null;
        this.options = null;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
    }
}

// Singleton instance
export const chatSocket = new ChatSocketClient();

export default chatSocket;
