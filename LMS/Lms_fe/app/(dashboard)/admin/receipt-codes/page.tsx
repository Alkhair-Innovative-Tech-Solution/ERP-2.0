'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    RefreshCw,
    SearchIcon,
    Archive as ArchiveIcon,
    Trash2,
    CreditCard,
    Smartphone,
    Clock,
    FileSpreadsheet
} from 'lucide-react';
import { receiptAPI, admissionAPI, courseAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DepositStatsRow } from '@/components/features/deposits/DepositStatsRow';
import { TransactionRegistryTable } from '@/components/features/deposits/TransactionRegistryTable';
import { ApplicantSignalsTable } from '@/components/features/deposits/ApplicantSignalsTable';
import { ProcessAdmissionModal } from '@/components/features/deposits/ProcessAdmissionModal';
import { ProcessReturnModal } from '@/components/features/deposits/ProcessReturnModal';
import { TransferScholarModal } from '@/components/features/deposits/TransferScholarModal';

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
    is_returned?: boolean;
    amount_returned?: number;
    is_waived?: boolean;
    lead_info?: {
        id: string;
        name: string;
        email: string;
        status: string;
        test_score: number | null;
        converted_to_student: boolean;
        lms_user_id: string | null;
    } | null;
}

export interface EntranceLead {
    id: string;
    name: string;
    email: string;
    phone: string;
    course_id: string;
    course_name_requested?: string;
    test_score: number | null;
    status: string;
    created_at: string;
    has_paid_deposit?: boolean;
    bag_status?: string;
    id_card_status?: string;
    deposit_returned?: string;
}

