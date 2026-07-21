'use client';

import { useState, useEffect } from 'react';
import {
    Plus, Search, CheckCircle, XCircle, Clock, FileText, Users,
    Mail, ArrowRight, Loader2, X, RefreshCw, Filter,
    CheckCircle2, ArrowLeftRight, TrendingUp, Activity, ShieldCheck,
    ChevronRight, BookOpen, GraduationCap, MapPin, AlertCircle, History,
    ChevronDown
} from 'lucide-react';
import { receiptAPI, courseAPI, enrollmentAPI, userAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TransferRecord {
    id: string;
    student_email: string;
    student_name: string;
    receipt_code: string;
    from_course_id: string;
    to_course_id: string;
    reason: string;
    transferred_at: string;
    transferred_by: string;
}

export default function CoordinatorTransfersPage() {
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal state
    const [showTransferModal, setShowTransferModal] = useState(false);

    // Form state
    const [selectedReceiptId, setSelectedReceiptId] = useState('');
    const [newCourseId, setNewCourseId] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [transfersData, coursesData, receiptsData] = await Promise.all([
                receiptAPI.getTransfers().catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => ({ results: [] } as any)),
                receiptAPI.getAll(false, 3, orgId).catch(() => [])
            ]);
            setTransfers(Array.isArray(transfersData) ? transfersData : []);
            setCourses(Array.isArray(coursesData) ? coursesData : (coursesData?.results || coursesData?.data || []));
            setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load institutional relocation data');
        } finally {
            setLoading(false);
        }
    };

    const getCourseName = (id: string) => {
        if (!id) return 'Unknown Origin';
        const c = courses.find((course) => course.id === id);
        return c ? c.name : 'Unknown Core';
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedReceipt = receipts.find(r => r.id === selectedReceiptId);
        if (!selectedReceipt || !newCourseId) {
            toast.error('Identify relocation vector and target curriculum');
            return;
        }

        try {
            setIsSubmitting(true);

            // 1. Transfer the receipt code
            await receiptAPI.transferCode(selectedReceipt.id, {
                new_course_id: newCourseId,
                reason,
            });

            // 2. Transfer the LMS enrollment if applicable
            if (selectedReceipt.lms_user_id) {
                await enrollmentAPI.transferCourse({
                    student_id: selectedReceipt.lms_user_id,
                    old_course_id: selectedReceipt.course_id,
                    new_course_id: newCourseId,
                    new_scheduled_class_id: '', // Optional or default session
                }).catch(e => console.error("Enrollment switch minor failure: ", e));
            }

            toast.success('Curricular relocation authorized successfully!');
            setShowTransferModal(false);
            setSelectedReceiptId('');
            setNewCourseId('');
            setReason('');
            fetchData();
        } catch (error: any) {
            console.error('Transfer error:', error);
            toast.error(error?.response?.data?.detail || error?.response?.data?.message || 'Curricular relocation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredTransfers = transfers.filter(log =>
        log.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.student_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.receipt_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = [
        { label: 'Relocations', value: transfers.length, icon: History, color: 'blue' },
        { label: 'Active Curriculums', value: courses.length, icon: BookOpen, color: 'emerald' },
        { label: 'Verified Receipts', value: receipts.length, icon: ShieldCheck, color: 'orange' },
    ];

    const selectedReceipt = receipts.find(r => r.id === selectedReceiptId);
    const oldCourse = courses.find(c => c.id === selectedReceipt?.course_id);

    if (loading && !transfers.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Hydrating Relocation Terminal...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

            {/* â”€â”€ Header Area â”€â”€ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <ArrowLeftRight className="w-7 h-7 text-brand-teal" />
                        Student Transfers
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Manage institutional student transfers between curricular programs and specializations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={fetchData} variant="outline" className="rounded-2xl border-slate-200 h-12 px-5 font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex gap-2">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                    <Button
                        onClick={() => {
                            setSelectedReceiptId('');
                            setNewCourseId('');
                            setReason('');
                            setShowTransferModal(true);
                        }}
                        className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl shadow-lg shadow-brand-teal/20 h-12 px-6 font-bold transition-all group"
                    >
                        <ArrowLeftRight className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                        Initiate Relocation
                    </Button>
                </div>
            </div>

            {/* â”€â”€ Intelligence Recap â”€â”€ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="premium-card p-6 flex flex-col group relative overflow-hidden">
                        <div className={cn(
                            "absolute -right-2 -top-2 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
                            stat.color === 'blue' ? "bg-blue-600" :
                                stat.color === 'emerald' ? "bg-emerald-600" : "bg-orange-600"
                        )} />
                        <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500 shadow-sm',
                            stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                                stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                        )}>
                            <stat.icon size={20} strokeWidth={2.5} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* â”€â”€ Transaction Registry â”€â”€ */}
            <div>
                <Card className="rounded-[2.5rem] border-white/40 shadow-premium overflow-hidden bg-white/50 backdrop-blur-md">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 max-w-sm relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-brand-teal transition-colors" />
                            <input
                                type="text"
                                placeholder="Locate relocation record..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Filter size={14} className="mr-1" /> Registry Vector: All
                        </div>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validated Scholar</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Crossover Matrix</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt Vector</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Authorization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {filteredTransfers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-300">
                                                <ArrowLeftRight size={48} strokeWidth={1} />
                                                <p className="text-sm font-black uppercase tracking-widest">No Relocation Logs Found</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransfers.map((log) => (
                                        <tr key={log.id} className="group hover:bg-blue-50/30 transition-all">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black transition-transform group-hover:scale-110 shadow-sm uppercase">
                                                        {log.student_name?.[0]}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors uppercase text-sm">{log.student_name}</span>
                                                        <span className="text-[11px] font-medium text-slate-500 opacity-60 flex items-center gap-1.5 mt-0.5">
                                                            <Mail className="w-3 h-3" /> {log.student_email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                                                        {getCourseName(log.from_course_id)}
                                                    </div>
                                                    <ArrowRight size={12} className="text-blue-400" />
                                                    <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-[10px] font-black text-blue-600 uppercase tracking-widest shadow-sm border border-blue-100/50">
                                                        {getCourseName(log.to_course_id)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <Badge variant="outline" className="font-mono text-[10px] bg-white border-slate-200 text-slate-600 font-black px-2.5 py-1 rounded-lg shadow-sm tracking-tighter">
                                                    {log.receipt_code}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-900 tracking-tighter uppercase tabular-nums">
                                                        {new Date(log.transferred_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized by: {log.transferred_by}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* â”€â”€ Relocation Terminal Modal â”€â”€ */}
            {showTransferModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowTransferModal(false)}></div>
                    <div className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300 border border-white/20 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-teal to-brand-dark" />

                        <div className="flex items-center justify-between mb-10 border-b border-slate-50 pb-6 mt-2">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                                    <ArrowLeftRight className="w-8 h-8 text-blue-600" />
                                    Crossover Auth
                                </h2>
                                <p className="text-slate-500 font-medium text-sm">Initiate a curricular relocation sequence.</p>
                            </div>
                            <button onClick={() => setShowTransferModal(false)} className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-[1.5rem] transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleTransfer} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Target Scholar Matrix</label>
                                <div className="relative">
                                    <select
                                        required
                                        value={selectedReceiptId}
                                        onChange={(e) => setSelectedReceiptId(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-black text-slate-900 tracking-tight shadow-inner cursor-pointer appearance-none uppercase"
                                    >
                                        <option value="">Query Active Registries...</option>
                                        {receipts.filter(r => !r.is_returned).map(r => (
                                            <option key={r.id} value={r.id}>{r.code} â€¢ {r.student_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                </div>
                            </div>

                            {selectedReceipt && (
                                <div className="bg-slate-900 p-6 rounded-[2.5rem] space-y-4 border border-white/5 shadow-xl transition-all animate-in slide-in-from-top-2 duration-500">
                                    <div className="flex items-start justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-brand-dark uppercase tracking-widest mb-1">Source Origin</span>
                                            <span className="text-lg font-black text-white tracking-tight uppercase line-clamp-1">{oldCourse ? oldCourse.name : 'Unknown Core'}</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20">
                                            <BookOpen size={24} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-brand-teal text-white border-none font-black text-[9px] px-2 py-0.5 rounded-lg tracking-widest uppercase">ID: {selectedReceipt.code}</Badge>
                                        <div className="h-px flex-1 bg-white/10" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Relocation Target (Curriculum)</label>
                                <div className="relative">
                                    <select
                                        required
                                        value={newCourseId}
                                        onChange={(e) => setNewCourseId(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-black text-slate-900 tracking-tight shadow-inner cursor-pointer appearance-none uppercase"
                                    >
                                        <option value="">Select Target Core...</option>
                                        {courses.filter(c => c.id !== selectedReceipt?.course_id).map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Relocation Justification (Reason)</label>
                                <Input
                                    required
                                    placeholder="Audit-ready reason for institutional relocation..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="h-14 rounded-2xl border-none bg-slate-50 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-bold text-xs shadow-inner uppercase tracking-tight"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
                                <Button type="button" variant="ghost" onClick={() => setShowTransferModal(false)} className="rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600">
                                    Abort
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !selectedReceiptId || !newCourseId}
                                    className="bg-brand-teal hover:bg-brand-dark text-white rounded-[1.5rem] h-14 px-10 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-teal/20 transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck size={18} /> Finalized Crossover</>}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
