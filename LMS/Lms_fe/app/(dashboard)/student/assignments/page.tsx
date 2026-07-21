'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    FileText,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    Search,
    Filter,
    Sparkles,
    Timer
} from 'lucide-react';
import { courseAPI, assignmentAPI, submissionAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils'; // Assuming cn utility exists

export default function StudentAssignmentsPage() {
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetchAllAssignments();
    }, []);

    const fetchAllAssignments = async () => {
        try {
            setLoading(true);
            const user = getStoredUser();

            // 1. Get Enrollments (including scheduled classes for batch info)
            const enrollmentsData = await courseAPI.getMyEnrollments().catch(() => []);
            const enrollments = Array.isArray(enrollmentsData)
                ? enrollmentsData
                : (enrollmentsData.results || enrollmentsData || []);

            console.log('ðŸ“ Student Assignments: Found enrollments:', enrollments.length);

            // Filter out dropped and failed? (usually keep failed for viewing)
            const activeEnrollments = enrollments.filter((e: any) =>
                e.status?.toLowerCase() === 'enrolled'
            );

            // 2. Get Assignments for each course + section
            const promises = activeEnrollments.map((e: any) => {
                const courseId = e.course_id || e.course?.id;
                const scheduledClassId = e.scheduled_class_id;

                console.log(`ðŸ” Fetching assignments for Course: ${courseId}, Section: ${scheduledClassId}`);
                return assignmentAPI.getAll(courseId, undefined, scheduledClassId).catch(() => []);
            });

            // 3. Get Student Submissions
            let userSubmissions: any[] = [];
            if (user?.id) {
                const subs = await submissionAPI.getAll(undefined, user.id).catch(() => []);
                userSubmissions = Array.isArray(subs) ? subs : (subs.results || []);
            }

            const results = await Promise.all(promises);

            // 4. Flatten and enrich
            const allAssignmentsMap = new Map();
            results.flat().forEach((assignment: any) => {
                // Remove duplicates (e.g. if internal IDs clash or master fetched multiple times)
                if (allAssignmentsMap.has(assignment.id)) return;

                // Find matching enrollment for course details
                const enrollment = activeEnrollments.find((e: any) =>
                    (e.course_id === assignment.course_id || e.course?.id === assignment.course_id)
                );

                // Find submission
                const submission = userSubmissions.find((s: any) => s.assignment_id === assignment.id);

                allAssignmentsMap.set(assignment.id, {
                    ...assignment,
                    courseName: enrollment?.course?.name || enrollment?.course?.title || 'Unknown Course',
                    status: getAssignmentStatus(assignment, submission)
                });
            });

            const allAssignments = Array.from(allAssignmentsMap.values());

            // Sort by due date (nearest first)
            allAssignments.sort((a: any, b: any) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity));

            setAssignments(allAssignments);
        } catch (error) {
            console.error('Error fetching assignments:', error);
            toast.error('Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    const getAssignmentStatus = (assignment: any, submission: any) => {
        if (submission) {
            if (submission.status === 'GRADED') return 'graded';
            return 'submitted';
        }

        const now = new Date();
        const dueDate = new Date(assignment.due_date);

        if (dueDate < now) return 'overdue';
        return 'pending';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted': return 'bg-teal-50 text-brand-teal border-brand-teal/10';
            case 'graded': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'overdue': return 'bg-orange-50 text-brand-orange border-brand-orange/10';
            default: return 'bg-slate-50 text-slate-500 border-slate-100'; // pending
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'submitted': return 'Submitted';
            case 'graded': return 'Graded';
            case 'overdue': return 'Overdue';
            default: return 'Pending';
        }
    };

    const filteredAssignments = assignments.filter(a => {
        if (filter !== 'all' && a.status !== filter) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            if (!a.title?.toLowerCase().includes(q) && !a.course_name?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const upcomingDeadlines = assignments
        .filter(a => a.status === 'pending' || a.status === 'overdue')
        .slice(0, 3);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50/50">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-100 animate-spin border-t-brand-teal shadow-xl shadow-brand-teal/10" />
                    <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
                      <FileText className="w-8 h-8 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Loading assignments...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Task Center</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <FileText className="w-7 h-7 text-brand-teal" />
                        My Tasks
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Check your tasks and stay on top of your work.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all bg-white shadow-xl shadow-slate-200/40 font-bold text-sm"
                        />
                    </div>
                    <button className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:bg-slate-50 transition-all text-slate-400 hover:text-brand-teal">
                        <Filter className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Content - Assignment Cards */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-6 scrollbar-hide">
                        {['all', 'pending', 'submitted', 'graded'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={cn(
                                    "px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm",
                                    filter === t
                                        ? "bg-brand-dark text-white border-brand-dark shadow-xl scale-105"
                                        : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {filteredAssignments.length === 0 ? (
                        <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-100 shadow-xl shadow-slate-200/40">
                            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <FileText className="w-12 h-12 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">No tasks found</h3>
                            <p className="text-slate-400 font-medium">You have no tasks here.</p>
                        </div>
                    ) : (
                        filteredAssignments.map((assignment) => {
                            const daysLeft = assignment.due_date ? Math.ceil((new Date(assignment.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : Infinity;
                            const isHighPriority = daysLeft <= 2 && assignment.status === 'pending';

                            return (
                                <div
                                    key={assignment.id}
                                    className={cn(
                                        "group relative bg-white rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 border border-slate-50 shadow-xl shadow-slate-200/30 overflow-hidden",
                                        "hover:shadow-2xl hover:shadow-slate-300/40 hover:-translate-y-2",
                                        isHighPriority ? "ring-2 ring-brand-orange/20" : ""
                                    )}
                                >
                                    {isHighPriority && (
                                        <div className="absolute top-6 right-8 px-4 py-1.5 bg-brand-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg animate-pulse flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5" /> Due Soon
                                        </div>
                                    )}

                                    <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                                        {/* Icon/Thumbnail */}
                                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-teal/10 transition-colors shadow-inner">
                                            <FileText className="w-10 h-10 text-slate-300 group-hover:text-brand-teal group-hover:scale-110 transition-all duration-500" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-brand-teal transition-colors tracking-tight">
                                                    {assignment.title}
                                                </h3>
                                                <span className={cn(
                                                    "px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                                                    getStatusColor(assignment.status)
                                                )}>
                                                    {getStatusLabel(assignment.status)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-2 h-2 rounded-full bg-brand-teal" />
                                                <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest">{assignment.courseName}</p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-50">
                                                <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-inner">
                                                    <Calendar className="w-4 h-4 text-brand-teal" />
                                                    <span className="font-black text-[11px] text-slate-600 uppercase tracking-widest">Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                                                </div>
                                                {isHighPriority && (
                                                    <div className="flex items-center gap-3 px-5 py-2.5 bg-orange-50 rounded-2xl border border-brand-orange/10 shadow-sm animate-pulse">
                                                        <Clock className="w-4 h-4 text-brand-orange" />
                                                        <span className="font-black text-[11px] text-brand-orange uppercase tracking-widest">{daysLeft < 0 ? 'Overdue' : `${daysLeft} days left`}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                {/* Status Progress */}
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-10 h-1.5 rounded-full transition-all duration-1000", assignment.status !== 'pending' ? "bg-brand-teal shadow-[0_0_8px_rgba(42,159,144,0.4)]" : "bg-slate-100")} />
                                                    <div className={cn("w-10 h-1.5 rounded-full transition-all duration-1000", assignment.status === 'graded' || assignment.status === 'submitted' ? "bg-brand-teal shadow-[0_0_8px_rgba(42,159,144,0.4)]" : "bg-slate-100")} />
                                                    <div className={cn("w-10 h-1.5 rounded-full transition-all duration-1000", assignment.status === 'graded' ? "bg-brand-teal shadow-[0_0_8px_rgba(42,159,144,0.4)]" : "bg-slate-100")} />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{getStatusLabel(assignment.status)}</span>
                                                </div>

                                                <button
                                                    onClick={() => router.push(`/student/assignments/${assignment.id}`)}
                                                    className="btn-secondary !rounded-[1.5rem] !py-4"
                                                >
                                                    {assignment.status === 'submitted' ? 'View result' : 'Start'}
                                                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Abstract corner decoration */}
                                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-brand-teal/5 rounded-full blur-3xl group-hover:bg-brand-teal/10 transition-all duration-1000" />
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Sidebar - VIP Panel */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Upcoming Deadlines Panel */}
                    <div className="bg-brand-dark text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] group-hover:bg-brand-teal/30 transition-all duration-1000" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-orange/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[60px]" />

                        <h3 className="text-2xl font-black mb-10 flex items-center gap-4 relative z-10 tracking-tight">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner text-brand-teal">
                                <Timer className="w-6 h-6 animate-pulse" />
                            </div>
                            Due soon
                        </h3>

                        <div className="space-y-6 relative z-10">
                            {upcomingDeadlines.length === 0 ? (
                                <div className="text-center py-10 bg-white/5 rounded-3xl border border-white/5">
                                   <CheckCircle className="w-10 h-10 text-brand-teal/30 mx-auto mb-4" />
                                   <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">No upcoming deadlines</p>
                                </div>
                            ) : (
                                upcomingDeadlines.map((a, idx) => {
                                    const timeLeft = Math.ceil((new Date(a.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    const isUrgent = timeLeft <= 2;

                                    return (
                                        <div key={idx} className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group/item" onClick={() => router.push(`/student/assignments/${a.id}`)}>
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-black text-sm line-clamp-1 flex-1 pr-4">{a.title}</h4>
                                                <span className={cn(
                                                    "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                                                    isUrgent ? "bg-brand-orange/20 text-brand-orange border-brand-orange/30" : "bg-brand-teal/20 text-brand-teal border-brand-teal/30"
                                                )}>
                                                    {isUrgent ? 'Urgent' : 'Later'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{timeLeft < 0 ? 'Deadline passed' : `${timeLeft} Days Left`}</span>
                                            </div>

                                            {/* Simple visual countdown bar */}
                                            <div className="w-full bg-white/5 h-2 rounded-full mt-6 overflow-hidden p-0.5 border border-white/5 shadow-inner">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-1500", isUrgent ? "bg-brand-orange shadow-[0_0_8px_rgba(201,105,40,0.5)]" : "bg-brand-teal shadow-[0_0_8px_rgba(42,159,144,0.5)]")}
                                                    style={{ width: `${Math.max(5, Math.min(100, (1 - timeLeft / 14) * 100))}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 text-center">
                            <button className="text-[11px] font-black text-slate-400 hover:text-brand-teal uppercase tracking-[0.3em] transition-all">
                                View Calendar
                            </button>
                        </div>
                    </div>

                    {/* Tips or Quote Card */}
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-teal/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-brand-teal/10 transition-all duration-700" />
                        <div className="flex items-start gap-6 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-brand-teal/10 flex items-center justify-center flex-shrink-0 text-brand-teal shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <Sparkles className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Study Tip</h4>
                                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                    Submitting assignments <span className="text-brand-teal">24 hours early</span> helps you get better feedback and results.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