export default function AdminReceiptCodesPage() {
    const [receipts, setReceipts] = useState<ReceiptCode[]>([]);
    const [leads, setLeads] = useState<EntranceLead[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'receipts' | 'leads'>('receipts');
    
    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState<ReceiptCode | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferringReceipt, setTransferringReceipt] = useState<ReceiptCode | null>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

    const [returnRemarks, setReturnRemarks] = useState('');

    const user = getStoredUser();
    const canTransfer = user?.role_permissions?.manage_transfers === true || user?.role === 'ADMIN';

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
        is_waived: false,
        remarks: '',
        receipt_number: ''
    });

    useEffect(() => {
        fetchAllData();
    }, [showArchived]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [codesData, leadsData, coursesData] = await Promise.all([
                receiptAPI.getAll(showArchived, 3, orgId).catch(() => []),
                admissionAPI.getLeads(false, undefined, 3, orgId).catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => ({results: []} as any))
            ]);
            setReceipts(Array.isArray(codesData) ? codesData : ((codesData as any)?.results || (codesData as any)?.data || []));
            setLeads(Array.isArray(leadsData) ? leadsData : ((leadsData as any)?.results || (leadsData as any)?.data || []));
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
                is_waived: formData.is_waived,
                remarks: formData.remarks,
                receipt_number: formData.receipt_number
            };

            if (isEditMode && editingReceiptId) {
                await receiptAPI.update(editingReceiptId, payload);
                toast.success('Registry updated successfully!');
            } else {
                await receiptAPI.create(payload);
                toast.success('Admission authorized successfully!');
            }
            setShowAddModal(false);
            setFormData({ 
                ...formData, code: '', student_email: '', student_name: '', course_id: '', test_score: '', receipt_number: '' 
            });
            fetchAllData();
        } catch (error: any) {
            console.error('Error authorizing admission:', error);
            toast.error(error?.response?.data?.detail || 'Error authorizing admission');
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
            toast.success('Settlement processed successfully!');
            setShowReturnModal(null);
            setReturnRemarks('');
            fetchAllData();
        } catch (error: any) {
            toast.error("Error processing settlement: " + (error?.response?.data?.detail || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const prefillFromLead = (lead: EntranceLead) => {
        const selectedCourse = courses.find((c: any) => c.id === lead.course_id);
        const isTestNotRequired = selectedCourse && selectedCourse.iq_required === false;

        setFormData({
            ...formData,
            code: '',
            student_email: lead.email,
            student_name: lead.name,
            course_id: lead.course_id || '',
            test_score: isTestNotRequired ? 'Not Required' : (lead.test_score === null ? '' : lead.test_score.toString())
        });
        setIsEditMode(false);
        setEditingReceiptId(null);
        setShowAddModal(true);
    };

    const handleOpenEdit = (receipt: ReceiptCode) => {
        setFormData({
            code: receipt.code,
            student_email: receipt.student_email,
            student_name: receipt.student_name,
            course_id: receipt.course_id || '',
            test_score: receipt.test_score?.toString() || 'Not Required',
            deposit_amount: receipt.deposit_amount || 0,
            bag_taken: receipt.bag_taken || false,
            bag_fee: receipt.bag_fee || 0,
            bag_paid: receipt.bag_paid ?? true,
            bag_waived: receipt.bag_waived || false,
            id_card_taken: receipt.id_card_taken || false,
            id_card_fee: receipt.id_card_fee || 0,
            id_card_paid: receipt.id_card_paid ?? true,
            id_card_waived: receipt.id_card_waived || false,
            is_waived: receipt.is_waived || false,
            remarks: '',
            receipt_number: receipt.receipt_number || ''
        });
        setEditingReceiptId(receipt.id);
        setIsEditMode(true);
        setShowAddModal(true);
    };

    const handleOpenTransfer = (receipt: ReceiptCode) => {
        setTransferringReceipt(receipt);
        setShowTransferModal(true);
    };

    const handleVerify = async (receipt: ReceiptCode) => {
        if (!confirm(`Verify fiscal registry for ${receipt.student_name}?`)) return;
        try {
            await receiptAPI.update(receipt.id, { verified: true });
            toast.success('Registry verified successfully');
            fetchAllData();
        } catch (error) {
            toast.error('Failed to verify registry');
        }
    };

    const handleDeleteDeposit = async (id: string) => {
        if (!confirm('Archive this admission record?')) return;
        try {
            await receiptAPI.delete(id);
            toast.success('Admission record archived');
            fetchAllData();
        } catch (error) {
            toast.error('Failed to archive record');
        }
    };

    const handleRestoreDeposit = async (id: string) => {
        try {
            await receiptAPI.restore(id);
            toast.success('Admission record restored');
            fetchAllData();
        } catch (error) {
            toast.error('Failed to restore record');
        }
    };

    const coursesMap = useMemo(() => {
        const map = new Map<string, string>();
        courses.forEach((c: any) => map.set(c.id, c.name));
        return map;
    }, [courses]);

    const getCourseName = (courseId: string | null, fallbackName?: string) => {
        if (fallbackName) return fallbackName;
        if (!courseId) return 'Not Assigned';
        return coursesMap.get(courseId) || 'Not Assigned';
    };

    const filteredReceipts = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return receipts;
        return receipts.filter(code =>
            code.code?.toLowerCase().includes(query) ||
            code.student_name?.toLowerCase().includes(query) ||
            code.student_email?.toLowerCase().includes(query)
        );
    }, [receipts, searchQuery]);

    const filteredLeads = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return leads;
        return leads.filter(lead =>
            lead.name?.toLowerCase().includes(query) ||
            lead.email?.toLowerCase().includes(query) ||
            lead.phone?.toLowerCase().includes(query) ||
            (lead.course_name_requested && lead.course_name_requested.toLowerCase().includes(query))
        );
    }, [leads, searchQuery]);

    if (loading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Validating Entry Registries...</p>
          </div>
        );
    }

    const currentSelectedCourse = courses.find((c: any) => c.id === formData.course_id);
    const isCurrentTestNotRequired = currentSelectedCourse && currentSelectedCourse.iq_required === false;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* â”€â”€ Header Section â”€â”€ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="w-7 h-7 text-brand-teal" />
                        Entry Management
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Authenticate scholar admissions and synchronize fiscal receipt signatures.</p>
                </div>
                <div className="flex gap-4">
                   <Button 
                        onClick={() => setShowArchived(!showArchived)} 
                        variant="outline" 
                        className={cn(
                            "rounded-2xl h-14 px-6 font-bold transition-all flex gap-2 border-slate-200",
                            showArchived ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {showArchived ? <ArchiveIcon className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        {showArchived ? "Viewing Archived" : "View Archived"}
                    </Button>
                   <Button onClick={fetchAllData} variant="ghost" className="rounded-2xl h-14 px-6 font-black text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
                       <RefreshCw className="w-5 h-5 mr-3" /> Sync Registry
                   </Button>
                   <Button
                       onClick={() => {
                           setFormData({...formData, code: '', student_email: '', student_name: '', course_id: '', test_score: 'Not Required'});
                           setIsEditMode(false);
                           setShowAddModal(true);
                       }}
                       className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group"
                   >
                       <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                       Authorize Admission
                   </Button>
                </div>
            </div>

            {/* â”€â”€ Intelligence Row â”€â”€ */}
            <DepositStatsRow 
                totalReceipts={receipts.length}
                awaitingRefunds={receipts.filter(c => !c.is_returned).length}
                qualifiedLeads={leads.filter(l => l.status === 'passed').length}
            />

            {/* â”€â”€ Control Console â”€â”€ */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-full md:w-fit">
                        <button
                            onClick={() => setActiveTab('receipts')}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                activeTab === 'receipts' ? "bg-white text-brand-teal shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Admission Signatures
                        </button>
                        <button
                            onClick={() => setActiveTab('leads')}
                            className={cn(
                                "flex-1 md:flex-none px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all relative flex items-center justify-center gap-2",
                                activeTab === 'leads' ? "bg-white text-brand-teal shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Entrance Signals
                            {leads.filter(l => l.status === 'passed').length > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal text-[10px] text-white">
                                    {leads.filter(l => l.status === 'passed').length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative flex-1 max-w-md w-full group">
                        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                        <input
                            type="text"
                            placeholder={activeTab === 'receipts' ? "Query admission ID or scholar identity..." : "Search applicant signals..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all font-sans"
                        />
                    </div>
                </div>

                {/* â”€â”€ Main Data Matrix â”€â”€ */}
                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    {activeTab === 'receipts' ? (
                        <TransactionRegistryTable
                            filteredReceipts={filteredReceipts}
                            showArchived={showArchived}
                            getCourseName={getCourseName}
                            handleOpenEdit={handleOpenEdit}
                            handleRestoreDeposit={handleRestoreDeposit}
                            handleDeleteDeposit={handleDeleteDeposit}
                            setShowReturnModal={setShowReturnModal}
                            onTransfer={canTransfer ? handleOpenTransfer : undefined}
                            onVerify={handleVerify}
                        />
                    ) : (
                        <ApplicantSignalsTable
                            filteredLeads={filteredLeads}
                            getCourseName={getCourseName}
                            prefillFromLead={prefillFromLead}
                        />
                    )}
                </div>
            </div>

            {/* â”€â”€ Admissions Provisioning Terminal â”€â”€ */}
            <ProcessAdmissionModal 
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                handleAddReceipt={handleAddReceipt}
                formData={formData}
                setFormData={setFormData}
                courses={courses}
                isSubmitting={isSubmitting}
                isEditMode={isEditMode}
                isCurrentTestNotRequired={isCurrentTestNotRequired}
            />

            {/* â”€â”€ Settlement Protocol Terminal â”€â”€ */}
            <ProcessReturnModal 
                showReturnModal={showReturnModal}
                setShowReturnModal={setShowReturnModal}
                handleProcessReturn={handleProcessReturn}
                returnRemarks={returnRemarks}
                setReturnRemarks={setReturnRemarks}
                isSubmitting={isSubmitting}
            />

            {/* â”€â”€ Curricular Migration Terminal â”€â”€ */}
            {canTransfer && (
                <TransferScholarModal 
                    show={showTransferModal}
                    onClose={() => setShowTransferModal(false)}
                    receipt={transferringReceipt}
                    courses={courses}
                    onSuccess={fetchAllData}
                />
            )}

        </div>
    );
}
