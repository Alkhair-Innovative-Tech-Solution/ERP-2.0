'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { ticketService } from '../../services/api/ticketService';
import { fileService } from '../../services/api/fileService';
import chatSocket, { WebSocketMessage } from '../../services/socket/chatSocket';
import {
    Send,
    MessageSquare,
    Paperclip,
    X,
    Maximize2,
    Minimize2,
    ChevronDown,
    ChevronUp,
    Smile,
    Check,
    CheckCheck,
    Wifi,
    WifiOff,
    Loader2,
    FileIcon
} from 'lucide-react';
import { THEME } from '../../lib/theme';

interface ChatMessage {
    id: string;
    ticketId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    employeeCode?: string;
    content: string;
    timestamp: string;
    isOwn: boolean;
    status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface UnifiedChatPanelProps {
    ticketId: string;
    className?: string;
    /** 'sidebar' (default): floating button on mobile + sticky panel on desktop.
     *  'inline': renders chat directly in the parent container — no floating button. */
    mode?: 'sidebar' | 'inline';
}

const UnifiedChatPanel: React.FC<UnifiedChatPanelProps> = ({ ticketId, className = '', mode = 'sidebar' }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Load initial messages
    useEffect(() => {
        loadMessages();
    }, [ticketId]);

    // Setup WebSocket connection
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !ticketId) return;

        chatSocket.connect(ticketId, token, {
            onMessage: handleWebSocketMessage,
            onConnect: () => setIsConnected(true),
            onDisconnect: () => setIsConnected(false),
            onError: () => setIsConnected(false),
            onTyping: handleTypingIndicator
        });

