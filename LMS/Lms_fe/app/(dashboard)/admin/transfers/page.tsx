'use client';

import { useState, useEffect } from 'react';
import {
    ArrowRightLeft,
    Search,
    BookOpen,
    User,
    CheckCircle,
    Loader2,
    Calendar,
    FileText,
    Activity,
    Shuffle,
    ChevronDown,
    X,
    ShieldCheck,
    ArrowRight,
    SearchIcon,
    History
} from 'lucide-react';
import { receiptAPI, courseAPI, enrollmentAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

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

export default function AdminTransfersPage() {
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Modal state
    const [showTransferModal, setShowTransferModal] = useState(false);
    
    // Form state
    const [selectedReceiptId, setSelectedReceiptId] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [newCourseId, setNewCourseId] = useState('');
    const [newScheduledClassId, setNewScheduledClassId] = useState('');
    const [reason, setReason] = useState('');
    
    // Detailed states for comparison
    const [sourceSectionDetails, setSourceSectionDetails] = useState<any>(null);
    const [isFetchingSource, setIsFetchingSource] = useState(false);
    
    // Derived selected data
    const selectedReceipt = receipts.find((r) => r.id === selectedReceiptId);
    const oldCourse = courses.find((c) => c.id === selectedReceipt?.course_id);
    
    const [courseSessions, setCourseSessions] = useState<any[]>([]);

    const filteredReceipts = receipts.filter(r => 
        !r.is_returned && 
        (r.student_name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
         r.code?.toLowerCase().includes(studentSearchTerm.toLowerCase()))
    );

    // Effect to fetch source section details when student is selected
    useEffect(() => {
        if (!selectedReceipt?.scheduled_class_id) {
            setSourceSectionDetails(null);
            return;
        }

        const fetchSourceDetails = async () => {
            setIsFetchingSource(true);
            try {
                const details = await courseAPI.getScheduledClassById(selectedReceipt.scheduled_class_id);
                setSourceSectionDetails(details);
            } catch (e) {
                console.error("Failed to fetch source section details", e);
            } finally {
                setIsFetchingSource(false);
            }
        };
        fetchSourceDetails();
    }, [selectedReceipt?.scheduled_class_id]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [transfersData, coursesData, receiptsData, enrollRes] = await Promise.all([
                receiptAPI.getTransfers().catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => []),
                receiptAPI.getAll(false, 3, orgId).catch(() => []),
                courseAPI.getEnrollments().catch(() => ({ results: [] }))
            ]);
            setTransfers(transfersData);
            setCourses(Array.isArray(coursesData) ? coursesData : (coursesData.results || []));
            setReceipts(receiptsData);
            setEnrollments(Array.isArray(enrollRes) ? enrollRes : (enrollRes.results || []));
        } catch (error) {
            toast.error('Failed to load transfer data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!newCourseId) {
            setCourseSessions([]);
            setNewScheduledClassId('');
            return;
        }
        
        const fetchSessions = async () => {
            try {
                const data = await courseAPI.getScheduledClasses(newCourseId);
                // The API returns results array or direct array
                const sessions = Array.isArray(data) ? data : (data.results || []);
                
                // Map the data with robust fallbacks to avoid 'undefined'
                const formattedSessions = sessions.map((s: any) => {
                    const sectionLabel = s.section_name || s.label;
                    const timingLabel = s.time_slot ? `${s.time_slot}${s.days_pattern ? ` (${s.days_pattern})` : ''}` : 'Timing TBD';
                    
                    return {
                        ...s,
                        label: sectionLabel || timingLabel || 'General Assignment'
                    };
                });
                
                setCourseSessions(formattedSessions);
            } catch (e) {
                console.error("Failed to fetch sessions", e);
                setCourseSessions([]);
            }
        };
        fetchSessions();
    }, [newCourseId]);

    const getCourseName = (id: string) => {
        const c = courses.find((course) => course.id === id);
        return c ? c.name : 'Unknown Course';
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReceipt || !newCourseId) return;

        setIsSubmitting(true);
        try {
            await receiptAPI.transferCode(selectedReceipt.id, {
                new_course_id: newCourseId,
                new_scheduled_class_id: newScheduledClassId || undefined,
                reason,
            });

            if (selectedReceipt.lms_user_id) {
                await enrollmentAPI.transferCourse({
                    student_id: selectedReceipt.lms_user_id,
                    old_course_id: selectedReceipt.course_id,
                    new_course_id: newCourseId,
                    new_scheduled_class_id: newScheduledClassId,
                }).catch(e => console.error("Enrollment switch minor failure: ", e));
            }

            toast.success('Student transferred successfully!');
            setShowTransferModal(false);
            fetchData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Transfer failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const { sortedData, sortConfig, requestSort } = useSortableData(transfers);

    if (loading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Transfer Records...</p>
          </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Student Service Hub</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <ArrowRightLeft className="w-7 h-7 text-brand-teal" />
                            Student Transfers
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage student course transfers and section movements securely.</p>
                </div>
                <Button 
                    onClick={() => {
                        setSelectedReceiptId('');
                        setNewCourseId('');
                        setNewScheduledClassId('');
                        setReason('');
                        setShowTransferModal(true);
                    }}
                    className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group border-none"
                >
                    <Shuffle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    New Transfer
                </Button>
            </div>

            {/* ── Intelligence Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-6">
                {[
                  { label: 'Total Transfers', value: transfers.length, icon: History, color: 'blue' },
                  { label: 'Active Courses', value: courses.length, icon: BookOpen, color: 'teal' },
                  { label: 'Paid Records', value: receipts.length, icon: ShieldCheck, color: 'indigo' },
                  { label: 'Total Enrolled', value: enrollments.length, icon: ShieldCheck, color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="premium-card p-8 flex flex-col group border-none shadow-premium bg-white">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm",
                            stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                            stat.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                            stat.color === 'indigo' ? "bg-brand-teal/10 text-brand-teal" :
                            "bg-emerald-50 text-emerald-600"
                        )}>
                            <stat.icon size={22} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Transaction Registry ── */}
            {/* ── Transaction Registry ── */}
            <div className="px-6">
                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                           <FileText className="w-5 h-5 text-brand-teal" /> Transfer Registry
                        </h2>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                            <SearchIcon className="w-4 h-4 text-slate-400" />
                            <input type="text" placeholder="Search records..." className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 w-48 uppercase" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <SortableTableHeader label="Student Info" sortKey="student_name" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Receipt ID" sortKey="receipt_code" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transfer Details</th>
                                    <SortableTableHeader label="Date" sortKey="transferred_at" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Processed By" sortKey="transferred_by" currentSort={sortConfig} onSort={requestSort} align="right" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {transfers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-200">
                                                <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                                   <Shuffle size={48} strokeWidth={1} />
                                                </div>
                                                <div>
                                                   <p className="text-xl font-black text-slate-900 tracking-tighter">No transfers found</p>
                                                   <p className="text-slate-400 font-medium text-sm mt-1">No student transfers have been processed in this ledger yet.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedData.map((t) => (
                                        <tr key={t.id} className="hover:bg-brand-teal/5 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black transition-transform group-hover:scale-110 group-hover:bg-brand-teal group-hover:text-white">
                                                        {t.student_name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-slate-900 tracking-tight text-sm uppercase group-hover:text-brand-teal">{t.student_name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.student_email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 border-slate-200 text-slate-500 font-black px-3 py-1 rounded-lg">
                                                    {t.receipt_code}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4 min-w-[320px]">
                                                    <div className="flex-1 p-3 bg-rose-50/30 rounded-2xl border border-rose-100/30 group-hover:bg-rose-50 transition-colors">
                                                        <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1 opacity-60">Previous Course</div>
                                                        <div className="text-[10px] font-black text-slate-700 line-clamp-1 uppercase tracking-tight">{getCourseName(t.from_course_id)}</div>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                                                        <ArrowRight size={14} className="text-brand-teal group-hover:translate-x-1 transition-transform" />
                                                        <div className="w-0.5 h-6 bg-gradient-to-b from-brand-teal to-transparent rounded-full" />
                                                    </div>
                                                    <div className="flex-1 p-3 bg-brand-teal/5 rounded-2xl border border-brand-teal/10 group-hover:bg-brand-teal/10 transition-colors">
                                                        <div className="text-[9px] font-black text-brand-teal uppercase tracking-widest mb-1 opacity-60">New Course</div>
                                                        <div className="text-[10px] font-black text-slate-900 line-clamp-1 uppercase tracking-tight">{getCourseName(t.to_course_id)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    <Calendar size={14} className="text-brand-teal" />
                                                    {new Date(t.transferred_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                    {t.transferred_by}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Full-Screen Executive Transfer Cockpit ── */}
            {showTransferModal && (
                <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col animate-in fade-in duration-500 overflow-hidden">
                    {/* ── Cinematic Top Bar ── */}
                    <div className="bg-white border-b border-slate-200 px-12 py-8 flex items-center justify-between shadow-sm relative z-30">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[24px] bg-brand-teal text-white flex items-center justify-center shadow-xl shadow-brand-teal/20">
                                <Shuffle size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">TRANSFER COCKPIT</h2>
                                <div className="flex items-center gap-4 mt-1">
                                    <Badge className="bg-brand-teal/10 text-brand-teal border-none text-[10px] font-black uppercase tracking-widest px-3">Mission Control v4.0</Badge>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systems Active & Verified</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Universal Stepper ── */}
                        <div className="hidden xl:flex items-center gap-12">
                            {[
                                { step: 1, label: 'Identify', icon: Search, active: !selectedReceiptId },
                                { step: 2, label: 'Configure', icon: ArrowRightLeft, active: selectedReceiptId && (!newCourseId || !newScheduledClassId) },
                                { step: 3, label: 'Initialize', icon: ShieldCheck, active: selectedReceiptId && newCourseId && newScheduledClassId }
                            ].map((s, idx) => (
                                <div key={idx} className={cn(
                                    "flex items-center gap-4 transition-all duration-500",
                                    s.active ? "opacity-100 scale-105" : "opacity-30 grayscale"
                                )}>
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all shadow-lg",
                                        s.active ? "bg-slate-900 text-brand-teal" : "bg-slate-200 text-slate-400"
                                    )}>
                                        <s.icon size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Step 0{s.step}</p>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{s.label}</p>
                                    </div>
                                    {idx < 2 && <div className="w-8 h-px bg-slate-200 ml-4" />}
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={() => setShowTransferModal(false)}
                            className="w-16 h-16 rounded-[24px] bg-slate-50 hover:bg-rose-500 text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-sm hover:shadow-xl hover:shadow-rose-500/20 group"
                        >
                            <X size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                        </button>
                    </div>

                    {/* ── Main Workspace ── */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 md:p-16 lg:p-20">
                        <div className="max-w-[1400px] mx-auto space-y-16">
                            
                            {/* ── PHASE 1: SEARCH & IDENTIFICATION ── */}
                            <section className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                                <div className="max-w-4xl mx-auto space-y-4 text-center">
                                    <h3 className="text-sm font-black text-brand-teal uppercase tracking-[0.4em]">Section A: Identity Verification</h3>
                                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter">Locate Student Record</h4>
                                    <p className="text-slate-500 font-medium">Search for an active student by Name, ID, or Receipt Code to begin migration logic.</p>
                                </div>

                                <div className="max-w-3xl mx-auto relative group z-40">
                                    <div className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-teal transition-colors">
                                        <Search size={32} />
                                    </div>
                                    <Input
                                        placeholder="SEARCH PERSONNEL DIRECTORY..."
                                        value={studentSearchTerm}
                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                        className="h-24 pl-20 pr-12 rounded-[32px] border-none shadow-2xl bg-white focus:ring-[16px] focus:ring-brand-teal/5 transition-all font-black text-lg uppercase tracking-tight"
                                    />
                                    
                                    {/* ── Search Dropdown (Improved Design) ── */}
                                    {studentSearchTerm && !selectedReceiptId && (
                                        <div className="absolute left-0 right-0 top-[110%] bg-white rounded-[40px] shadow-premium p-8 max-h-[450px] overflow-y-auto animate-in slide-in-from-top-4 duration-500 border border-slate-100">
                                            {filteredReceipts.length === 0 ? (
                                                <div className="p-16 text-center text-slate-300 font-black uppercase text-sm tracking-widest italic">Inventory Error: Personnel Not Found.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {filteredReceipts.map(r => (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedReceiptId(r.id);
                                                                setStudentSearchTerm(`${r.student_name} (${r.code})`);
                                                            }}
                                                            className="flex items-center gap-5 p-6 hover:bg-brand-teal/5 rounded-[28px] transition-all group/item border border-transparent hover:border-brand-teal/10 text-left"
                                                        >
                                                            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-brand-teal flex items-center justify-center font-black text-xl shadow-lg">
                                                                {r.student_name?.[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-900 text-base uppercase tracking-tighter leading-none mb-1">{r.student_name}</div>
                                                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{r.code} • {r.student_email || 'Verified ID'}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── PHASE 2: COMPARISON & CONFIGURATION ── */}
                            {selectedReceipt && (
                                <section className="space-y-12 animate-in slide-in-from-bottom-12 duration-1000 fill-mode-both">
                                    <div className="flex items-center gap-6 text-[11px] font-black text-brand-teal uppercase tracking-[0.5em] before:h-0.5 before:flex-1 before:bg-slate-200 after:h-0.5 after:flex-1 after:bg-slate-200">
                                        Migration Analysis Center
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch relative">
                                        
                                        {/* ── Origin Column (Source Passport) ── */}
                                        <div className="lg:col-span-5 space-y-6">
                                            <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">1</div>
                                                Origin Environment
                                            </div>
                                            
                                            <div className="bg-white rounded-[56px] shadow-premium p-10 space-y-10 border border-slate-100 relative overflow-hidden group/passport h-full">
                                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 -translate-y-8 translate-x-8">
                                                    <User size={300} strokeWidth={1} className="text-slate-900" />
                                                </div>
                                                
                                                <div className="flex items-center gap-8 relative z-10">
                                                    <div className="w-24 h-24 rounded-[32px] bg-slate-900 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                                                        {selectedReceipt.student_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <Badge className="bg-brand-teal/10 text-brand-teal border-none mb-2 font-black uppercase text-[9px] tracking-widest">Verified Student</Badge>
                                                        <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{selectedReceipt.student_name}</h4>
                                                        <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-1">{selectedReceipt.code} • {selectedReceipt.student_email}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-8 pt-10 mt-10 border-t border-slate-50 relative z-10">
                                                    <div className="space-y-6">
                                                        <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Enrolled Curricula</p>
                                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{oldCourse ? oldCourse.name : 'Unknown Path'}</p>
                                                        </div>

                                                        <div className="flex gap-4">
                                                            <div className="flex-1 p-6 bg-slate-900 rounded-[32px] border border-slate-800 text-white">
                                                                <p className="text-[9px] font-black text-brand-teal uppercase tracking-widest mb-2">Primary Instructor</p>
                                                                {isFetchingSource ? (
                                                                    <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
                                                                ) : (
                                                                    <p className="text-sm font-black uppercase tracking-tight">
                                                                        {sourceSectionDetails?.teacher_name || sourceSectionDetails?.instructor_name || 'Staff Not Assigned'}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Institutional Room</p>
                                                                {isFetchingSource ? (
                                                                    <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                                                            {sourceSectionDetails?.section_name || sourceSectionDetails?.label || 'General Allocation'}
                                                                        </p>
                                                                        {sourceSectionDetails?.time_slot && (
                                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                                {sourceSectionDetails.time_slot}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Visual Migration Bridge ── */}
                                        <div className="hidden lg:flex lg:col-span-2 flex-col items-center justify-center gap-4">
                                             <div className="w-20 h-20 rounded-full bg-white shadow-3xl flex items-center justify-center text-brand-teal border border-brand-teal/20 animate-bounce duration-[3s]">
                                                 <ArrowRight size={40} strokeWidth={3} />
                                             </div>
                                             <div className="h-40 w-1 bg-gradient-to-b from-brand-teal/20 via-brand-teal to-brand-teal/20 rounded-full shadow-lg shadow-brand-teal/40" />
                                        </div>

                                        {/* ── Destination Column (Configuration Panel) ── */}
                                        <div className="lg:col-span-5 space-y-6">
                                            <div className="flex items-center gap-4 text-[10px] font-black text-brand-teal uppercase tracking-widest">
                                                <div className="w-8 h-8 rounded-lg bg-brand-teal text-white flex items-center justify-center">2</div>
                                                Deployment Target
                                            </div>

                                            <div className="bg-white rounded-[56px] shadow-premium p-10 space-y-10 border-4 border-brand-teal/10 h-full flex flex-col justify-center">
                                                <div className="space-y-8">
                                                    <div className="space-y-3">
                                                        <label className="text-xs font-black text-slate-900 uppercase tracking-tight pl-2 flex items-center gap-2">
                                                            <BookOpen size={16} className="text-brand-teal" /> Select New Path
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                required
                                                                value={newCourseId}
                                                                onChange={(e) => {
                                                                    setNewCourseId(e.target.value);
                                                                    setNewScheduledClassId('');
                                                                }}
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-[32px] py-8 px-10 text-lg font-black text-slate-900 focus:outline-none focus:ring-[20px] focus:ring-brand-teal/5 focus:border-brand-teal transition-all appearance-none cursor-pointer uppercase tracking-tight shadow-sm"
                                                            >
                                                                <option value="" disabled>IDENTIFY TARGET COURSE...</option>
                                                                {courses.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={28} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <label className="text-xs font-black text-slate-900 uppercase tracking-tight pl-2 flex items-center gap-2">
                                                            <Activity size={16} className="text-brand-teal" /> Select Specific Assignment
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                required
                                                                value={newScheduledClassId}
                                                                onChange={(e) => setNewScheduledClassId(e.target.value)}
                                                                disabled={!newCourseId || (courseSessions.length === 0)}
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-[32px] py-8 px-10 text-base font-black text-slate-900 focus:outline-none focus:ring-[20px] focus:ring-brand-teal/5 focus:border-brand-teal transition-all appearance-none cursor-pointer uppercase tracking-tight disabled:bg-slate-50 disabled:text-slate-300 shadow-sm"
                                                            >
                                                                <option value="" disabled>
                                                                    {!newCourseId ? 'AWAITING COURSE SELECTION' : courseSessions.length === 0 ? 'NO ACTIVE SECTIONS FOUND' : 'IDENTIFY INSTRUCTOR & ROOM...'}
                                                                </option>
                                                                {courseSessions
                                                                    .filter(cs => String(cs.id) !== String(selectedReceipt.scheduled_class_id))
                                                                    .map(cs => (
                                                                        <option key={cs.id} value={cs.id}>
                                                                            [{cs.teacher_name || 'Staff'}] – {cs.label}
                                                                        </option>
                                                                    ))
                                                                }
                                                            </select>
                                                            <ChevronDown className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={28} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {newScheduledClassId && (
                                                    <div className="mt-12 bg-white/50 p-6 rounded-[32px] border-2 border-emerald-500/20 shadow-lg shadow-emerald-500/5 animate-in slide-in-from-bottom-4 flex items-center gap-6">
                                                        <div className="w-16 h-16 rounded-[20px] bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30">
                                                            <CheckCircle size={32} strokeWidth={2.5} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Target Validated</div>
                                                            <div className="text-xl font-black text-slate-900 uppercase">Synchronization Lock Engaged</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── PHASE 3: FINAL AUDIT & INITIALIZATION ── */}
                            {selectedReceipt && newCourseId && newScheduledClassId && (
                                <section className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both pb-20">
                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] text-center w-full block">Institutional Audit Logic</label>
                                        <Input 
                                            required
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="ENTER MANDATORY AUDIT REASON FOR PERSONNEL RECONFIGURATION..."
                                            className="h-24 rounded-[32px] border-none shadow-3xl bg-white focus:ring-[16px] focus:ring-brand-teal/5 transition-all font-black text-base uppercase tracking-tight text-center"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center justify-center gap-8">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            onClick={() => setShowTransferModal(false)} 
                                            className="h-24 px-16 rounded-[40px] font-black text-slate-400 hover:bg-white uppercase text-sm tracking-widest transition-all"
                                        >
                                            Abort Deployment
                                        </Button>
                                        <Button 
                                            onClick={handleTransfer}
                                            disabled={isSubmitting} 
                                            className="h-24 px-24 rounded-[40px] bg-brand-teal hover:bg-brand-dark text-white font-black shadow-[0_20px_50px_rgba(23,208,222,0.4)] uppercase text-sm tracking-[0.3em] flex items-center gap-4 transition-all active:scale-95 border-none disabled:opacity-30 min-w-[420px] group"
                                        >
                                            {isSubmitting ? <Loader2 size={32} className="animate-spin" /> : <ShieldCheck size={32} className="group-hover:scale-110 transition-transform duration-500" />}
                                            {isSubmitting ? 'EXECUTING DATA SYNC...' : 'AUTHORIZE MIGRATION'}
                                        </Button>
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
