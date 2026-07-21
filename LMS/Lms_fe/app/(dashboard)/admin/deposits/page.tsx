'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Plus,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    Users,
    Mail,
    Loader2,
    X,
    Banknote,
    RefreshCw,
    Activity,
    CreditCard,
    ShieldCheck,
    SearchIcon,
    Calendar,
    ChevronDown,
    Check,
    ArrowLeftRight,
    Trash2,
    Edit
} from 'lucide-react';
import { receiptAPI, courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DepositStatsRow } from '@/components/features/deposits/DepositStatsRow';
import { TransactionRegistryTable } from '@/components/features/deposits/TransactionRegistryTable';
import { ProcessReturnModal } from '@/components/features/deposits/ProcessReturnModal';
import { ReportSummaryCards } from '@/components/features/deposits/ReportSummaryCards';
import { CourseBreakdownTable } from '@/components/features/deposits/CourseBreakdownTable';

export interface ReceiptCode {
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

export default function AdminUnifiedDepositsPage() {
    const [receipts, setReceipts] = useState<ReceiptCode[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState<ReceiptCode | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

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
    }, [showArchived]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [codesData, coursesData] = await Promise.all([
                receiptAPI.getAll(showArchived, 3, orgId).catch(() => []),
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

            const payload = {
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
            };

            if (isEditMode && editingReceiptId) {
                await receiptAPI.update(editingReceiptId, payload);
                toast.success('Deposit updated successfully!');
            } else {
                await receiptAPI.create(payload);
                toast.success('Deposit & Receipt Added successfully!');
            }
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

    const handleOpenEdit = useCallback((receipt: ReceiptCode) => {
        setFormData({
            code: receipt.code,
            student_email: receipt.student_email,
            student_name: receipt.student_name,
            course_id: receipt.course_id || '',
            test_score: receipt.test_score?.toString() || 'Not Required',
            deposit_amount: receipt.deposit_amount || 0,
            bag_taken: receipt.bag_taken ?? true,
            bag_fee: receipt.bag_fee ?? 800,
            bag_paid: receipt.bag_paid ?? true,
            bag_waived: receipt.bag_waived || false,
            id_card_taken: receipt.id_card_taken ?? true,
            id_card_fee: receipt.id_card_fee ?? 200,
            id_card_paid: receipt.id_card_paid ?? true,
            id_card_waived: receipt.id_card_waived || false,
            certificate_taken: (receipt as any).certificate_taken ?? true,
            certificate_fee: (receipt as any).certificate_fee ?? 200,
            certificate_paid: (receipt as any).certificate_paid ?? true,
            certificate_waived: (receipt as any).certificate_waived || false,
            is_waived: receipt.is_waived || false,
            remarks: ''
        });
        setEditingReceiptId(receipt.id);
        setIsEditMode(true);
        setShowAddModal(true);
    }, []);

    const handleDeleteDeposit = useCallback(async (id: string) => {
        if (!confirm('Archive this deposit record?')) return;
        try {
            await receiptAPI.delete(id);
            toast.success('Deposit archived');
            fetchAllData();
        } catch (error) {
            toast.error('Failed to archive deposit');
        }
    }, [fetchAllData]);

    const handleRestoreDeposit = useCallback(async (id: string) => {
        try {
            await receiptAPI.restore(id);
            toast.success('Deposit restored');
            fetchAllData();
        } catch (error) {
            toast.error('Failed to restore deposit');
        }
    }, [fetchAllData]);

    const getCourseName = useCallback((courseId: string | null) => {
        if (!courseId) return 'Unknown Course';
        const course = courses.find(c => c.id === courseId);
        return course ? course.name : 'Unknown Course';
    }, [courses]);

    const filteredReceipts = useMemo(() => receipts.filter(code =>
        code.code?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        code.student_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        code.student_email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    ), [receipts, debouncedSearchQuery]);

    const exportCSV = useCallback(() => {
        const headers = ['Receipt Code', 'Student Name', 'Student Email', 'Course', 'Deposit Amount', 'Bag Fee', 'ID Card Fee', 'Certificate Fee', 'Is Returned', 'Amount Returned', 'Is Waived'];
        const rows = filteredReceipts.map(r => [
            r.code,
            r.student_name,
            r.student_email,
            getCourseName(r.course_id),
            r.deposit_amount || 0,
            r.bag_fee || 0,
            r.id_card_fee || 0,
            (r as any).certificate_fee || 0,
            r.is_returned ? 'Yes' : 'No',
            r.amount_returned || 0,
            r.is_waived ? 'Yes' : 'No',
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `deposit-register-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
    }, [filteredReceipts, getCourseName]);

    const financialStats = useMemo(() => {
        const totalCollection = receipts.reduce((s, r) => s + (r.deposit_amount || 0), 0);
        const totalRefunded = receipts.reduce((s, r) => s + (r.amount_returned || 0), 0);
        const activeDeposits = receipts.filter(r => !r.is_returned).length;
        const totalReturned = receipts.filter(r => r.is_returned).length;
        const waivedDeposits = receipts.filter(r => r.is_waived).length;
        return {
            totalCollection,
            totalRefunded,
            netRevenue: totalCollection - totalRefunded,
            activeDeposits,
            totalReturned,
            waivedDeposits,
        };
    }, [receipts]);

    const courseBreakdown = useMemo(() => {
        const map = new Map<string, { courseName: string; studentCount: number; totalCollected: number; totalRefunded: number; activeCount: number; returnedCount: number }>();
        const unknownCourse = { courseName: 'Unknown Course', studentCount: 0, totalCollected: 0, totalRefunded: 0, activeCount: 0, returnedCount: 0 };
        map.set('__unknown__', { ...unknownCourse });

        for (const r of receipts) {
            const courseId = r.course_id || '__unknown__';
            if (!map.has(courseId)) {
                const course = courses.find(c => c.id === courseId);
                map.set(courseId, {
                    courseName: course ? course.name : 'Unknown Course',
                    studentCount: 0, totalCollected: 0, totalRefunded: 0, activeCount: 0, returnedCount: 0,
                });
            }
            const entry = map.get(courseId)!;
            entry.studentCount++;
            entry.totalCollected += r.deposit_amount || 0;
            entry.totalRefunded += r.amount_returned || 0;
            if (r.is_returned) entry.returnedCount++;
            else entry.activeCount++;
        }

        const result = Array.from(map.entries())
            .filter(([key]) => key !== '__unknown__' || map.get('__unknown__')!.studentCount > 0)
            .map(([courseId, data]) => ({ courseId, ...data }));

        const unknownEntry = map.get('__unknown__');
        if (unknownEntry && unknownEntry.studentCount > 0) {
            result.push({ courseId: 'unknown', ...unknownEntry });
        }
        return result.sort((a, b) => b.totalCollected - a.totalCollected);
    }, [receipts, courses]);

    const stats = useMemo(() => ({
        totalReceipts: receipts.length,
        awaitingRefunds: receipts.filter(c => !c.is_returned).length
    }), [receipts]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Accessing Financial Vault...</p>
            </div>
        );
    }

    const currentSelectedCourse = courses.find((c: any) => c.id === formData.course_id);
    const isCurrentTestNotRequired = currentSelectedCourse && currentSelectedCourse.iq_required === false;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Treasury</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Banknote className="w-7 h-7 text-brand-teal" />
                        Admissions & Deposits
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setShowArchived(!showArchived)}
                        variant="outline"
                        className={cn(
                            "rounded-lg h-10 px-4 font-bold transition-all flex gap-2 border-slate-200 text-[10px]",
                            showArchived ? "bg-rose-50 border-rose-200 text-rose-600" : "text-slate-600"
                        )}
                    >
                        {showArchived ? "Archived" : "View Archive"}
                    </Button>
                    <Button onClick={exportCSV} variant="ghost" className="rounded-lg h-10 px-4 font-black text-slate-600 hover:text-emerald-600 text-[10px]">
                        Export CSV
                    </Button>
                    <Button onClick={fetchAllData} variant="ghost" className="rounded-lg h-10 px-4 font-black text-slate-600 hover:text-brand-teal text-[10px]">
                        Sync
                    </Button>
                    <Button
                        onClick={() => {
                            setFormData({ ...formData, code: '', student_email: '', student_name: '', course_id: '', test_score: 'Not Required' });
                            setIsEditMode(false);
                            setShowAddModal(true);
                        }}
                        className="bg-brand-teal hover:bg-brand-dark text-white rounded-lg h-10 px-5 font-black shadow-md flex gap-2 uppercase text-[9px] tracking-widest"
                    >
                        Process Admission
                    </Button>
                </div>
            </div>

            {/* ── Intelligence Row ── */}
            <div className="px-4">
                <DepositStatsRow
                    totalReceipts={stats.totalReceipts}
                    awaitingRefunds={stats.awaitingRefunds}
                    totalCollection={financialStats.totalCollection}
                    totalRefunded={financialStats.totalRefunded}
                    netRevenue={financialStats.netRevenue}
                    activeDeposits={financialStats.activeDeposits}
                    totalReturned={financialStats.totalReturned}
                    waivedDeposits={financialStats.waivedDeposits}
                />
            </div>

            {/* ── Financial Summary Cards ── */}
            <div className="px-4">
                <ReportSummaryCards
                    totalCollection={financialStats.totalCollection}
                    totalRefunded={financialStats.totalRefunded}
                    netRevenue={financialStats.netRevenue}
                    activeDeposits={financialStats.activeDeposits}
                    totalReturned={financialStats.totalReturned}
                />
            </div>

            {/* ── Course-wise Breakdown ── */}
            <div className="px-4">
                <CourseBreakdownTable breakdown={courseBreakdown} />
            </div>

            {/* ── Control Console ── */}
            <div className="space-y-4 px-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 max-w-xs w-full group">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 group-focus-within:text-brand-teal" />
                        <input
                            type="text"
                            placeholder="Query data..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/5 transition-all"
                        />
                    </div>
                </div>

                {/* ── Main Data Matrix ── */}
                <div className="premium-card overflow-x-auto border-none shadow-premium bg-white scrollbar-thin scrollbar-thumb-slate-200">
                    <TransactionRegistryTable
                        filteredReceipts={filteredReceipts}
                        showArchived={showArchived}
                        getCourseName={getCourseName}
                        handleOpenEdit={handleOpenEdit}
                        handleRestoreDeposit={handleRestoreDeposit}
                        handleDeleteDeposit={handleDeleteDeposit}
                        setShowReturnModal={setShowReturnModal}
                    />
                </div>
            </div>

            {/* ── Admissions Provisioning Terminal ── */}
            {showAddModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowAddModal(false)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-3xl p-0 animate-in zoom-in-95 duration-500 border border-white group/modal overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header Stripe */}
                        <div className="h-2 bg-gradient-to-r from-brand-teal via-blue-500 to-brand-teal animate-shimmer bg-[length:200%_100%]" />

                        <div className="p-10 md:p-12 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="flex items-start justify-between mb-12">
                                <div>
                                    <p className="text-brand-teal font-black tracking-[0.2em] text-[11px] uppercase mb-1">Admissions Architect</p>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Authorize Admission</h2>
                                    <p className="text-slate-700 font-medium text-sm mt-1">Configure institutional registration codes and financial commitments.</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="w-14 h-14 flex items-center justify-center rounded-[24px] bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all hover:rotate-90">
                                    <X size={28} />
                                </button>
                            </div>

                            <form onSubmit={handleAddReceipt} className="grid grid-cols-1 md:grid-cols-2 gap-10">

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 mb-4 flex items-center gap-2">
                                            <Users size={12} /> Candidate Profile Protocols
                                        </p>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Unique Receipt Identification</label>
                                                <input required type="text" placeholder="e.g. RCP-26-001" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all font-mono uppercase"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Scholar Full Name</label>
                                                <input required type="text" placeholder="Institutional Name" value={formData.student_name} onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-tight"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Communication Channel (Email)</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                    <input required type="email" placeholder="scholar@domain.edu" value={formData.student_email} onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 mb-4 flex items-center gap-2">
                                            <CreditCard size={12} /> Curricular & Fiscal Configuration
                                        </p>

                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Course Assignment</label>
                                                    <div className="relative">
                                                        <select required value={formData.course_id} onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                                            className="w-full pl-6 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer uppercase tracking-tight"
                                                        >
                                                            <option value="" disabled>Query Registry...</option>
                                                            {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                                                        </select>
                                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Compliance Score</label>
                                                    <input required={!isCurrentTestNotRequired} disabled={isCurrentTestNotRequired} type="text" placeholder={isCurrentTestNotRequired ? "EXEMPT" : "VAL_INDEX (%)"} value={isCurrentTestNotRequired ? 'EXEMPTED' : formData.test_score} onChange={(e) => setFormData({ ...formData, test_score: e.target.value })}
                                                        className={cn(
                                                            "w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all uppercase tracking-widest",
                                                            isCurrentTestNotRequired ? "text-slate-300 italic bg-slate-100" : "text-slate-900"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Primary Security Deposit (PKR)</label>
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <div className={cn("w-4 h-4 rounded border transition-all flex items-center justify-center", formData.is_waived ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
                                                            {formData.is_waived && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.is_waived} onChange={e => setFormData({ ...formData, is_waived: e.target.checked, deposit_amount: e.target.checked ? 0 : 3000 })} />
                                                        <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-emerald-600">Apply Financial Aid Waiver</span>
                                                    </label>
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">PKR</div>
                                                    <input type="number" required disabled={formData.is_waived} value={formData.deposit_amount} onChange={e => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                                                        className={cn(
                                                            "w-full pl-14 pr-6 py-4 bg-white border-2 rounded-2xl text-xl font-black transition-all font-sans",
                                                            formData.is_waived ? "border-emerald-100 bg-emerald-50/30 text-emerald-600" : "border-slate-100 text-slate-900 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500"
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Supplementary Inventory & IDs</p>

                                                <div className="grid grid-cols-1 gap-3">
                                                    {/* Institutional Gear Card */}
                                                    <div className={cn(
                                                        "p-5 rounded-[24px] border-2 transition-all duration-500",
                                                        formData.bag_taken ? "bg-white border-blue-100 shadow-xl shadow-blue-500/5" : "bg-slate-50/50 border-slate-100 opacity-60"
                                                    )}>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                                <div className={cn(
                                                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                                    formData.bag_taken ? "bg-blue-500 border-blue-500" : "bg-white border-slate-200"
                                                                )}>
                                                                    {formData.bag_taken && <Check size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={formData.bag_taken} onChange={e => setFormData({ ...formData, bag_taken: e.target.checked })} />
                                                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Institutional Gear</span>
                                                            </label>

                                                            {formData.bag_taken && (
                                                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                                    {[
                                                                        { id: 'pending', label: 'Pending', active: !formData.bag_paid && !formData.bag_waived, color: 'text-rose-600' },
                                                                        { id: 'paid', label: 'Paid', active: formData.bag_paid && !formData.bag_waived, color: 'text-blue-600' },
                                                                        { id: 'waived', label: 'Waived', active: formData.bag_waived, color: 'text-emerald-600' }
                                                                    ].map((opt) => (
                                                                        <button
                                                                            key={opt.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (opt.id === 'waived') setFormData({ ...formData, bag_waived: true, bag_paid: false });
                                                                                else if (opt.id === 'paid') setFormData({ ...formData, bag_waived: false, bag_paid: true });
                                                                                else setFormData({ ...formData, bag_waived: false, bag_paid: false });
                                                                            }}
                                                                            className={cn(
                                                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                                                opt.active ? "bg-white shadow-sm " + opt.color : "text-slate-600 hover:text-slate-800"
                                                                            )}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {formData.bag_taken && !formData.bag_waived && (
                                                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex-1">
                                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Item Cost (PKR)</p>
                                                                    <input
                                                                        type="number"
                                                                        value={formData.bag_fee}
                                                                        onChange={e => setFormData({ ...formData, bag_fee: Number(e.target.value) })}
                                                                        className="w-full bg-transparent text-lg font-black text-blue-600 outline-none"
                                                                    />
                                                                </div>
                                                                <div className="px-4 py-2 bg-blue-50 rounded-xl">
                                                                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Status</p>
                                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{formData.bag_paid ? "Recieved" : "To Deduct"}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {formData.bag_taken && formData.bag_waived && (
                                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Institutional Contribution Applied (Waived)</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* LMS Identifier Card */}
                                                    <div className={cn(
                                                        "p-5 rounded-[24px] border-2 transition-all duration-500",
                                                        formData.id_card_taken ? "bg-white border-brand-teal/10 shadow-xl shadow-brand-teal/5" : "bg-slate-50/50 border-slate-100 opacity-60"
                                                    )}>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                                <div className={cn(
                                                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                                    formData.id_card_taken ? "bg-brand-teal border-brand-teal" : "bg-white border-slate-200"
                                                                )}>
                                                                    {formData.id_card_taken && <Check size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={formData.id_card_taken} onChange={e => setFormData({ ...formData, id_card_taken: e.target.checked })} />
                                                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">LMS Identifier</span>
                                                            </label>

                                                            {formData.id_card_taken && (
                                                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                                    {[
                                                                        { id: 'pending', label: 'Pending', active: !formData.id_card_paid && !formData.id_card_waived, color: 'text-rose-600' },
                                                                        { id: 'paid', label: 'Paid', active: formData.id_card_paid && !formData.id_card_waived, color: 'text-brand-teal' },
                                                                        { id: 'waived', label: 'Waived', active: formData.id_card_waived, color: 'text-emerald-600' }
                                                                    ].map((opt) => (
                                                                        <button
                                                                            key={opt.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (opt.id === 'waived') setFormData({ ...formData, id_card_waived: true, id_card_paid: false });
                                                                                else if (opt.id === 'paid') setFormData({ ...formData, id_card_waived: false, id_card_paid: true });
                                                                                else setFormData({ ...formData, id_card_waived: false, id_card_paid: false });
                                                                            }}
                                                                            className={cn(
                                                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                                                opt.active ? "bg-white shadow-sm " + opt.color : "text-slate-600 hover:text-slate-800"
                                                                            )}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {formData.id_card_taken && !formData.id_card_waived && (
                                                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex-1">
                                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">ID Card Fee (PKR)</p>
                                                                    <input
                                                                        type="number"
                                                                        value={formData.id_card_fee}
                                                                        onChange={e => setFormData({ ...formData, id_card_fee: Number(e.target.value) })}
                                                                        className="w-full bg-transparent text-lg font-black text-brand-teal outline-none"
                                                                    />
                                                                </div>
                                                                <div className="px-4 py-2 bg-brand-teal/10 rounded-xl">
                                                                    <p className="text-[8px] font-black text-brand-teal uppercase tracking-tighter">Status</p>
                                                                    <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest">{formData.id_card_paid ? "Recieved" : "To Deduct"}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {formData.id_card_taken && formData.id_card_waived && (
                                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Institutional Contribution Applied (Waived)</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Certificate Fee Card */}
                                                    <div className={cn(
                                                        "p-5 rounded-[24px] border-2 transition-all duration-500",
                                                        formData.certificate_taken ? "bg-white border-amber-100 shadow-xl shadow-amber-500/5" : "bg-slate-50/50 border-slate-100 opacity-60"
                                                    )}>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                                <div className={cn(
                                                                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                                    formData.certificate_taken ? "bg-amber-500 border-amber-500" : "bg-white border-slate-200"
                                                                )}>
                                                                    {formData.certificate_taken && <Check size={14} className="text-white" />}
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={formData.certificate_taken} onChange={e => setFormData({ ...formData, certificate_taken: e.target.checked })} />
                                                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Certificate</span>
                                                            </label>

                                                            {formData.certificate_taken && (
                                                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                                    {[
                                                                        { id: 'pending', label: 'Pending', active: !formData.certificate_paid && !formData.certificate_waived, color: 'text-rose-600' },
                                                                        { id: 'paid', label: 'Paid', active: formData.certificate_paid && !formData.certificate_waived, color: 'text-amber-600' },
                                                                        { id: 'waived', label: 'Waived', active: formData.certificate_waived, color: 'text-emerald-600' }
                                                                    ].map((opt) => (
                                                                        <button
                                                                            key={opt.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (opt.id === 'waived') setFormData({ ...formData, certificate_waived: true, certificate_paid: false });
                                                                                else if (opt.id === 'paid') setFormData({ ...formData, certificate_waived: false, certificate_paid: true });
                                                                                else setFormData({ ...formData, certificate_waived: false, certificate_paid: false });
                                                                            }}
                                                                            className={cn(
                                                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                                                opt.active ? "bg-white shadow-sm " + opt.color : "text-slate-600 hover:text-slate-800"
                                                                            )}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {formData.certificate_taken && !formData.certificate_waived && (
                                                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex-1">
                                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Certificate Fee (PKR)</p>
                                                                    <input
                                                                        type="number"
                                                                        value={formData.certificate_fee}
                                                                        onChange={e => setFormData({ ...formData, certificate_fee: Number(e.target.value) })}
                                                                        className="w-full bg-transparent text-lg font-black text-amber-600 outline-none"
                                                                    />
                                                                </div>
                                                                <div className="px-4 py-2 bg-amber-50 rounded-xl">
                                                                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-tighter">Status</p>
                                                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{formData.certificate_paid ? "Recieved" : "To Deduct"}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {formData.certificate_taken && formData.certificate_waived && (
                                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Institutional Contribution Applied (Waived)</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 flex justify-end gap-4 pt-10 border-t border-slate-100">
                                    <Button type="button" onClick={() => setShowAddModal(false)} className="h-16 px-10 rounded-[28px] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest transition-all">
                                        Void Protocol
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="h-16 px-12 rounded-[28px] bg-brand-teal hover:bg-brand-dark text-white font-black shadow-2xl shadow-brand-teal/20 uppercase text-[11px] tracking-[0.2em] flex items-center gap-3 min-w-[240px] disabled:opacity-50">
                                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ShieldCheck size={24} />}
                                        {isSubmitting ? 'SECURE_SYNERGY...' : 'Authorize Admission'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Settlement Protocol Terminal (Refund) ── */}
            {showReturnModal && (() => {
                const d = showReturnModal;
                let deductions = 0;
                // Only deduct if the student hasn't already paid for the item upfront and it wasn't waived
                if (d.bag_taken && !d.bag_paid && !d.bag_waived) deductions += (d.bag_fee || 0);
                if (d.id_card_taken && !d.id_card_paid && !d.id_card_waived) deductions += (d.id_card_fee || 0);
                if ((d as any).certificate_taken && !(d as any).certificate_paid && !(d as any).certificate_waived) deductions += ((d as any).certificate_fee || 0);

                const refundAmount = Math.max(0, (d.deposit_amount || 0) - deductions);

                return (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowReturnModal(null)}></div>
                        <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
                            <div className="absolute inset-x-0 top-0 h-2 bg-brand-teal opacity-40" />

                            <div className="p-10 md:p-12">
                                <div className="flex items-start justify-between mb-10">
                                    <div>
                                        <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Settlement Controller</p>
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                                            Process Refund
                                        </h2>
                                        <p className="text-slate-700 font-medium text-sm mt-1">Institutional deposit liquidation for {d.student_name}.</p>
                                    </div>
                                    <button onClick={() => setShowReturnModal(null)} className="p-3 hover:bg-slate-50 text-slate-300 hover:text-slate-600 rounded-2xl transition-all">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="space-y-4 mb-10 bg-slate-900 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-teal/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

                                    <div className="flex justify-between items-center text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800 pb-4">
                                        <span>Primary Vault Deposit</span>
                                        <span className={cn("text-base", d.is_waived ? "text-emerald-400" : "text-white")}>
                                            {d.is_waived ? "WAIVED / AID" : `PKR ${d.deposit_amount?.toLocaleString()}`}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {d.bag_taken && (
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-widest">Institutional Gear</span>
                                                <span className={d.bag_waived || d.bag_paid ? "text-emerald-400" : "text-rose-400"}>
                                                    {d.bag_waived ? "Waived" : d.bag_paid ? "Paid Upfront" : `Pending -${d.bag_fee}`}
                                                </span>
                                            </div>
                                        )}
                                        {d.id_card_taken && (
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-widest">LMS Identification</span>
                                                <span className={d.id_card_waived || d.id_card_paid ? "text-emerald-400" : "text-rose-400"}>
                                                    {d.id_card_waived ? "Waived" : d.id_card_paid ? "Paid Upfront" : `Pending -${d.id_card_fee}`}
                                                </span>
                                            </div>
                                        )}
                                        {(d as any).certificate_taken && (
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-widest">Certificate</span>
                                                <span className={(d as any).certificate_waived || (d as any).certificate_paid ? "text-emerald-400" : "text-rose-400"}>
                                                    {(d as any).certificate_waived ? "Waived" : (d as any).certificate_paid ? "Paid Upfront" : `Pending -${(d as any).certificate_fee}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-800 mt-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-black text-brand-teal uppercase tracking-widest">Final Refund Vector</span>
                                            <span className="text-2xl font-black text-white tracking-tighter italic">PKR {refundAmount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 py-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Adjustments Applied</span>
                                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">- PKR {deductions.toLocaleString()}</span>
                                    </div>
                                    {d.bag_taken && !d.bag_waived && !d.bag_paid && (
                                        <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Gear Recovery (Bag)</span>
                                            <span className="text-[10px] font-black text-rose-500">-Rs.{d.bag_fee}</span>
                                        </div>
                                    )}
                                    {d.id_card_taken && !d.id_card_waived && !d.id_card_paid && (
                                        <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">LMS Identification (ID)</span>
                                            <span className="text-[10px] font-black text-rose-500">-Rs.{d.id_card_fee}</span>
                                        </div>
                                    )}
                                    {(d as any).certificate_taken && !(d as any).certificate_waived && !(d as any).certificate_paid && (
                                        <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Certificate Fee</span>
                                            <span className="text-[10px] font-black text-rose-500">-Rs.{(d as any).certificate_fee}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-slate-800 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-brand-teal uppercase tracking-[0.2em] mb-1">Settlement Liquid</p>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Final Auditor Compliant</p>
                                    </div>
                                    <span className="text-3xl font-black text-white tracking-tighter leading-none">PKR {refundAmount.toLocaleString()}</span>
                                </div>
                            </div>

                            <form onSubmit={handleProcessReturn} className="space-y-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Auditor Remarks / Settlement Notes</label>
                                    <textarea
                                        value={returnRemarks}
                                        onChange={e => setReturnRemarks(e.target.value)}
                                        placeholder="e.g., Electronic Settlement via Digital Vault #402..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all resize-none font-mono"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <Button type="button" onClick={() => setShowReturnModal(null)} className="flex-1 rounded-[24px] h-16 font-black text-slate-600 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest border-none transition-all">
                                        Decline
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}
                                        className="flex-[1.5] bg-brand-teal hover:bg-brand-dark text-white rounded-[24px] h-16 font-black shadow-2xl shadow-brand-teal/20 uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50 transition-all font-black"
                                    >
                                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ArrowLeftRight size={24} />}
                                        {isSubmitting ? 'SYNERGY...' : 'Finalize Settlement'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
            );
        })()}

        </div>
    );
}
