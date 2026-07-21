'use client';

import { useState, useEffect } from 'react';
import {
    Plus, Search, CheckCircle, Clock,
    Mail, Loader2, X, Banknote, RefreshCw,
    CheckCircle2, ArrowLeftRight, TrendingUp, Activity, ShieldCheck,
    Check, Layers
} from 'lucide-react';
import { receiptAPI, courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface ReceiptCode {
    id: string;
    code: string;
    student_email: string;
    student_name: string;
    course_id: string | null;
    test_score: number | null;
    verified: boolean;
    lms_account_created: boolean;
    generated_at: string;
    deposit_amount?: number;
    receipt_number?: string;
    bag_taken?: boolean;
    bag_fee?: number;
    bag_paid?: boolean;
    bag_waived?: boolean;
    id_card_taken?: boolean;
    id_card_fee?: number;
    id_card_paid?: boolean;
    id_card_waived?: boolean;
    certificate_taken?: boolean;
    certificate_fee?: number;
    certificate_paid?: boolean;
    certificate_waived?: boolean;
    is_returned?: boolean;
    amount_returned?: number;
    is_waived?: boolean;
}

export default function CoordinatorUnifiedDepositsPage() {
    const [receipts, setReceipts] = useState<ReceiptCode[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState<ReceiptCode | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [returnRemarks, setReturnRemarks] = useState('');

    const [formData, setFormData] = useState({
        code: '',
        student_email: '',
        student_name: '',
        course_id: '',
        test_score: '',
        deposit_amount: 3000,
        bag_taken: true,
        bag_fee: 800,
        bag_paid: true,
        bag_waived: false,
        id_card_taken: true,
        id_card_fee: 200,
        id_card_paid: true,
        id_card_waived: false,
        certificate_taken: true,
        certificate_fee: 200,
        certificate_paid: true,
        certificate_waived: false,
        is_waived: false,
        remarks: ''
    });

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [codesData, coursesData] = await Promise.all([
                receiptAPI.getAll(false, 3, orgId).catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => ({ results: [] } as any))
            ]);
            setReceipts(Array.isArray(codesData) ? codesData : ((codesData as any)?.results || (codesData as any)?.data || []));
            setCourses(Array.isArray(coursesData) ? coursesData : ((coursesData as any)?.results || (coursesData as any)?.data || []));
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddReceipt = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.code || !formData.student_email || !formData.student_name) {
            toast.error('Please fill required fields (Code, Name, Email)');
            return;
        }

        try {
            setIsSubmitting(true);
            const selectedCourse = courses.find((c: any) => c.id === formData.course_id);
            const isTestNotRequired = selectedCourse && selectedCourse.iq_required === false;

            let testScoreFinal: number | null = null;
            if (!isTestNotRequired && formData.test_score !== '' && formData.test_score !== 'Not Required') {
                testScoreFinal = parseInt(formData.test_score);
            }

            await receiptAPI.create({
                code: formData.code,
                student_email: formData.student_email,
                student_name: formData.student_name,
                course_id: formData.course_id,
                test_score: testScoreFinal,
                deposit_amount: formData.deposit_amount,
                bag_taken: formData.bag_taken,
                bag_fee: formData.bag_fee,
                bag_paid: formData.bag_paid,
                bag_waived: formData.bag_waived,
                id_card_taken: formData.id_card_taken,
                id_card_fee: formData.id_card_fee,
                id_card_paid: formData.id_card_paid,
                id_card_waived: formData.id_card_waived,
                certificate_taken: formData.certificate_taken,
                certificate_fee: formData.certificate_fee,
                certificate_paid: formData.certificate_paid,
                certificate_waived: formData.certificate_waived,
                is_waived: formData.is_waived,
                remarks: formData.remarks
            });

            toast.success('Deposit & Receipt Added successfully!');
            setShowAddModal(false);
            setFormData({
                ...formData, code: '', student_email: '', student_name: '', course_id: '', test_score: ''
            });
            fetchAllData();
        } catch (error: any) {
            console.error('Error adding receipt code:', error);
            toast.error(error?.response?.data?.detail || 'Error adding receipt code');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProcessReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showReturnModal) return;
        try {
            setIsSubmitting(true);
            await receiptAPI.processReturn(showReturnModal.id, returnRemarks);
            toast.success('Return processed successfully!');
            setShowReturnModal(null);
            setReturnRemarks('');
            fetchAllData();
        } catch (error: any) {
            toast.error("Error processing return: " + (error?.response?.data?.detail || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCourseName = (courseId: string | null) => {
        if (!courseId) return 'Unknown Course';
        const course = courses.find(c => c.id === courseId);
        return course ? course.name : 'Unknown Course';
    };

    const filteredReceipts = receipts.filter(code =>
        code.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.student_email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = [
        { label: 'Total Admissions', value: receipts.length, icon: Banknote, color: 'blue' },
        { label: 'Pending Returns', value: receipts.filter(c => !c.is_returned).length, icon: Clock, color: 'orange' },
    ];

    const currentSelectedCourse = courses.find((c: any) => c.id === formData.course_id);
    const isCurrentTestNotRequired = currentSelectedCourse && currentSelectedCourse.iq_required === false;

    if (loading && !receipts.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin" />
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Hydrating Admissions...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

            {/* â”€â”€ Header Area â”€â”€ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Banknote className="w-7 h-7 text-brand-teal" />
                        Admissions & Deposits
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Manage institutional registration receipts, entrance leads, and student deposits.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={fetchAllData} variant="outline" className="rounded-2xl border-slate-200 h-12 px-5 font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex gap-2">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                    <Button
                        onClick={() => {
                            setFormData({ ...formData, code: '', student_email: '', student_name: '', course_id: '', test_score: 'Not Required' });
                            setShowAddModal(true);
                        }}
                        className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl shadow-lg shadow-brand-teal/20 h-12 px-6 font-bold transition-all group"
                    >
                        <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                        Process Admission
                    </Button>
                </div>
            </div>

            {/* â”€â”€ Intelligence Recap â”€â”€ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="premium-card p-6 flex flex-col group relative overflow-hidden">
                        <div className={cn(
                            "absolute -right-2 -top-2 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
                            stat.color === 'blue' ? "bg-blue-600" : "bg-orange-600"
                        )} />
                        <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500 shadow-sm',
                            stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        )}>
                            <stat.icon size={20} strokeWidth={2.5} />
                        </div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* â”€â”€ Controls Area â”€â”€ */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 max-w-md relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4 group-focus-within:text-brand-teal transition-colors" />
                        <input
                            type="text"
                            placeholder="Search Active Admissions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* â”€â”€ Main Ledger â”€â”€ */}
            <div>
                <Card className="rounded-[2.5rem] border-white/40 shadow-premium overflow-hidden bg-white/50 backdrop-blur-md">
                    <div className="overflow-x-auto no-scrollbar">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600 py-6 pl-8">Receipt / Scholar</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600">Receipt #</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600">Curriculum / Performance</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600">Fiscal Breakdown</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600">Status Vector</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-600 text-right pr-8">Authorization</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReceipts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-300">
                                                <Banknote size={48} strokeWidth={1} />
                                                <p className="text-sm font-black uppercase tracking-widest">No Active Admissions Found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReceipts.map((code) => (
                                        <TableRow key={code.id} className="group hover:bg-blue-50/30 transition-colors">
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono font-black text-[10px] text-brand-dark bg-brand-teal/10 w-max px-2.5 py-1 rounded-lg border border-brand-teal/10/50 uppercase tracking-tighter">
                                                        {code.code}
                                                    </span>
                                                    <span className="font-black text-slate-900 tracking-tight mt-1 truncate max-w-[200px]">{code.student_name}</span>
                                                    <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5 opacity-70">
                                                        <Mail className="w-3 h-3" /> {code.student_email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-mono font-black text-[10px] text-blue-700 bg-blue-50 w-max px-2.5 py-1 rounded-lg border border-blue-100/50 uppercase">
                                                    {code.receipt_number || "AIT-DEP-0000"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest w-max shadow-sm">
                                                        {getCourseName(code.course_id)}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 ml-1">
                                                        <Activity className="w-3 h-3 text-slate-600" />
                                                        <span className="text-[11px] font-bold text-slate-700">
                                                            Score: {code.test_score === null ? <span className="text-slate-300 font-black italic">EXEMPT</span> : <span className={code.test_score >= 70 ? "text-emerald-500 font-black" : "text-rose-500 font-black"}>{code.test_score}%</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                <div className="flex flex-col gap-1 mt-1 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100 w-max">
                                                    <div className={cn("font-black text-[13px] tracking-tighter", code.is_waived ? "text-emerald-600 italic" : "text-slate-900")}>
                                                        {code.is_waived ? "Scholarship / Aid" : `Deposit: PKR ${code.deposit_amount || 0}`}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {code.bag_taken && (
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                                                code.bag_waived ? "bg-emerald-50 text-emerald-600 italic" :
                                                                    code.bag_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                            )}>
                                                                Gear: {code.bag_waived ? "Waived" : code.bag_paid ? "Paid" : `Pending -${code.bag_fee}`}
                                                            </span>
                                                        )}
                                                        {code.id_card_taken && (
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                                                code.id_card_waived ? "bg-emerald-50 text-emerald-600 italic" :
                                                                    code.id_card_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                            )}>
                                                                ID: {code.id_card_waived ? "Waived" : code.id_card_paid ? "Paid" : `Pending -${code.id_card_fee}`}
                                                            </span>
                                                        )}
                                                        {(code as any).certificate_taken && (
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                                                (code as any).certificate_waived ? "bg-emerald-50 text-emerald-600 italic" :
                                                                    (code as any).certificate_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                            )}>
                                                                CT: {(code as any).certificate_waived ? "Waived" : (code as any).certificate_paid ? "Paid" : `Pending -${(code as any).certificate_fee}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    <div className={cn(
                                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm w-max transition-all",
                                                        code.verified ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                                                    )}>
                                                        {code.verified ? <CheckCircle className="w-3 h-3" strokeWidth={3} /> : <Clock className="w-3 h-3" strokeWidth={3} />}
                                                        {code.verified ? 'Verified Entry' : 'Pending'}
                                                    </div>
                                                    <div className={cn(
                                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm w-max transition-all",
                                                        code.lms_account_created ? "text-blue-600 bg-blue-50" : "text-slate-600 bg-slate-100"
                                                    )}>
                                                        <div className={cn("w-1.5 h-1.5 rounded-full", code.lms_account_created ? "bg-blue-500" : "bg-slate-300")} />
                                                        {code.lms_account_created ? 'LMS ACTIVE' : 'NO ACCOUNT'}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex justify-end gap-2">
                                                    {code.is_returned ? (
                                                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl opacity-60">
                                                            <CheckCircle2 className="w-4 h-4" /> Returned (Rs. {code.amount_returned})
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setShowReturnModal(code)}
                                                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest h-10 px-4 transition-all shadow-sm hover:shadow-emerald-200"
                                                        >
                                                            Process Refund
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* â”€â”€ Admission Modal â”€â”€ */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowAddModal(false)}></div>
                        <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-300 border border-white/20 max-h-[90vh] overflow-y-auto no-scrollbar">
                            <div className="flex items-center justify-between mb-10 sticky top-0 bg-white/80 backdrop-blur-md z-10 py-2 border-b border-slate-50">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                                        <Banknote className="w-8 h-8 text-blue-600" />
                                        Admission Terminal
                                    </h2>
                                    <p className="text-slate-700 font-medium text-sm">Synthesize a new institutional entry node.</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-[1.5rem] transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleAddReceipt} className="space-y-8 pb-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={14} className="text-blue-500" /> Core Identification
                                        </h3>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Receipt Protocol Code</label>
                                            <input required type="text" placeholder="e.g. RCP-2026-X" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-black text-blue-700 tracking-tighter shadow-inner"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Scholar Full Name</label>
                                            <input required type="text" placeholder="Legal Name" value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-bold text-slate-900 tracking-tight shadow-inner"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Official Email Address</label>
                                            <input required type="email" placeholder="scholar@domain.com" value={formData.student_email} onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-bold text-slate-900 tracking-tight shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                            <Layers size={14} className="text-blue-500" /> Program Matrix
                                        </h3>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Admitting Program</label>
                                            <select required value={formData.course_id} onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-black text-slate-900 tracking-tight shadow-inner cursor-pointer"
                                            >
                                                <option value="" className="font-sans">Select Curriculum...</option>
                                                {courses.map(course => <option key={course.id} value={course.id} className="font-sans">{course.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Entrance Vector (Score)</label>
                                            <input required={!isCurrentTestNotRequired} disabled={isCurrentTestNotRequired} type="text" placeholder={isCurrentTestNotRequired ? "EXEMPT" : "Score %"} value={isCurrentTestNotRequired ? 'Not Required' : formData.test_score} onChange={(e) => setFormData({ ...formData, test_score: e.target.value })}
                                                className={cn(
                                                    "w-full px-5 py-4 border-none rounded-2xl focus:ring-4 transition-all font-black tracking-tighter shadow-inner",
                                                    isCurrentTestNotRequired ? "bg-emerald-50 text-emerald-600 cursor-not-allowed" : "bg-slate-50 text-slate-900 focus:ring-blue-500/10 focus:bg-white"
                                                )}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Fiscal Notes</label>
                                            <input type="text" placeholder="Internal remarks..." value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-medium text-slate-700 text-sm shadow-inner"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200/60 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Banknote size={16} strokeWidth={2.5} className="text-blue-600" /> Fiscal Settlement
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Vault Security Deposit (Rs.)</label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <div className={cn("w-4 h-4 rounded border transition-all flex items-center justify-center", formData.is_waived ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
                                                        {formData.is_waived && <Check size={10} className="text-white" />}
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={formData.is_waived} onChange={e => setFormData({ ...formData, is_waived: e.target.checked, deposit_amount: e.target.checked ? 0 : 3000 })} />
                                                    <span className="text-[9px] font-black text-slate-600 uppercase group-hover:text-emerald-600">Apply Financial Aid</span>
                                                </label>
                                            </div>
                                            <div className="relative">
                                                <input type="number" required disabled={formData.is_waived} value={formData.deposit_amount} onChange={e => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                                                    className={cn(
                                                        "w-full rounded-2xl px-6 py-5 text-3xl font-black focus:ring-8 transition-all outline-none",
                                                        formData.is_waived ? "bg-emerald-50 border-2 border-emerald-100 text-emerald-600 focus:ring-emerald-500/5" : "bg-white border-2 border-slate-200 text-slate-900 focus:ring-blue-500/5 focus:border-blue-500"
                                                    )}
                                                />
                                                {!formData.is_waived && <TrendingUp className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6 pointer-events-none" />}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Supplementary Inventory</p>

                                            {/* Gear Card */}
                                            <div className={cn(
                                                "p-5 rounded-[2rem] border-2 transition-all duration-300",
                                                formData.bag_taken ? "bg-white border-blue-50 shadow-sm" : "bg-slate-100/50 border-transparent opacity-50"
                                            )}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all", formData.bag_taken ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200")}>
                                                            {formData.bag_taken && <Check size={12} strokeWidth={4} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.bag_taken} onChange={e => setFormData({ ...formData, bag_taken: e.target.checked })} />
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Institutional Gear</span>
                                                    </label>

                                                    {formData.bag_taken && (
                                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                                            {['Pending', 'Paid', 'Waived'].map((lbl) => {
                                                                const isActive = lbl === 'Waived' ? formData.bag_waived : (lbl === 'Paid' ? formData.bag_paid && !formData.bag_waived : !formData.bag_paid && !formData.bag_waived);
                                                                return (
                                                                    <button key={lbl} type="button" onClick={() => {
                                                                        if (lbl === 'Waived') setFormData({ ...formData, bag_waived: true, bag_paid: false });
                                                                        else if (lbl === 'Paid') setFormData({ ...formData, bag_waived: false, bag_paid: true });
                                                                        else setFormData({ ...formData, bag_waived: false, bag_paid: false });
                                                                    }} className={cn("px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all", isActive ? "bg-white shadow-sm text-blue-600" : "text-slate-600")}>{lbl}</button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.bag_taken && !formData.bag_waived && (
                                                    <input type="number" value={formData.bag_fee} onChange={e => setFormData({ ...formData, bag_fee: Number(e.target.value) })} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-black text-blue-600 focus:ring-0" />
                                                )}
                                            </div>

                                            {/* ID Card Card */}
                                            <div className={cn(
                                                "p-5 rounded-[2rem] border-2 transition-all duration-300",
                                                formData.id_card_taken ? "bg-white border-brand-teal/10 shadow-sm" : "bg-slate-100/50 border-transparent opacity-50"
                                            )}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all", formData.id_card_taken ? "bg-brand-teal border-brand-teal" : "bg-white border-slate-200")}>
                                                            {formData.id_card_taken && <Check size={12} strokeWidth={4} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.id_card_taken} onChange={e => setFormData({ ...formData, id_card_taken: e.target.checked })} />
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">LMS Identifier</span>
                                                    </label>

                                                    {formData.id_card_taken && (
                                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                                            {['Pending', 'Paid', 'Waived'].map((lbl) => {
                                                                const isActive = lbl === 'Waived' ? formData.id_card_waived : (lbl === 'Paid' ? formData.id_card_paid && !formData.id_card_waived : !formData.id_card_paid && !formData.id_card_waived);
                                                                return (
                                                                    <button key={lbl} type="button" onClick={() => {
                                                                        if (lbl === 'Waived') setFormData({ ...formData, id_card_waived: true, id_card_paid: false });
                                                                        else if (lbl === 'Paid') setFormData({ ...formData, id_card_waived: false, id_card_paid: true });
                                                                        else setFormData({ ...formData, id_card_waived: false, id_card_paid: false });
                                                                    }} className={cn("px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all", isActive ? "bg-white shadow-sm text-brand-teal" : "text-slate-600")}>{lbl}</button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.id_card_taken && !formData.id_card_waived && (
                                                    <input type="number" value={formData.id_card_fee} onChange={e => setFormData({ ...formData, id_card_fee: Number(e.target.value) })} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-black text-brand-teal focus:ring-0" />
                                                )}
                                            </div>

                                            {/* Certificate Fee Card */}
                                            <div className={cn(
                                                "p-5 rounded-[2rem] border-2 transition-all duration-300",
                                                formData.certificate_taken ? "bg-white border-amber-50 shadow-sm" : "bg-slate-100/50 border-transparent opacity-50"
                                            )}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all", formData.certificate_taken ? "bg-amber-600 border-amber-600" : "bg-white border-slate-200")}>
                                                            {formData.certificate_taken && <Check size={12} strokeWidth={4} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.certificate_taken} onChange={e => setFormData({ ...formData, certificate_taken: e.target.checked })} />
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Certificate</span>
                                                    </label>

                                                    {formData.certificate_taken && (
                                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                                            {['Pending', 'Paid', 'Waived'].map((lbl) => {
                                                                const isActive = lbl === 'Waived' ? formData.certificate_waived : (lbl === 'Paid' ? formData.certificate_paid && !formData.certificate_waived : !formData.certificate_paid && !formData.certificate_waived);
                                                                return (
                                                                    <button key={lbl} type="button" onClick={() => {
                                                                        if (lbl === 'Waived') setFormData({ ...formData, certificate_waived: true, certificate_paid: false });
                                                                        else if (lbl === 'Paid') setFormData({ ...formData, certificate_waived: false, certificate_paid: true });
                                                                        else setFormData({ ...formData, certificate_waived: false, certificate_paid: false });
                                                                    }} className={cn("px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all", isActive ? "bg-white shadow-sm text-amber-600" : "text-slate-600")}>{lbl}</button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.certificate_taken && !formData.certificate_waived && (
                                                    <input type="number" value={formData.certificate_fee} onChange={e => setFormData({ ...formData, certificate_fee: Number(e.target.value) })} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-black text-amber-600 focus:ring-0" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-10 border-t border-slate-50">
                                    <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="rounded-2xl h-14 px-8 font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-800 hover:bg-slate-50">
                                        Decline
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="rounded-2xl h-14 px-10 bg-brand-teal hover:bg-brand-dark text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-brand-teal/20 transition-all flex items-center gap-3">
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck size={18} /> Authorize Admission</>}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            {/* â”€â”€ Refund Modal â”€â”€ */}
            {
                showReturnModal && (() => {
                    const d = showReturnModal;
                    let deductions = 0;
                    // Only deduct if not paid upfront and not waived
                    if (d.bag_taken && !d.bag_paid && !d.bag_waived) deductions += (d.bag_fee || 0);
                    if (d.id_card_taken && !d.id_card_paid && !d.id_card_waived) deductions += (d.id_card_fee || 0);
                    if ((d as any).certificate_taken && !(d as any).certificate_paid && !(d as any).certificate_waived) deductions += ((d as any).certificate_fee || 0);

                    const refundAmount = Math.max(0, (d.deposit_amount || 0) - deductions);

                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowReturnModal(null)}></div>
                            <div className="relative bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                                <div className="p-10">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-rose-50 text-rose-500 flex items-center justify-center mb-8 mx-auto shadow-inner">
                                        <ArrowLeftRight size={32} />
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter text-center">Process Refund</h2>
                                    <p className="text-slate-700 font-medium text-center text-sm mb-10 text-balance">Reverting institutional deposit nodes for {d.student_name}.</p>

                                    <div className="space-y-4 mb-10 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 font-mono shadow-inner">
                                        <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                                            <span>Initial Deposit</span>
                                            <span className={cn("font-black", d.is_waived ? "text-emerald-500" : "text-slate-900")}>
                                                {d.is_waived ? "WAIVED" : `Rs. ${d.deposit_amount}`}
                                            </span>
                                        </div>
                                        {d.bag_taken && (
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                                <span className="text-slate-600">Institutional Gear</span>
                                                <span className={d.bag_waived || d.bag_paid ? "text-emerald-500" : "text-rose-500"}>
                                                    {d.bag_waived ? "Waived" : d.bag_paid ? "Paid Upfront" : `Pending -${d.bag_fee}`}
                                                </span>
                                            </div>
                                        )}
                                        {d.id_card_taken && (
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                                <span className="text-slate-600">Access Credential</span>
                                                <span className={d.id_card_waived || d.id_card_paid ? "text-emerald-500" : "text-rose-500"}>
                                                    {d.id_card_waived ? "Waived" : d.id_card_paid ? "Paid Upfront" : `Pending -${d.id_card_fee}`}
                                                </span>
                                            </div>
                                        )}
                                        {(d as any).certificate_taken && (
                                            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                                <span className="text-slate-600">Certificate</span>
                                                <span className={(d as any).certificate_waived || (d as any).certificate_paid ? "text-emerald-500" : "text-rose-500"}>
                                                    {(d as any).certificate_waived ? "Waived" : (d as any).certificate_paid ? "Paid Upfront" : `Pending -${(d as any).certificate_fee}`}
                                                </span>
                                            </div>
                                        )}
                                        <div className="w-full h-px bg-slate-200 my-4 shadow-sm"></div>
                                        <div className="flex justify-between text-blue-600 text-xl font-black tracking-tighter italic"><span>Refund Vector</span> <span>Rs. {refundAmount}</span></div>
                                    </div>

                                    <form onSubmit={handleProcessReturn} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Fiscal Remarks</label>
                                            <textarea
                                                value={returnRemarks}
                                                onChange={e => setReturnRemarks(e.target.value)}
                                                placeholder="e.g. Returned via cash node..."
                                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-inner outline-none min-h-[100px]"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3">
                                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RefreshCw size={18} /> Finalized Refund</>}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => setShowReturnModal(null)} className="w-full h-12 font-black text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-800 rounded-2xl hover:bg-slate-50">
                                                Stay Entry
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

        </div>
    );
}