        return () => {
            chatSocket.disconnect();
        };
    }, [ticketId]);

    // Auto-scroll to bottom on new messages ONLY (not on typing indicator)
    useEffect(() => {
        const messagesLength = messages.length;
        if (messagesLength > 0) {
            scrollToBottom();
        }
    }, [messages.length]); // Only trigger when message count changes

    // Handle escape key to close expanded view
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isExpanded]);

    const loadMessages = async () => {
        setIsLoading(true);
        try {
            const comments = await ticketService.getComments(ticketId);
            const mappedMessages: ChatMessage[] = comments.map(c => ({
                id: c.id,
                ticketId: c.ticketId,
                senderId: c.userId,
                senderName: c.userName,
                senderRole: c.userRole || 'user',
                employeeCode: c.employeeCode,
                content: c.content,
                timestamp: c.timestamp,
                isOwn: c.userId === user?.id,
                status: 'delivered' as const
            }));
            setMessages(mappedMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
        if (wsMessage.type === 'message' && wsMessage.data) {
            const newMsg: ChatMessage = {
                id: wsMessage.data.id || Date.now().toString(),
                ticketId: wsMessage.data.ticket_id || ticketId,
                senderId: wsMessage.data.sender_id || '',
                senderName: wsMessage.data.sender_name || 'Unknown',
                senderRole: wsMessage.data.sender_role || 'user',
                employeeCode: wsMessage.data.employee_code,
                content: wsMessage.data.message || '',
                timestamp: wsMessage.data.created_at || new Date().toISOString(),
                isOwn: wsMessage.data.sender_id === user?.id,
                status: 'delivered'
            };

            setMessages(prev => {
                // If this is from current user, check for optimistic message to replace
                if (newMsg.isOwn) {
                    const now = new Date(newMsg.timestamp).getTime();

                    // Find matching optimistic message (same content, sent within last 5 seconds)
                    const tempMsgIndex = prev.findIndex(m => {
                        if (!m.isOwn || m.status === 'delivered') return false;

                        const msgTime = new Date(m.timestamp).getTime();
                        const timeDiff = Math.abs(now - msgTime);

                        // Match if: same content AND within 5-second window
                        return m.content.trim() === newMsg.content.trim() && timeDiff < 5000;
                    });

                    if (tempMsgIndex !== -1) {
                        // Replace the temporary optimistic message with the real one
                        const updated = [...prev];
                        updated[tempMsgIndex] = newMsg;
                        return updated;
                    }
                }

                // Check for exact duplicate by ID (for messages from others)
                const exists = prev.some(m => m.id === newMsg.id);
                if (exists) return prev;

                return [...prev, newMsg];
            });

            // Increment unread if not own message and panel is collapsed on mobile
            if (!newMsg.isOwn && !isMobileOpen) {
                setUnreadCount(prev => prev + 1);
            }
        }
    }, [ticketId, user?.id, isMobileOpen]);

    const scrollToBottom = () => {
        // Check if the input is currently focused
        const activeElement = document.activeElement;
        const shouldRestoreFocus = activeElement === inputRef.current;

        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        // Restore focus to input if it was focused before scroll
        if (shouldRestoreFocus && inputRef.current) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    };

    // Handle incoming typing events
    const handleTypingIndicator = useCallback((userId: string) => {
        if (userId === user?.id) return; // Ignore own typing

        setTypingUsers(prev => {
            if (!prev.includes(userId)) return [...prev, userId];
            return prev;
        });

        // Clear typing status after 3 seconds
        setTimeout(() => {
            setTypingUsers(prev => prev.filter(id => id !== userId));
        }, 3000);
    }, [user?.id]);

    // Send typing event (Debounced)
    const sendTypingEvent = useCallback(() => {
        if (!chatSocket.isConnected()) return;

        // Simple throttle/debounce mechanism
        if (typingTimeoutRef.current) return; // Already sent recently

        chatSocket.sendTyping();

        // Prevent sending again for 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null;
        }, 2000);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNewMessage(e.target.value);
        sendTypingEvent();
    };

    const handleSendMessage = async () => {
        const trimmedMessage = newMessage.trim();
        if (!trimmedMessage || !user || isSending) return;

        setIsSending(true);

        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            id: tempId,
            ticketId,
            senderId: user.id,
            senderName: user.name || 'You',
            senderRole: user.role || 'user',
            employeeCode: user.employeeCode,
            content: trimmedMessage,
            timestamp: new Date().toISOString(),
            isOwn: true,
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');

        try {
            // Try WebSocket first
            if (chatSocket.isConnected()) {
                const sent = chatSocket.sendMessage(trimmedMessage);
                if (sent) {
                    // Mark as sent, WebSocket broadcast will replace it with real message
                    setMessages(prev =>
                        prev.map(m => m.id === tempId ? { ...m, status: 'sent' as const } : m)
                    );
                    setIsSending(false);
                    return;
                }
            }

            // Fallback to HTTP
            const comment = await ticketService.addComment(ticketId, trimmedMessage);

            // Replace temp message with real one
            setMessages(prev =>
                prev.map(m => m.id === tempId ? {
                    ...m,
                    id: comment.id,
                    status: 'delivered' as const
                } : m)
            );
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(trimmedMessage); // Restore message
        } finally {
            setIsSending(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Upload to file service
            const response = await fileService.uploadFile(file, 'chat_attachment', ticketId);

            // Append file URL to message input
            const fileLink = `\n[File: ${file.name}](${response.url})`;
            setNewMessage(prev => prev + fileLink);

            // Focus back on input
            inputRef.current?.focus();
        } catch (error) {
            console.error('File upload error:', error);
            alert('Failed to upload file');
        } finally {
            setIsUploading(false);
            // Clear input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDateSeparator = (timestamp: string) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    };

    const shouldShowDateSeparator = (currentMsg: ChatMessage, prevMsg?: ChatMessage) => {
        if (!prevMsg) return true;
        const currentDate = new Date(currentMsg.timestamp).toDateString();
        const prevDate = new Date(prevMsg.timestamp).toDateString();
        return currentDate !== prevDate;
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getAvatarColor = (name: string, role: string) => {
        const roleColors: Record<string, string> = {
            moderator: '#3B82F6',
            assignee: '#10B981',
            requestor: '#8B5CF6',
            admin: '#EF4444'
        };
        return roleColors[role] || THEME.colors.primary;
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'sending':
                return <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />;
            case 'sent':
                return <Check className="w-3 h-3 text-gray-400" />;
            case 'delivered':
                return <CheckCheck className="w-3 h-3 text-gray-400" />;
            case 'read':
                return <CheckCheck className="w-3 h-3 text-blue-500" />;
            default:
                return null;
        }
    };

    const renderMessageContent = (content: string) => {
        // Basic link parsing
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = content.split(urlRegex);

        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                // Check if it's a file link markdown [Name](url) - Simplified regex for now
                // Or just a raw URL
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline break-all">
                        {part}
                    </a>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    // Mobile toggle handler
    const handleMobileToggle = () => {
        setIsMobileOpen(!isMobileOpen);
        if (!isMobileOpen) {
            setUnreadCount(0);
        }
    };

    // Chat content - shared between desktop and mobile. 
    // Moving this logic to a helper function instead of a nested component 
    // to prevent remounting and focus loss issues.
    const renderChatContent = () => (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div
                className="flex-none flex items-center justify-between px-4 py-3 bg-white border-b"
                style={{ borderColor: THEME.colors.light + '80' }}
            >
                <div className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: THEME.colors.primary + '15' }}
                    >
                        <MessageSquare className="w-4 h-4" style={{ color: THEME.colors.primary }} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm" style={{ color: THEME.colors.primary }}>
                            Discussion
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: THEME.colors.gray }}>
                            <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: isConnected ? '#10b981' : '#9ca3af' }}
                            />
                            <span>{isConnected ? 'Connected' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center hover:bg-gray-100 transition-colors"
                        style={{ color: THEME.colors.gray }}
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleMobileToggle}
                        className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                        style={{ color: THEME.colors.gray }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ backgroundColor: '#f4f6f9' }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            <span className="text-sm">Loading messages...</span>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                        <p className="font-medium">No messages yet</p>
                        <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const prevMsg = index > 0 ? messages[index - 1] : undefined;
                        const showDate = shouldShowDateSeparator(msg, prevMsg);

                        return (
                            <React.Fragment key={msg.id}>
                                {/* Date Separator */}
                                {showDate && (
                                    <div className="flex justify-center my-4">
                                        <span className="px-3 py-1 bg-white/80 backdrop-blur rounded-full text-xs font-medium text-gray-600 shadow-sm">
                                            {formatDateSeparator(msg.timestamp)}
                                        </span>
                                    </div>
                                )}

                                {/* Message Bubble */}
                                <div className={`flex items-end gap-2 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                                    {/* Avatar - Left for others */}
                                    {!msg.isOwn && (
                                        <div
                                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-md"
                                            style={{ backgroundColor: getAvatarColor(msg.senderName, msg.senderRole) }}
                                            title={msg.senderName}
                                        >
                                            {getInitials(msg.senderName)}
                                        </div>
                                    )}

                                    <div className={`flex flex-col max-w-[75%] ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                                        {/* Sender name (for others' messages) */}
                                        {!msg.isOwn && (
                                            <div className="flex flex-col mb-1 px-1">
                                                <span
                                                    className="text-sm font-semibold"
                                                    style={{ color: getAvatarColor(msg.senderName, msg.senderRole) }}
                                                >
                                                    {msg.senderName}
                                                </span>
                                                {msg.employeeCode && (
                                                    <span className="text-[10px] text-gray-500">
                                                        {msg.employeeCode}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Message Bubble */}
                                        <div
                                            className={`relative px-3.5 py-2.5 rounded-2xl ${msg.isOwn
                                                ? 'rounded-br-sm text-white'
                                                : 'rounded-bl-sm bg-white text-gray-800'
                                                }`}
                                            style={{
                                                backgroundColor: msg.isOwn ? '#274C77' : '#ffffff',
                                                boxShadow: msg.isOwn
                                                    ? '0 2px 8px rgba(39,76,119,0.25)'
                                                    : '0 1px 4px rgba(0,0,0,0.08)'
                                            }}
                                        >
                                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                {renderMessageContent(msg.content)}
                                            </p>

                                            {/* Timestamp and Status */}
                                            <div className={`flex items-center gap-1 mt-1 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                                                <span className={`text-[10px] ${msg.isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </span>
                                                {msg.isOwn && getStatusIcon(msg.status)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
                <div ref={messagesEndRef} />

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div className="px-4 py-1 text-xs text-gray-400 italic">
                        {typingUsers.length === 1
                            ? 'Someone is typing...'
                            : `${typingUsers.length} people are typing...`}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div
                className="flex-none border-t bg-white px-3 py-3"
                style={{ borderColor: '#e5e9ef' }}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />
                <div
                    className="flex items-end gap-2 rounded-2xl border px-3 py-2 transition-shadow focus-within:shadow-md"
                    style={{ borderColor: '#d1d9e6', backgroundColor: '#fafbfc' }}
                >
                    {/* Attachment */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSending}
                        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-gray-100"
                        style={{ color: '#6096BA' }}
                        title="Attach file"
                    >
                        {isUploading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Paperclip className="w-4 h-4" />
                        }
                    </button>

                    {/* Textarea */}
                    <textarea
                        ref={inputRef}
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message... (Enter to send)"
                        className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-gray-800 placeholder-gray-400 max-h-24 min-h-[22px]"
                        rows={1}
                        disabled={isSending || !user}
                        style={{ lineHeight: '1.5' }}
                    />

                    {/* Send Button */}
                    <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSending || !user || isUploading}
                        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
                        style={{
                            backgroundColor: newMessage.trim() && !isSending ? '#274C77' : '#e5e7eb',
                            color: newMessage.trim() && !isSending ? '#ffffff' : '#9ca3af',
                        }}
                    >
                        {isSending
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <Send className="w-4 h-4" />
                        }
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-1.5">
                    Shift+Enter for new line
                </p>
            </div>
        </div>
    );

    // Inline mode: renders directly in parent — used for mobile tab view
    if (mode === 'inline') {
        return (
            <div className="flex flex-col h-full bg-white overflow-hidden">
                {renderChatContent()}
            </div>
        );
    }

    // Sidebar mode (default): sticky desktop panel + floating button on mobile
    return (
        <>
            {/* Desktop: Side Panel */}
            <div
                className={`hidden lg:flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${isExpanded
                        ? 'fixed top-16 left-4 right-4 bottom-4 z-[100] rounded-lg'
                        : `sticky top-24 h-[calc(100vh-7rem)] rounded-xl ${className}`
                    }`}
            >
                {renderChatContent()}
            </div>

            {/* Desktop Expanded Overlay */}
            {isExpanded && (
                <div
                    className="hidden lg:block fixed inset-0 bg-black/40 backdrop-blur-sm z-[99]"
                    onClick={() => setIsExpanded(false)}
                    aria-label="Close expanded chat"
                />
            )}

            {/* Mobile: Floating Button */}
            <button
                onClick={handleMobileToggle}
                className={`lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${isMobileOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
                    }`}
                style={{
                    background: `linear-gradient(135deg, ${THEME.colors.primary} 0%, #1e40af 100%)`
                }}
            >
                <MessageSquare className="w-6 h-6 text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Mobile: Slide-up Panel */}
            <div
                className={`lg:hidden fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${isMobileOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{
                    height: isExpanded ? '100vh' : '75vh',
                    borderTopLeftRadius: isExpanded ? 0 : '1.5rem',
                    borderTopRightRadius: isExpanded ? 0 : '1.5rem',
                    overflow: 'hidden',
                    boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.15)'
                }}
            >
                {!isExpanded && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full" />
                )}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute top-3 left-4 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                {renderChatContent()}
            </div>

            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
                    onClick={handleMobileToggle}
                />
            )}
        </>
    );
};

export default UnifiedChatPanel;
export { UnifiedChatPanel };
