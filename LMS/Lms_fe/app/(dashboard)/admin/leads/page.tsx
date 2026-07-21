'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    RefreshCw,
    SearchIcon,
    Users,
    Activity,
    Target,
    Filter,
    ArrowRight,
    CreditCard,
    GraduationCap,
    ShieldCheck,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { admissionAPI, courseAPI, branchAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ApplicantSignalsTable } from '@/components/features/deposits/ApplicantSignalsTable';
import { EditLeadModal } from '@/components/features/deposits/EditLeadModal';
import { useRouter } from 'next/navigation';

export interface EntranceLead {
    id: string;
    lead_auto_id?: number;
    name: string;
    email: string;
    phone: string;
    course_id: string;
    course_name_requested?: string;
    test_score: number | null;
    status: string;
    created_at: string;
    cnic_number?: string;
    date_of_birth?: string;
    gender?: string;
    whatsapp_number?: string;
    father_guardian_name?: string;
    guardian_contact?: string;
    relationship_to_student?: string;
    study_work_status?: string;
    study_work_details?: string;
    last_qualification?: string;
    full_address?: string;
    signature?: string;
    studied_at_idara?: boolean;
    studying_at_idara?: boolean;
    is_terms_agreed?: boolean;
    age?: number;
    has_paid_deposit?: boolean;
    converted_to_student?: boolean;
    lms_user_id?: string;
    has_lms_account?: boolean;
    bag_status?: string;
    id_card_status?: string;
    deposit_returned?: string;
}

