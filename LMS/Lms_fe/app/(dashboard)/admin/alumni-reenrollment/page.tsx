'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, ArrowRight, CheckCircle, User, BookOpen, Calendar, GraduationCap, X, Loader2, ShieldCheck, DollarSign, AlertCircle } from 'lucide-react';
import { courseAPI, userAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

interface AlumniRecord {
    id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    course_id: string;
    course_name: string;
    status: string;
    enrolled_at: string;
    completed_at?: string;
    grade?: number;
}

interface DepositInfo {
    id: string;
    deposit_amount: number;
    is_returned: boolean;
    is_waived: boolean;
    course_id: string;
    receipt_number?: string;
}

export default function AlumniReenrollmentPage() {
    const [alumni, setAlumni] = useState<AlumniRecord[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'completed'>('all');

    // Re-enrollment modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedAlumni, setSelectedAlumni] = useState<AlumniRecord | null>(null);
    const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);
    const [feeInfo, setFeeInfo] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingDeposit, setIsCheckingDeposit] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [enrollRes, coursesRes] = await Promise.all([
                courseAPI.getEnrollments({ page: 1, limit: 500, status: 'completed', organization_id: orgId }).catch(() => ({ items: [], total: 0 })),
                courseAPI.getAll({ organization_id: orgId }).catch(() => [])
            ]);
            
            const enrollments = enrollRes.items || [];
            const completedEnrollments = enrollments.filter((e: any) => 
                e.status?.toUpperCase() === 'COMPLETED'
            );

            // Extract unique student IDs
            const uniqueStudentIds = Array.from(new Set(completedEnrollments.map((e: any) => e.student_id as string)));

            // Batch fetch student data
            let studentMap: Record<string, { full_name: string; email: string }> = {};
            if (uniqueStudentIds.length > 0) {
                try {
                    const students = await userAPI.getByIds(uniqueStudentIds);
                    studentMap = {};
                    (students || []).forEach((s: any) => {
                        studentMap[s.id] = {
                            full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
                            email: s.email || 'N/A'
                        };
                    });
                } catch (err) {
                    console.error('Failed to fetch student data:', err);
                }
            }
            
            setAlumni(completedEnrollments.map((e: any) => {
                const student = studentMap[e.student_id] || {};
                return {
                    id: e.id,
                    student_id: e.student_id,
                    student_name: student.full_name || 'Unknown',
                    student_email: student.email || 'N/A',
                    course_id: e.course?.id || e.course_id,
                    course_name: e.course?.name || e.course_name || 'Unknown Course',
                    status: e.status,
                    enrolled_at: e.enrolled_at,
                    completed_at: e.completed_at,
                    grade: e.grade
                };
            }));
            
            setCourses(Array.isArray(coursesRes) ? coursesRes : ((coursesRes as any)?.results || []));
        } catch (error) {
            console.error('Error fetching alumni data:', error);
            toast.error('Failed to load alumni records');
        } finally {
            setLoading(false);
        }
    };

    const filteredAlumni = useMemo(() => {
        let result = alumni;
        if (filterStatus === 'completed') result = result.filter(a => a.status?.toUpperCase() === 'COMPLETED');


        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.student_name?.toLowerCase().includes(q) ||
                a.student_email?.toLowerCase().includes(q) ||
                a.course_name?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [alumni, searchQuery, filterStatus]);

    const { sortedData, sortConfig, requestSort } = useSortableData(filteredAlumni);

    const stats = useMemo(() => ({
        total: alumni.length,
        completed: alumni.filter(a => a.status?.toUpperCase() === 'COMPLETED').length,

        courses: [...new Set(alumni.map(a => a.course_id))].length
    }), [alumni]);

    const handleReEnrollClick = async (alum: AlumniRecord) => {
        setSelectedAlumni(alum);
        setSelectedCourseId('');
        setSelectedClassId('');
        setAvailableClasses([]);
        setFeeInfo([]);
        setDepositInfo(null);
        setShowModal(true);

        // Check deposit status
        setIsCheckingDeposit(true);
        try {
            const deposits = await courseAPI.getDepositsByStudent(alum.student_id);
            const activeDeposit = (deposits || []).find((d: any) => !d.is_returned && !d.is_deleted);
            if (activeDeposit) {
                setDepositInfo({
                    id: activeDeposit.id,
                    deposit_amount: activeDeposit.deposit_amount,
                    is_returned: activeDeposit.is_returned,
                    is_waived: activeDeposit.is_waived,
                    course_id: activeDeposit.course_id,
                    receipt_number: activeDeposit.receipt_number
                });
            }
        } catch (err) {
            console.error('Failed to check deposit:', err);
        } finally {
            setIsCheckingDeposit(false);
        }
    };

    const handleCourseChange = async (courseId: string) => {
        setSelectedCourseId(courseId);
        setSelectedClassId('');
        setAvailableClasses([]);
        setFeeInfo([]);

        if (!courseId) return;

        // Fetch scheduled classes for this course
        try {
            const classes = await courseAPI.getScheduledClasses(courseId);
            setAvailableClasses(Array.isArray(classes) ? classes : (classes?.results || []));
        } catch (err) {
            console.error('Failed to fetch classes:', err);
        }

        // Fetch fee structure for this course
        try {
            const fees = await courseAPI.getFeeStructure(courseId);
            setFeeInfo(Array.isArray(fees) ? fees : []);
        } catch (err) {
            console.error('Failed to fetch fees:', err);
        }
    };

    const handleSubmitReEnrollment = async () => {
        if (!selectedAlumni || !selectedCourseId) {
            toast.error('Please select a course');
            return;
        }

        if (!depositInfo) {
            toast.error('No paid deposit found. Student must pay deposit first.');
            return;
        }

        setIsSubmitting(true);
        try {
            await courseAPI.reenrollAlumni(
                selectedAlumni.student_id,
                selectedCourseId,
                selectedClassId || undefined
            );
            toast.success('Alumni re-enrolled successfully! Deposit transferred to new course.');
            setShowModal(false);
            fetchData();
        } catch (error: any) {
            const msg = error?.response?.data?.detail || error?.message || 'Re-enrollment failed';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    const totalCourseFee = feeInfo.reduce((sum: number, f: any) => sum + (f.one_time_fee || 0) + (f.monthly_maintenance_fee || 0), 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Alumni Records...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <GraduationCap className="w-7 h-7 text-brand-teal" />
                        Re-enrollment Management
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Manage alumni course re-enrollment requests and deposit status verification.</p>
                </div>
                <Button onClick={fetchData} variant="ghost" className="rounded-2xl h-14 px-6 font-black text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
                    <RefreshCw className="w-5 h-5 mr-3" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Alumni', val: stats.total, icon: User, color: 'blue' },
                    { label: 'Completed', val: stats.completed, icon: CheckCircle, color: 'emerald' },
                    { label: 'Courses', val: stats.courses, icon: BookOpen, color: 'amber' },
                    { label: 'Courses', val: stats.courses, icon: BookOpen, color: 'indigo' },
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

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-full md:w-fit">
                        {[
                            { id: 'all', label: 'All Alumni' },
                            { id: 'completed', label: 'Completed' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id as any)}
                                className={cn(
                                    "flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                    filterStatus === tab.id ? "bg-white text-brand-teal shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1 max-w-md w-full group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                        <input
                            type="text"
                            placeholder="Search alumni..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
                        />
                    </div>
                </div>

                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <SortableTableHeader label="Alumni" sortKey="student_name" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Completed Course" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                                    <SortableTableHeader label="Completed" sortKey="completed_at" currentSort={sortConfig} onSort={requestSort} />
                                    <th className="px-4 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {filteredAlumni.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-200">
                                                <User size={48} strokeWidth={1} />
                                                <p className="text-xl font-black text-slate-900 tracking-tighter">No alumni records</p>
                                                <p className="text-sm text-slate-400">Completed enrollments will appear here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedData.map(alum => (
                                        <tr key={alum.id} className="hover:bg-brand-teal/5 transition-colors group">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm">
                                                        {alum.student_name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-xs uppercase">{alum.student_name}</p>
                                                        <p className="text-[9px] text-slate-400">{alum.student_email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase">
                                                    <BookOpen size={12} className="text-brand-teal" />
                                                    {alum.course_name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge className={cn(
                                                    "text-[8px] font-black uppercase",
                                                    alum.status?.toUpperCase() === 'GRADUATED' 
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                                        : "bg-blue-50 text-blue-600 border-blue-100"
                                                )}>
                                                    {alum.status || 'Completed'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
                                                    <Calendar size={12} className="text-slate-300" />
                                                    {alum.completed_at ? new Date(alum.completed_at).toLocaleDateString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    onClick={() => handleReEnrollClick(alum)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-brand-dark transition-all"
                                                >
                                                    Re-enroll <ArrowRight size={10} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Re-enrollment Modal */}
            {showModal && selectedAlumni && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Alumni Re-enrollment</p>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Re-enroll Scholar</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Student Info */}
                        <div className="bg-slate-50 rounded-2xl p-5 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-brand-teal text-white flex items-center justify-center font-black text-lg">
                                    {selectedAlumni.student_name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">{selectedAlumni.student_name}</p>
                                    <p className="text-[10px] text-slate-400">{selectedAlumni.student_email}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Previous: {selectedAlumni.course_name}</p>
                                </div>
                            </div>
                        </div>

                        {/* Deposit Status */}
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Deposit Status</p>
                            {isCheckingDeposit ? (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span className="text-xs">Checking deposit...</span>
                                </div>
                            ) : depositInfo ? (
                                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                    <ShieldCheck size={20} className="text-emerald-600" />
                                    <div>
                                        <p className="text-xs font-black text-emerald-700">Deposit Verified</p>
                                        <p className="text-[10px] text-emerald-500">PKR {depositInfo.deposit_amount} â€” Will transfer to new course</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl p-4">
                                    <AlertCircle size={20} className="text-rose-500" />
                                    <div>
                                        <p className="text-xs font-black text-rose-700">No Paid Deposit</p>
                                        <p className="text-[10px] text-rose-500">Student must pay deposit before re-enrollment</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Course Selection */}
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select New Course</p>
                            <select
                                value={selectedCourseId}
                                onChange={(e) => handleCourseChange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none"
                            >
                                <option value="">Choose a course...</option>
                                {courses.filter(c => c.id !== selectedAlumni.course_id).map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.course_code || 'N/A'})</option>
                                ))}
                            </select>
                        </div>

                        {/* Class Selection */}
                        {selectedCourseId && (
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Class / Section (Optional)</p>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none"
                                >
                                    <option value="">No specific class (auto-assign)</option>
                                    {availableClasses.map((cls: any) => (
                                        <option key={cls.id} value={cls.id}>
                                            Section {cls.section || cls.name} â€” {cls.days?.join(', ')} {cls.start_time} - {cls.end_time}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Fee Summary */}
                        {selectedCourseId && feeInfo.length > 0 && (
                            <div className="mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Course Fees</p>
                                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                    {feeInfo.map((fee: any, i: number) => (
                                        <div key={i} className="flex justify-between text-xs">
                                            <span className="text-slate-600">{fee.scope === 'scheduled_class' ? `Section ${fee.section_label || ''}` : 'Course-wide'} Fee</span>
                                            <span className="font-black text-slate-800">
                                                {fee.one_time_fee > 0 && `PKR ${fee.one_time_fee}`}
                                                {fee.one_time_fee > 0 && fee.monthly_maintenance_fee > 0 && ' + '}
                                                {fee.monthly_maintenance_fee > 0 && `PKR ${fee.monthly_maintenance_fee}/mo`}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                                        <span className="text-xs font-black text-slate-700">Total Course Fee</span>
                                        <span className="text-sm font-black text-brand-teal">PKR {totalCourseFee}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-xs font-black text-emerald-600">Deposit (Already Paid)</span>
                                        <span className="text-xs font-black text-emerald-600">PKR {depositInfo?.deposit_amount || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => setShowModal(false)}
                                className="flex-1 rounded-xl h-12 font-black text-slate-400 bg-slate-50 hover:bg-slate-100 uppercase text-[10px] tracking-widest"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitReEnrollment}
                                disabled={isSubmitting || !selectedCourseId || !depositInfo}
                                className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-xl h-12 font-black shadow-lg shadow-brand-teal/20 uppercase text-[10px] tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {isSubmitting ? 'Processing...' : 'Confirm Re-enrollment'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
