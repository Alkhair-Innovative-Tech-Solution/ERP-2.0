'use client';

import { useState, useEffect } from 'react';
import {
    ShieldCheck,
    CheckCircle,
    XCircle,
    Clock,
    Download,
    AlertTriangle,
    BookOpen,
    Calendar,
    Sparkles,
    ChevronRight
} from 'lucide-react';
import { attendanceAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function StudentAttendancePage() {
    const [loading, setLoading] = useState(true);
    const [statsData, setStatsData] = useState<any>(null);
    const user = getStoredUser();

    useEffect(() => {
        if (user?.id) {
            fetchAttendanceData();
        } else {
            setLoading(false);
        }
    }, [user?.id]);

    const fetchAttendanceData = async () => {
        try {
            setLoading(true);
            if (user?.id) {
                const data = await attendanceAPI.getStudentStats(user.id);
                setStatsData(data);
            }
        } catch (error) {
            console.error('Error fetching attendance stats:', error);
            toast.error('Failed to load attendance records');
        } finally {
            setLoading(false);
        }
    };

  const overall = statsData?.overall || { percentage: 0, total_classes: 0, present: 0, absent: 0, late: 0, excused: 0 };
  const courseStats = statsData?.courses || [];
  const { sortedData, sortConfig, requestSort } = useSortableData(courseStats);
    const isEligible = overall.percentage >= 80;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50/50">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-100 animate-spin border-t-brand-teal shadow-xl shadow-brand-teal/10" />
                    <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
                      <ShieldCheck className="w-8 h-8 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Loading attendance...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-12 bg-slate-50/30 min-h-screen">

            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Calendar className="w-7 h-7 text-brand-teal" />
                    Attendance
                </h1>
                <p className="text-sm text-slate-400 font-bold mt-1">Track your class attendance and stay on track for certification</p>
            </div>

            {/* Warning Banner */}
            {!isEligible && overall.total_classes > 0 && (
                <div className="bg-orange-50/50 border border-brand-orange/20 p-8 rounded-[2rem] flex items-start gap-6 shadow-xl shadow-brand-orange/5 animate-pulse-slow">
                    <div className="p-4 bg-brand-orange rounded-2xl shadow-lg shadow-brand-orange/20">
                        <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-brand-orange font-black text-lg uppercase tracking-tight">Need to attend more classes</h3>
                        <p className="text-slate-600 font-medium text-[15px] mt-2 leading-relaxed">
                            Your attendance is below 80%. Please attend your upcoming classes to stay eligible for your certificate.
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard
                    title="Total Classes"
                    value={overall.total_classes}
                    icon={Calendar}
                    color="primary"
                    description="Total classes held so far"
                />
                <StatCard
                    title="Attended"
                    value={overall.present}
                    icon={CheckCircle}
                    color="success"
                    description="Classes you have attended"
                />
                <StatCard
                    title="Missed"
                    value={overall.absent}
                    icon={XCircle}
                    color="error"
                    description="Classes you have missed"
                />
                <StatCard
                    title="Goal"
                    value="85%"
                    icon={Sparkles}
                    color="warning"
                    description="Target attendance rate"
                />
            </div>

            {/* Course-wise Breakdown Card */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="p-10 md:p-14 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Records</h3>
                        <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.2em] mt-3">Your attendance record for each subject</p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-4 px-8 py-4 bg-slate-50 hover:bg-brand-dark text-slate-400 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] border border-slate-100 transition-all shadow-inner group/print hover:rotate-2"
                    >
                        <Download className="w-5 h-5 text-brand-orange group-hover/print:animate-bounce" /> Download Report
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans">
                        <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                            <tr>
                                <SortableTableHeader label="Subject" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Classes Held" sortKey="total_classes" currentSort={sortConfig} onSort={requestSort} align="center" />
                                <SortableTableHeader label="Attended" sortKey="present" currentSort={sortConfig} onSort={requestSort} align="center" />
                                <SortableTableHeader label="Attendance %" sortKey="percentage" currentSort={sortConfig} onSort={requestSort} align="center" />
                                <th className="px-10 py-8 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedData.map((course: any) => (
                                <tr key={course.course_id} className="group hover:bg-slate-50/80 transition-all">
                                    <td className="px-10 py-10">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-brand-dark group-hover:text-brand-teal transition-all shadow-inner group-hover:rotate-12">
                                                <BookOpen className="w-6 h-6" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-lg uppercase tracking-tight">{course.course_name}</span>
                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Course</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-10 text-center">
                                        <span className="text-xl font-black text-slate-700">{course.total_classes}</span>
                                    </td>
                                    <td className="px-10 py-10">
                                        <div className="flex items-center justify-center gap-6">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black text-brand-teal uppercase tracking-widest">{course.present} ATTENDED</span>
                                                <span className="text-[10px] font-black text-brand-orange uppercase tracking-widest mt-1">{course.absent} MISSED</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-10">
                                        <div className="flex flex-col items-center gap-3 min-w-[160px]">
                                            <div className="flex items-center justify-between w-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <span className={cn(course.percentage >= 80 ? "text-brand-teal" : "text-brand-orange")}>{course.percentage}% ATTENDANCE</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner p-0.5 border border-slate-100">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-1500 shadow-[0_0_8px_rgba(42,159,144,0.4)]",
                                                        course.percentage >= 80 ? "bg-brand-teal" : "bg-brand-orange shadow-[0_0_8px_rgba(201,105,40,0.4)]"
                                                    )}
                                                    style={{ width: `${course.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-10 text-right">
                                        <div className={cn(
                                            "inline-flex items-center gap-2.5 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                                            course.percentage >= 80 ? "bg-teal-50 text-brand-teal border-brand-teal/10" : "bg-orange-50 text-brand-orange border-brand-orange/10"
                                        )}>
                                            {course.percentage >= 80 ? (
                                                <><CheckCircle className="w-4 h-4" /> Good</>
                                            ) : (
                                                <><AlertTriangle className="w-4 h-4" /> Needs attention</>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {courseStats.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-10 py-32 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 shadow-inner">
                                                <Calendar className="w-10 h-10" />
                                            </div>
                                            <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em]">No attendance records found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, description }: any) {
    const colorMap: any = {
        primary: "text-brand-teal bg-teal-50 shadow-brand-teal/10",
        success: "text-emerald-600 bg-emerald-50 shadow-emerald-100",
        error: "text-brand-orange bg-orange-50 shadow-brand-orange/10",
        warning: "text-brand-teal bg-teal-50 shadow-brand-teal/10",
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-300/40 transition-all group overflow-hidden relative">
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-brand-teal/5 transition-all duration-1000" />
            <div className="flex items-start justify-between relative z-10">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 shadow-sm", colorMap[color])}>
                    <Icon className="w-7 h-7" />
                </div>
                <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-brand-teal group-hover:translate-x-1 transition-all" />
            </div>
            <div className="mt-8 space-y-2 relative z-10">
                <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{value}</h4>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
                <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-brand-orange" /> {description}
                    </p>
                </div>
            </div>
        </div>
    );
}
