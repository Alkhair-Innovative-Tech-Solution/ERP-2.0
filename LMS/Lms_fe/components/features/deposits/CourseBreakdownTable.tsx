import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface CourseBreakdown {
    courseId: string;
    courseName: string;
    studentCount: number;
    totalCollected: number;
    totalRefunded: number;
    activeCount: number;
    returnedCount: number;
}

interface CourseBreakdownTableProps {
    breakdown: CourseBreakdown[];
}

function formatPKR(amount: number): string {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export const CourseBreakdownTable = memo(({ breakdown }: CourseBreakdownTableProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const totals = useMemo(() => ({
        studentCount: breakdown.reduce((s, c) => s + c.studentCount, 0),
        totalCollected: breakdown.reduce((s, c) => s + c.totalCollected, 0),
        totalRefunded: breakdown.reduce((s, c) => s + c.totalRefunded, 0),
        activeCount: breakdown.reduce((s, c) => s + c.activeCount, 0),
        returnedCount: breakdown.reduce((s, c) => s + c.returnedCount, 0),
    }), [breakdown]);

    if (breakdown.length === 0) return null;

    return (
        <div className="premium-card border-none shadow-premium bg-white overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                        <BookOpen size={14} className="text-brand-teal" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-black text-slate-900 tracking-tight">Course-wise Deposit Breakdown</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{breakdown.length} courses · {totals.studentCount} students · PKR {formatPKR(totals.totalCollected)} collected</p>
                    </div>
                </div>
                <div className={cn("w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 transition-transform", isOpen && "rotate-180")}>
                    <ChevronDown size={14} />
                </div>
            </button>

            {isOpen && (
                <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80">
                                <th className="px-6 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest">Course</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Students</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Collected (PKR)</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Refunded (PKR)</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Net (PKR)</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Active/Returned</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {breakdown.map((course) => (
                                <tr key={course.courseId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-3.5">
                                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{course.courseName}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className="text-xs font-black text-slate-800">{course.studentCount}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className="text-xs font-black text-emerald-600">{formatPKR(course.totalCollected)}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className={cn(
                                            "text-xs font-black",
                                            course.totalRefunded > 0 ? "text-rose-600" : "text-slate-400"
                                        )}>
                                            {course.totalRefunded > 0 ? formatPKR(course.totalRefunded) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className={cn(
                                            "text-xs font-black",
                                            (course.totalCollected - course.totalRefunded) > 0 ? "text-blue-600" : "text-slate-400"
                                        )}>
                                            {formatPKR(course.totalCollected - course.totalRefunded)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className="text-[10px] font-black text-slate-700">
                                            {course.activeCount}/{course.returnedCount}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-900 text-white">
                                <td className="px-6 py-3.5">
                                    <span className="text-xs font-black uppercase tracking-widest">Total</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-black">{totals.studentCount}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-black text-emerald-400">{formatPKR(totals.totalCollected)}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className={cn("text-xs font-black", totals.totalRefunded > 0 ? "text-rose-400" : "text-slate-500")}>
                                        {totals.totalRefunded > 0 ? formatPKR(totals.totalRefunded) : '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-black text-brand-teal">{formatPKR(totals.totalCollected - totals.totalRefunded)}</span>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                    <span className="text-xs font-black">{totals.activeCount}/{totals.returnedCount}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});