export default function AdminLeadsPage() {
    const [leads, setLeads] = useState<EntranceLead[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingLead, setEditingLead] = useState<EntranceLead | null>(null);
    const [pipelineStats, setPipelineStats] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterArchived, setFilterArchived] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterCourse, setFilterCourse] = useState<string>('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const router = useRouter();

    useEffect(() => {
        branchAPI.getAll(true).then((data: any) => {
            const list = Array.isArray(data) ? data : data?.results || data?.data || [];
            setBranches(list);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [filterArchived, selectedBranchId]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const branchParam = selectedBranchId || undefined;
            const [leadsData, coursesData, statsData] = await Promise.all([
                admissionAPI.getLeads(filterArchived, branchParam, 3, orgId).catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => ({results: []} as any)),
                admissionAPI.getLeadStats(branchParam, orgId).catch(() => null)
            ]);
            setLeads(Array.isArray(leadsData) ? leadsData : ((leadsData as any)?.results || (leadsData as any)?.data || []));
            setCourses(Array.isArray(coursesData) ? coursesData : ((coursesData as any)?.results || (coursesData as any)?.data || []));
            if (statsData?.pipeline) setPipelineStats(statsData.pipeline);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load applicant signals');
        } finally {
            setLoading(false);
        }
    };

    const coursesMap = useMemo(() => {
        const map = new Map<string, string>();
        courses.forEach((c: any) => map.set(c.id, c.name));
        return map;
    }, [courses]);

    const getCourseName = (courseId: string | null) => {
        if (!courseId) return 'Unknown Course';
        return coursesMap.get(courseId) || 'Unknown Course';
    };

    const filteredLeads = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return leads.filter(lead => {
            if (query && !(
                lead.name?.toLowerCase().includes(query) ||
                lead.email?.toLowerCase().includes(query) ||
                lead.phone?.toLowerCase().includes(query) ||
                (lead.course_name_requested && lead.course_name_requested.toLowerCase().includes(query))
            )) return false;
            if (filterStatus && lead.status !== filterStatus) return false;
            if (filterCourse && lead.course_id !== filterCourse) return false;
            return true;
        });
    }, [leads, searchQuery, filterStatus, filterCourse]);

    const prefillFromLead = (lead: EntranceLead) => {
        router.push(`/admin/receipt-codes?lead_id=${lead.id}&email=${lead.email}&name=${encodeURIComponent(lead.name)}&course_id=${lead.course_id}`);
    };

    const handleEditLead = (lead: EntranceLead) => {
        setEditingLead(lead);
    };

    if (loading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning Signal Frequencies...</p>
          </div>
        );
    }

    const pipeline = pipelineStats || {
        total_leads: leads.length,
        passed_test: leads.filter(l => l.status === 'passed' || l.status === 'enrolled').length,
        deposit_paid: leads.filter(l => l.has_paid_deposit).length,
        converted_to_student: leads.filter(l => l.converted_to_student).length,
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Signal Intelligence</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Target className="w-7 h-7 text-brand-teal" />
                        Entrance Leads
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Monitor and evaluate student applicant signals before admission authorization.</p>
                </div>
                <div className="flex gap-4">
                    <Button 
                         onClick={() => setFilterArchived(!filterArchived)} 
                         variant="outline" 
                         className={cn(
                             "rounded-2xl h-14 px-6 font-bold transition-all flex gap-2 border-slate-200",
                             filterArchived ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "text-slate-600 hover:bg-slate-50"
                         )}
                     >
                         {filterArchived ? "Viewing Archived" : "View Archived"}
                     </Button>
                   <Button onClick={fetchAllData} variant="ghost" className="rounded-2xl h-14 px-6 font-black text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
                       <RefreshCw className="w-5 h-5 mr-3" /> Refresh Signals
                   </Button>
                </div>
            </div>

            {/* ── Intelligence Row (Stats Cards) ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-6">
                {[
                    { label: 'Total Leads', val: pipeline.total_leads, icon: Users, color: 'blue' },
                    { label: 'Qualified', val: pipeline.passed_test, icon: Activity, color: 'emerald' },
                    { label: 'Deposit Paid', val: pipeline.deposit_paid, icon: CreditCard, color: 'amber' },
                    { label: 'Converted', val: pipeline.converted_to_student, icon: GraduationCap, color: 'indigo' },
                ].map((stat, i) => (
                    <div key={i} className="premium-card p-6 flex items-center gap-6 group hover:border-brand-teal/30 transition-all">
                        <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                            stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                            stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                            stat.color === 'amber' ? "bg-amber-50 text-amber-600" : "bg-brand-teal/10 text-brand-teal"
                        )}>
                            <stat.icon size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Pipeline Funnel ── */}
            {pipeline.total_leads > 0 && (
                <div className="premium-card p-6 px-6 border-slate-200/60">
                    <div className="flex items-center gap-2 mb-5">
                        <ShieldCheck size={16} className="text-brand-teal" />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Conversion Pipeline</p>
                    </div>
                    <div className="grid grid-cols-4 gap-3 items-end">
                        {[
                            { key: 'registered', label: 'Registered', count: pipeline.total_leads, max: pipeline.total_leads, color: 'bg-slate-400' },
                            { key: 'qualified', label: 'Test Passed', count: pipeline.passed_test, max: pipeline.total_leads, color: 'bg-emerald-500' },
                            { key: 'deposit', label: 'Deposit Paid', count: pipeline.deposit_paid, max: pipeline.total_leads, color: 'bg-amber-500' },
                            { key: 'converted', label: 'Enrolled', count: pipeline.converted_to_student, max: pipeline.total_leads, color: 'bg-brand-teal' },
                        ].map((stage) => {
                            const pct = stage.max > 0 ? Math.round((stage.count / stage.max) * 100) : 0;
                            return (
                                <div key={stage.key} className="flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <span className="text-lg font-black text-slate-900">{stage.count}</span>
                                        <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all duration-1000', stage.color)} style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">{stage.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Control Console ── */}
            <div className="space-y-6 px-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full md:w-fit">
                        <div className="relative flex-1 md:w-80 group">
                            <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                            <input
                                type="text"
                                placeholder="Search applicants..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all font-sans"
                            />
                        </div>
                        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="rounded-2xl h-12 px-6 font-bold text-slate-400 border-slate-100 flex gap-2">
                            <Filter className="w-4 h-4" /> Filter Node
                        </Button>
                    </div>
                    {showFilters && (
                        <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filterArchived}
                                    onChange={(e) => setFilterArchived(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                                />
                                <span className="text-xs font-bold text-slate-600">Show Archived</span>
                            </label>
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                            >
                                <option value="">All Branches</option>
                                {branches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="passed">Passed</option>
                                <option value="failed">Failed</option>
                                <option value="enrolled">Enrolled</option>
                            </select>
                            <select
                                value={filterCourse}
                                onChange={(e) => setFilterCourse(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                            >
                                <option value="">All Courses</option>
                                {courses.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <button onClick={() => { setFilterArchived(false); setSelectedBranchId(''); setFilterStatus(''); setFilterCourse(''); }} className="text-xs font-bold text-rose-500 hover:text-rose-600">Clear Filters</button>
                        </div>
                    )}
                </div>

                {/* ── Main Data Matrix ── */}
                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    <ApplicantSignalsTable
                        filteredLeads={filteredLeads}
                        getCourseName={getCourseName}
                        prefillFromLead={prefillFromLead}
                        onEditLead={handleEditLead}
                    />
                </div>
            </div>

            <EditLeadModal
                show={!!editingLead}
                onClose={() => setEditingLead(null)}
                lead={editingLead}
                courses={courses}
                onSuccess={fetchAllData}
            />

        </div>
    );
}
