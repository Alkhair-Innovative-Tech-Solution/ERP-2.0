'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    Award,
    Plus,
    Search,
    Filter,
    Calendar,
    ChevronDown,
    MoreHorizontal,
    CheckCircle2,
    Download,
    ShieldCheck,
    Users,
    TrendingUp,
    FileText,
    ExternalLink,
    XCircle,
    Copy,
    RotateCcw,
    X,
    Loader2,
    FileDown,
    RefreshCw,
    Activity,
    ZapIcon,
    SearchIcon,
    Settings2,
    Check
} from 'lucide-react';
import { certificateAPI, courseAPI, userAPI, enrollmentAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

// Types
interface Certification {
    id: string;
    student_id: string;
    course_id: string;
    issued_date: string;
    certificate_id: string;
    certificate_number: string;
    verification_code: string;
    student_name: string;
    course_title: string;
    course_code: string;
    course_name: string;
    grade: number;
    percentile: number;
    status: 'VERIFIED' | 'REVOKED' | 'PROCESSING';
}

export default function CertificationsPage() {
    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false); // needed for portal (SSR-safe)
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [courseFilter, setCourseFilter] = useState('ALL');
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [studentEnrollments, setStudentEnrollments] = useState<any[]>([]);
    const [isFetchingEnrollments, setIsFetchingEnrollments] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        student_id: '',
        course_id: '',
        enrollment_id: '',
        grade: '',
        percentile: ''
    });

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [certRes, usersRes, coursesRes] = await Promise.all([
                certificateAPI.getAll(orgId).catch(() => []),
                userAPI.getAll().catch(() => []),
                courseAPI.getAll({ organization_id: orgId }).catch(() => [])
            ]);

            const certsData: any = certRes;
            const usersData: any = usersRes;
            const coursesData: any = coursesRes;

            const certs = Array.isArray(certsData) ? certsData : (certsData?.results || []);
            const usersList = Array.isArray(usersData) ? usersData : (usersData?.results || []);
            const coursesList = Array.isArray(coursesData) ? coursesData : (coursesData?.results || []);

            setStudents(usersList.filter((u: any) => 
                u.role === 'STUDENT' || u.role === 'student' || u.role === 'COORDINATOR'
            ));
            setCourses(coursesList);

            // Enrich certificates - backend already stores student_name, course_title, course_code
            const enrichedCerts = certs.map((cert: any) => {
                return {
                    ...cert,
                    student_name: cert.student_name || 'Unknown Student',
                    course_name: cert.course_title ? `${cert.course_title} (${cert.course_code || 'N/A'})` : `Course #${cert.course_id || 'ID'}`,
                    certificate_id: cert.certificate_number || cert.certificate_id || '',
                    status: cert.is_verified ? 'VERIFIED' : (cert.is_verified === false ? 'REVOKED' : 'PROCESSING')
                };
            });

            setCertifications(enrichedCerts);
        } catch (error) {
            console.error('❌ Error fetching certification data:', error);
            toast.error('Failed to load certification protocols');
        } finally {
            setLoading(false);
        }
    };

    const handleStudentChange = async (studentId: string) => {
        setFormData({ ...formData, student_id: studentId, course_id: '', enrollment_id: '' });
        setStudentEnrollments([]);
        
        if (!studentId) return;

        try {
            setIsFetchingEnrollments(true);
            const enrollments = await enrollmentAPI.getByStudent(studentId);
            setStudentEnrollments(enrollments);
            
            if (enrollments.length === 0) {
                toast.error('No active enrollments found for this student');
            }
        } catch (error) {
            toast.error('Failed to fetch student academic records');
        } finally {
            setIsFetchingEnrollments(false);
        }
    };

    const handleIssueCertificate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await certificateAPI.generate({
                student_id: formData.student_id,
                course_id: formData.course_id,
                grade: Number(formData.grade) || undefined,
                percentile: Number(formData.percentile) || undefined
            });
            toast.success('Certificate issued successfully!');
            setIsIssueModalOpen(false);
            fetchData();
            resetForm();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to issue certificate');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            student_id: '',
            course_id: '',
            enrollment_id: '',
            grade: '',
            percentile: ''
        });
    };

    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedCertForExport, setSelectedCertForExport] = useState<Certification | null>(null);
    const exportTemplateRef = useRef<HTMLDivElement>(null);

    const handleDownloadPdf = async (cert: Certification) => {
        try {
            setSelectedCertForExport(cert);
            
            // Allow time for the hidden template to render with the certificate's data
            setTimeout(async () => {
                if (!exportTemplateRef.current) {
                    toast.error('Export system could not initialize');
                    return;
                }
                
                try {
                    setIsGenerating(true);
                    toast.loading(`Preparing official PDF for ${cert.student_name}...`, { id: 'admin-pdf' });
                    
                    const canvas = await html2canvas(exportTemplateRef.current, {
                        scale: 4,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                    });

                    const imgData = canvas.toDataURL('image/png', 1.0);
                    const pdf = new jsPDF({
                        orientation: 'landscape',
                        unit: 'px',
                        format: [800, 566]
                    });
                    
                    pdf.addImage(imgData, 'PNG', 0, 0, 800, 566);
                    pdf.save(`AIT-Official-${cert.student_name?.replace(/\s+/g, '-') || 'Student'}.pdf`);
                    
                    toast.success('Official PDF generated!', { id: 'admin-pdf' });
                } catch (error) {
                    toast.error('Failed to generate high-quality PDF');
                    console.error(error);
                } finally {
                    setIsGenerating(false);
                }
            }, 400);
        } catch (error) {
            toast.error('Failed to process certificate download');
        }
    };

    const handleCopyLink = (cert: Certification) => {
        const link = `${window.location.origin}/verify/${cert.verification_code || cert.certificate_id}`;
        navigator.clipboard.writeText(link);
        toast.success('Verification link copied!');
    };

    const filteredCerts = certifications.filter(cert => {
        const matchesSearch =
            cert.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.certificate_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.course_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || cert.status === statusFilter;
        const matchesCourse = courseFilter === 'ALL' || cert.course_id.toString() === courseFilter;

        return matchesSearch && matchesStatus && matchesCourse;
    });

    const { sortedData, sortConfig, requestSort } = useSortableData(filteredCerts);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Verifying Registries...</p>
            </div>
        );
    }

    // ── Issuance Terminal Modal (rendered via portal) ──
    const issueModal = isIssueModalOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsIssueModalOpen(false)}></div>
            <div className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl p-10 md:p-12 animate-in zoom-in-95 duration-300 border border-white group/modal">
               
                
                <div className="flex items-start justify-between mb-10">
                    <div>
                        <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Credential Architect</p>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Issue Credential</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Authorize academic verification for eligible scholar profiles.</p>
                    </div>
                    <button onClick={() => setIsIssueModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleIssueCertificate} className="space-y-8">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Link Verified Scholar Account</label>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.student_id}
                                    onChange={(e) => handleStudentChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Query Profile Registry</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim()} — {s.student_id || s.email}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                            </div>
                            {isFetchingEnrollments && (
                                <p className="text-[9px] font-black text-brand-teal tracking-widest pl-1 uppercase flex items-center gap-2">
                                   <RefreshCw size={10} className="animate-spin" /> Syncing Academic History...
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assign Validated Specialization</label>
                            <div className="relative">
                                    <select
                                        required
                                        value={formData.course_id}
                                        disabled={!formData.student_id || studentEnrollments.length === 0}
                                        onChange={(e) => {
                                            const enrollment = studentEnrollments.find(en => {
                                                const val = en.course?.id ?? en.course_id;
                                                return val != null && val.toString() === e.target.value;
                                            });
                                            setFormData({ 
                                                ...formData, 
                                                course_id: e.target.value,
                                                enrollment_id: enrollment?.id || ''
                                            });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer disabled:opacity-40"
                                    >
                                        <option value="">{formData.student_id ? (studentEnrollments.length > 0 ? "Select Verified Enrollment" : "Void: No Enrollment Detected") : "Awaiting Scholar Input"}</option>
                                        {studentEnrollments.map((en, i) => (
                                            <option key={en.id ?? `en-${i}`} value={en.course?.id ?? en.course_id ?? ''}>
                                                {en.course?.name || en.course_title || `Module: ${en.course?.id ?? en.course_id ?? i}`}
                                            </option>
                                        ))}
                                    </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Matrix Score (%)</label>
                                <input
                                    type="number"
                                    min="0" max="100"
                                    placeholder="Score"
                                    value={formData.grade}
                                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Global Percentile</label>
                                <input
                                    type="number"
                                    min="0" max="100"
                                    placeholder="Rank"
                                    value={formData.percentile}
                                    onChange={(e) => setFormData({ ...formData, percentile: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => setIsIssueModalOpen(false)}
                            className="flex-1 rounded-[24px] h-16 font-black text-slate-400 border-none bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest"
                        >
                            Abort Cycle
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[1.5] bg-brand-teal hover:bg-brand-dark text-white rounded-[24px] h-16 font-black shadow-2xl shadow-brand-teal/20 transition-all uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                            {isSubmitting ? 'Validating...' : 'Commit Credential'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    ) : null;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Academic Validation</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Award className="w-7 h-7 text-brand-teal" />
                        Certifications Portal
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Institutional authority for credential issuance and registry management.</p>
                </div>
                <Button
                    onClick={() => setIsIssueModalOpen(true)}
                    className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Issue Credential
                </Button>
            </div>

            {/* ── High-Fidelity Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Issued', value: certifications.length, icon: Award, color: 'teal' },
                  { label: 'Verified Integrity', value: certifications.filter(c => c.status === 'VERIFIED').length, icon: ShieldCheck, color: 'emerald' },
                  { label: 'Revoked Assets', value: certifications.filter(c => c.status === 'REVOKED').length, icon: XCircle, color: 'rose' },
                  { label: 'Issuance Velocity', value: (certifications.length / (courses.length || 1)).toFixed(1), icon: Activity, color: 'blue' },
                ].map((stat, i) => (
                    <div key={i} className="premium-card p-8 flex flex-col group border-none shadow-premium bg-white">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm",
                            stat.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                            stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                            stat.color === 'rose' ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-600"
                        )}>
                            <stat.icon size={22} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Unified Registry Interface ── */}
            <div className="premium-card p-4 flex flex-col md:flex-row gap-4 items-center border-none shadow-premium bg-slate-50/50">
                <div className="relative flex-1 group">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                    <input
                        type="text"
                        placeholder="Query by credential identification, holder nomenclature, or specialization..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-2xl px-5 h-11 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] focus:outline-none focus:ring-4 focus:ring-brand-teal/5 transition-all cursor-pointer min-w-[160px]"
                    >
                        <option value="ALL">Protocol: All States</option>
                        <option value="VERIFIED">Status: Verified</option>
                        <option value="REVOKED">Status: Revoked</option>
                        <option value="PROCESSING">Status: Processing</option>
                    </select>
                </div>
            </div>

            {/* ── Credentials Registry ── */}
            <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <SortableTableHeader label="Credential Holder" sortKey="student_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Validated Specialization" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Validation Matrix" sortKey="issued_date" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Registry ID" sortKey="certificate_id" currentSort={sortConfig} onSort={requestSort} />
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Protocol</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {sortedData.length > 0 ? (
                                sortedData.map((cert) => (
                                    <tr key={cert.id} className="hover:bg-brand-teal/5 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-110",
                                                    cert.student_name?.includes('#') ? "bg-rose-50 text-rose-500" : "bg-brand-teal text-white"
                                                )}>
                                                    {cert.student_name?.[0] || 'S'}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-black text-slate-900 tracking-tight text-sm group-hover:text-brand-teal transition-colors">{cert.student_name}</span>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[150px]">{cert.student_id ? `ID: ${cert.student_id.slice(0, 8)}...` : 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 uppercase text-[10px] tracking-widest line-clamp-1">{cert.course_name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                    <Check size={10} className="text-brand-teal" /> Institutional Endorsement
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <Calendar size={14} className="text-brand-teal" />
                                                {new Date(cert.issued_date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {cert.status === 'VERIFIED' ? (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
                                                    <ShieldCheck size={12} className="animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest group-hover:underline underline-offset-2">Verified</span>
                                                </div>
                                            ) : cert.status === 'REVOKED' ? (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-500 rounded-xl w-fit">
                                                    <XCircle size={12} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Revoked</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-xl w-fit">
                                                    <RefreshCw size={12} className="animate-spin" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Pending</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <code className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-[0.1em] shadow-sm border border-slate-700/50">
                                                {cert.certificate_id || cert.verification_code || `CERT-${cert.id.slice(0, 8)}`}
                                            </code>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    disabled={isGenerating && selectedCertForExport?.id === cert.id}
                                                    onClick={() => handleDownloadPdf(cert)}
                                                    className={cn(
                                                        "w-10 h-10 rounded-xl transition-all shadow-sm",
                                                        cert.student_name?.includes('#') ? "bg-slate-50 text-slate-200" : "bg-brand-teal text-white hover:bg-brand-dark hover:scale-105 active:scale-95"
                                                    )}
                                                >
                                                    {isGenerating && selectedCertForExport?.id === cert.id ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <FileDown size={16} />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => handleCopyLink(cert)}
                                                    className="w-10 h-10 rounded-xl text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all"
                                                >
                                                    <Copy size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-200">
                                            <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                               <Award size={48} strokeWidth={1} />
                                            </div>
                                            <div>
                                               <p className="text-xl font-black text-slate-900 tracking-tighter">Registry Matrix Empty</p>
                                               <p className="text-slate-400 font-medium text-sm mt-1">Institutional records query returned zero validated credentials.</p>
                                               <Button variant="ghost" onClick={() => setSearchTerm('')} className="mt-4 text-brand-teal font-black uppercase text-[10px] tracking-widest">Reset Registry Query</Button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal rendered via portal -> escapes any parent transform/filter/stacking context
                so the blur overlay always covers the FULL viewport including header/sidebar */}
            {mounted && issueModal && createPortal(issueModal, document.body)}

            {/* ── HIDDEN PDF GENERATION ASSETS ── */}
            <div className="fixed -left-[10000px] top-0 pointer-events-none overflow-hidden" aria-hidden="true">
                <style jsx global>{`
                    @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
                    .font-script {
                        font-family: 'Great Vibes', cursive;
                    }
                `}</style>
                
                <div 
                    ref={exportTemplateRef}
                    className="relative bg-white w-[800px] h-[566px] overflow-hidden"
                    style={{ minWidth: '800px', minHeight: '566px' }}
                >
                    <img 
                        src="/certificate-bg.png" 
                        alt="" 
                        className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                    <div className="relative z-10 w-full h-full text-center">
                        <div className="absolute top-[275px] left-0 w-full">
                            <h2 className="font-script text-[64px] text-[#c4843b] leading-none px-12 truncate">
                                {selectedCertForExport?.student_name || ''}
                            </h2>
                        </div>
                        <div className="absolute top-[376px] left-[520px] text-left">
                            <span className="text-[17px] font-black text-[#2e4d58] tracking-widest">
                                {selectedCertForExport?.certificate_id || selectedCertForExport?.verification_code || ''}
                            </span>
                        </div>
                        <div className="absolute top-[448px] left-0 w-full px-12">
                            <p className="text-[20px] font-black text-[#2e4d58] uppercase tracking-wide">
                                {selectedCertForExport?.course_name ? (
                                    selectedCertForExport.course_name.toUpperCase().includes('SPECIALIZATION') 
                                        ? selectedCertForExport.course_name 
                                        : `${selectedCertForExport.course_name} Specialization`
                                ) : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
