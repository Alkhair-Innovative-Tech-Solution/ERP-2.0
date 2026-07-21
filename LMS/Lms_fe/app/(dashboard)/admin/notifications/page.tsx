'use client';

import { useState, useEffect } from 'react';
import {
    Bell,
    Plus,
    Search,
    Filter,
    Calendar,
    ChevronDown,
    MoreHorizontal,
    CheckCircle2,
    Clock,
    FileText,
    Megaphone,
    Shield,
    Users,
    Trash2,
    Edit,
    Copy,
    Eye,
    AlertCircle,
    X,
    Loader2,
    Send,
    ShieldAlert,
    ShieldCheck,
    SearchIcon,
    ArrowRight,
    Activity,
    LucideIcon
} from 'lucide-react';
import { notificationAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

// Types
interface Notification {
    id: number;
    title: string;
    message: string;
    created_at: string;
    status: 'SENT' | 'SCHEDULED' | 'DRAFT';
    type: 'ANNOUNCEMENT' | 'ASSIGNMENT' | 'SYSTEM' | 'COURSE';
    audience: string;
    priority?: 'HIGH' | 'NORMAL';
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'ANNOUNCEMENT',
        audience_type: 'ALL',
        target_role: 'ALL'
    });

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const data: any = await notificationAPI.listBroadcasts(orgId);
            const list = Array.isArray(data) ? data : (data?.results || []);

            // Enrich data for UI
            const enriched: Notification[] = list.map((n: any, i: number) => ({
                id: n.id,
                title: n.title || 'Platform Update',
                message: n.message || 'Details not provided.',
                created_at: n.created_at || new Date().toISOString(),
                status: n.status || 'SENT',
                type: (n.type || (i % 3 === 0 ? 'ANNOUNCEMENT' : i % 3 === 1 ? 'ASSIGNMENT' : 'SYSTEM')) as any,
                audience: n.audience || 'All Users',
                priority: n.is_priority ? 'HIGH' : 'NORMAL'
            }));

            setNotifications(enriched);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const payload = {
                ...formData,
                audience_type: formData.target_role === 'ALL' ? 'ALL' : 'ROLE',
                target_role: formData.target_role === 'ALL' ? 'ALL' : formData.target_role
            };
            await notificationAPI.createBroadcast(payload);
            toast.success('Notification broadcasted successfully!');
            setIsSendModalOpen(false);
            fetchNotifications();
            setFormData({ title: '', message: '', type: 'ANNOUNCEMENT', audience_type: 'ALL', target_role: 'ALL' });
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to send notification');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || n.type === typeFilter;
        const matchesStatus = statusFilter === 'ALL' || n.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    const { sortedData, sortConfig, requestSort } = useSortableData(filteredNotifications);

    if (loading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Global Comms...</p>
          </div>
        );
    }

    const stats = [
        { label: 'Total Sent', value: notifications.filter(n => n.status === 'SENT').length, icon: CheckCircle2, color: 'blue' },
        { label: 'Scheduled Tasks', value: notifications.filter(n => (n.status as string) === 'SCHEDULED' || (n.status as string) === 'PENDING').length, icon: Calendar, color: 'orange' },
        { label: 'Alert Protocols', value: notifications.filter(n => n.type === 'SYSTEM').length, icon: ShieldAlert, color: 'indigo' },
        { label: 'Today Broadcasts', value: notifications.filter(n => new Date(n.created_at).toDateString() === new Date().toDateString()).length, icon: Megaphone, color: 'teal' },
    ];

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Broadcast Control</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Bell className="w-7 h-7 text-brand-teal" />
                        Notifications
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage global institutional announcements and system-wide signals.</p>
                </div>
                <Button
                    onClick={() => setIsSendModalOpen(true)}
                    className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group border-none"
                >
                    <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    Dispatch Signal
                </Button>
            </div>

            {/* ── Intelligence Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
                {stats.map((stat, i) => (
                    <div key={i} className="premium-card p-8 flex flex-col group border-none shadow-premium bg-white">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm",
                            stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                            stat.color === 'orange' ? "bg-orange-50 text-orange-600" :
                            stat.color === 'indigo' ? "bg-brand-teal/10 text-brand-teal" :
                            "bg-brand-teal/10 text-brand-teal"
                        )}>
                            <stat.icon size={22} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Control Console ── */}
            <div className="space-y-6 px-6">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[32px] shadow-premium">
                    <div className="relative flex-1 group w-full">
                        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                        <input
                            type="text"
                            placeholder="Search notification signatures or body content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/30 transition-all uppercase tracking-tight"
                        />
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full md:w-[180px] appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3.5 pr-12 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/30 font-black text-[10px] uppercase tracking-widest text-slate-600 cursor-pointer transition-all"
                            >
                                <option value="ALL">All Categories</option>
                                <option value="ANNOUNCEMENT">Announcements</option>
                                <option value="ASSIGNMENT">Assignments</option>
                                <option value="SYSTEM">System Alerts</option>
                                <option value="COURSE">Course Comms</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
                        </div>

                        <div className="relative flex-1 md:flex-none">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full md:w-[180px] appearance-none bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3.5 pr-12 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/30 font-black text-[10px] uppercase tracking-widest text-slate-600 cursor-pointer transition-all"
                            >
                                <option value="ALL">All States</option>
                                <option value="SENT">Executed</option>
                                <option value="SCHEDULED">Buffer Pool</option>
                                <option value="DRAFT">Internal Draft</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
                        </div>
                    </div>
                </div>

                {/* ── Notification Matrix ── */}
                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <SortableTableHeader label="Signal Signature" sortKey="title" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Classification" sortKey="type" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Target Node" sortKey="audience" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Timestamp" sortKey="created_at" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Execution State" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {filteredNotifications.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-200">
                                                <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                                   <Bell size={48} strokeWidth={1} />
                                                </div>
                                                <div>
                                                   <p className="text-xl font-black text-slate-900 tracking-tighter">Communication Void</p>
                                                   <p className="text-slate-400 font-medium text-sm mt-1">No broadcast signatures detected in the protocol buffer.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedData.map((notif) => (
                                        <tr key={notif.id} className={cn(
                                            "group hover:bg-brand-teal/5 transition-colors border-b border-slate-50 last:border-0",
                                            notif.priority === 'HIGH' && "bg-orange-50/30"
                                        )}>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1 max-w-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-black text-slate-900 tracking-tight text-sm uppercase group-hover:text-brand-teal transition-colors">{notif.title}</span>
                                                        {notif.priority === 'HIGH' && (
                                                            <div className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight line-clamp-1">{notif.message}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "p-2.5 rounded-xl border transition-transform group-hover:scale-110",
                                                        notif.type === 'ANNOUNCEMENT' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                                        notif.type === 'ASSIGNMENT' ? "bg-brand-teal/10 text-brand-teal border-brand-teal/10" :
                                                        notif.type === 'SYSTEM' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                                        "bg-brand-teal/10 text-brand-teal border-brand-teal/10"
                                                    )}>
                                                        {notif.type === 'ANNOUNCEMENT' ? <Megaphone size={14} strokeWidth={2.5} /> :
                                                         notif.type === 'ASSIGNMENT' ? <FileText size={14} strokeWidth={2.5} /> :
                                                         notif.type === 'SYSTEM' ? <ShieldAlert size={14} strokeWidth={2.5} /> :
                                                         <Activity size={14} strokeWidth={2.5} />}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{notif.type}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    <Users size={14} className="text-brand-teal" />
                                                    {notif.audience}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                                    <Clock size={12} />
                                                    {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).toUpperCase()}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm",
                                                    notif.status === 'SENT' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                    notif.status === 'SCHEDULED' ? "bg-orange-50 text-orange-500 border-orange-100" :
                                                    "bg-slate-50 text-slate-400 border-slate-100"
                                                )}>
                                                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm", 
                                                        notif.status === 'SENT' ? "bg-emerald-400" : 
                                                        notif.status === 'SCHEDULED' ? "bg-orange-400 animate-pulse" : 
                                                        "bg-slate-300"
                                                    )} />
                                                    {notif.status === 'SENT' ? 'COMM_EXECUTED' : 
                                                     notif.status === 'SCHEDULED' ? 'AWAITING_TX' : 'TX_VOID'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-slate-300 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
                                                        <Eye size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-all">
                                                        <Copy size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Dispatch Signal Terminal ── */}
            {isSendModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsSendModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-3xl p-0 animate-in zoom-in-95 duration-500 border border-white group/modal overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-brand-teal via-blue-500 to-brand-teal animate-shimmer bg-[length:200%_100%]" />
                        
                        <div className="p-10 md:p-12">
                            <div className="flex items-start justify-between mb-10">
                                <div>
                                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Signal Dispatcher</p>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Broadcast Protocol</h2>
                                    <p className="text-slate-500 font-medium text-sm mt-1">Configure global notification vectors for institutional synchronization.</p>
                                </div>
                                <button onClick={() => setIsSendModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSendNotification} className="space-y-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Communication Identity (Title)</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. INFRASTRUCTURE_UPGRADE_ALPHA"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-tight"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vector Classification</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.type}
                                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal font-black text-[10px] uppercase tracking-widest text-slate-600 appearance-none cursor-pointer transition-all"
                                                >
                                                    <option value="ANNOUNCEMENT">Announcement</option>
                                                    <option value="ASSIGNMENT">Assignment</option>
                                                    <option value="SYSTEM">System Alert</option>
                                                    <option value="COURSE">Course Protocol</option>
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Cluster</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.target_role}
                                                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal font-black text-[10px] uppercase tracking-widest text-slate-600 appearance-none cursor-pointer transition-all"
                                                >
                                                    <option value="ALL">Global Node (All)</option>
                                                    <option value="STUDENT">Scholar Cluster</option>
                                                    <option value="TEACHER">Faculty Cluster</option>
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Payload Content (Message)</label>
                                        <textarea
                                            required
                                            rows={5}
                                            placeholder="Enter institutional message payload..."
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-8 py-6 bg-slate-50 border border-slate-100 rounded-[32px] focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal font-bold text-slate-800 transition-all resize-none font-sans"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-10 border-t border-slate-50">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsSendModalOpen(false)}
                                        className="h-16 px-10 rounded-[28px] font-black text-slate-400 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest transition-all"
                                    >
                                        Archive Draft
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="h-16 px-12 rounded-[28px] bg-brand-teal hover:bg-brand-dark text-white font-black shadow-2xl shadow-brand-teal/20 uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 min-w-[240px] disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : (
                                            <>
                                                <Send size={20} />
                                                <span>Dispatch Signal</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
