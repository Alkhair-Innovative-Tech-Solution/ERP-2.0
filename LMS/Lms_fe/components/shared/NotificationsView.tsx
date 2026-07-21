'use client';

import { useState, useEffect } from 'react';
import {
    Bell,
    Search,
    Clock,
    Megaphone,
    Shield,
    Inbox,
} from 'lucide-react';
import { notificationAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/**
 * Unified "My Notifications" viewer used across all non-admin portals
 * (teacher, student, coordinator, account officer). Admins manage/broadcast
 * notifications from their dedicated /admin/notifications page instead.
 */
export default function NotificationsView() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const data: any = await notificationAPI.listMy();
            setNotifications(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRead = async (id: string, isRead: boolean) => {
        try {
            await notificationAPI.markRead(id, !isRead);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: !isRead } : n));
            if (!isRead) toast.success('Status updated');
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const filteredNotifications = notifications.filter(n =>
        n.broadcast?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.broadcast?.message?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-12 pb-12 animate-in fade-in duration-1000">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Bell className="w-7 h-7 text-brand-teal" />
                    Notifications
                </h1>
                <p className="text-sm text-slate-400 font-bold mt-1">Stay updated with important announcements and system alerts.</p>
            </div>

            {/* Search & Filter */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 overflow-hidden relative group">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-teal transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                <div className="flex-1 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-brand-teal transition-colors w-5 h-5 focus-within:text-brand-teal" />
                    <input
                        type="text"
                        placeholder="SEARCH NOTIFICATIONS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal focus:bg-white outline-none transition-all placeholder:text-slate-200"
                    />
                </div>
            </div>

            <div className="space-y-6">
                {filteredNotifications.length === 0 ? (
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 flex flex-col items-center justify-center py-40 text-center px-10">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-10 shadow-inner group">
                            <Inbox className="w-12 h-12 text-slate-200 group-hover:text-brand-teal transition-colors duration-700" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">No Notifications</h3>
                        <p className="text-slate-400 mt-4 text-lg font-black uppercase tracking-[0.2em] text-[11px] leading-relaxed max-w-sm mx-auto">
                            You have no new notifications at this time.
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((delivery) => {
                        const n = delivery.broadcast;
                        return (
                            <div
                                key={delivery.id}
                                className={cn(
                                    "bg-white rounded-[2.5rem] border transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/80 group overflow-hidden relative",
                                    !delivery.is_read ? "border-brand-teal/20 shadow-xl shadow-brand-teal/5" : "border-slate-100 shadow-lg shadow-slate-200/40"
                                )}
                            >
                                {!delivery.is_read && (
                                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-brand-teal animate-pulse" />
                                )}

                                <div className="p-10 flex flex-col md:flex-row items-start gap-10">
                                    <div className={cn(
                                        "w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-xl transition-all duration-700 group-hover:rotate-6",
                                        n.type === 'ANNOUNCEMENT' ? "bg-brand-orange text-white shadow-brand-orange/20" :
                                        n.type === 'SYSTEM' ? "bg-brand-dark text-white shadow-brand-dark/20" :
                                        "bg-brand-teal text-white shadow-brand-teal/20"
                                    )}>
                                        {n.type === 'ANNOUNCEMENT' ? <Megaphone className="w-8 h-8" /> :
                                            n.type === 'SYSTEM' ? <Shield className="w-8 h-8" /> :
                                                <Bell className="w-8 h-8" />}
                                    </div>

                                    <div className="flex-1 space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                                                        !delivery.is_read ? "bg-brand-teal text-white border-brand-teal/20" : "bg-slate-100 text-slate-400 border-slate-200"
                                                    )}>
                                                        NEW
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <h3 className={cn(
                                                    "text-2xl font-black tracking-tighter uppercase transition-colors duration-500",
                                                    delivery.is_read ? "text-slate-400" : "text-slate-900 group-hover:text-brand-teal"
                                                )}>
                                                    {n.title}
                                                </h3>
                                            </div>
                                        </div>

                                        <p className={cn(
                                            "text-lg font-medium leading-relaxed max-w-4xl",
                                            delivery.is_read ? "text-slate-300" : "text-slate-500"
                                        )}>
                                            {n.message}
                                        </p>

                                        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                            <button
                                                onClick={() => handleMarkRead(delivery.id, delivery.is_read)}
                                                className={cn(
                                                    "text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:tracking-[0.4em]",
                                                    delivery.is_read ? "text-slate-300 hover:text-brand-teal" : "text-brand-teal hover:text-teal-600"
                                                )}
                                            >
                                                {delivery.is_read ? 'MARK AS UNREAD' : 'MARK AS READ'}
                                            </button>

                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-200 opacity-0 group-hover:opacity-100 transition-all duration-700">
                                                <Bell className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
