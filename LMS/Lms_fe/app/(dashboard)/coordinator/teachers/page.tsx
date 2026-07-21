'use client';

import { useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { 
  Check, X, Clock, AlertCircle, 
  Search, Calendar, Filter, ShieldCheck, 
  RefreshCw, MoreHorizontal,
  TrendingUp, Activity, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function TeacherAttendancePage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAttendance = async (selectedDate: string) => {
    try {
      setLoading(true);
      const res = await authAPI.getTeacherAttendance(selectedDate);
      setTeachers(res.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(date);
  }, [date]);

  const markAttendance = async (teacherId: string, status: string) => {
    try {
      // Optically update frontend immediately
      setTeachers(prev => prev.map(t => 
        t.teacher_id === teacherId ? { ...t, status } : t
      ));
      
      await authAPI.markTeacherAttendance(teacherId, date, status, "");
    } catch (e) {
      console.error(e);
      alert('Failed to mark attendance');
      // Reload on failure
      loadAttendance(date);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.specialization && t.specialization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const { sortedData, sortConfig, requestSort } = useSortableData(filteredTeachers);

  const stats = [
    { label: 'Present Today', val: teachers.filter(t => t.status === 'PRESENT').length, icon: ShieldCheck, color: 'emerald' },
    { label: 'Late Arrival', val: teachers.filter(t => t.status === 'LATE').length, icon: Clock, color: 'amber' },
    { label: 'Absent Personnel', val: teachers.filter(t => t.status === 'ABSENT').length, icon: X, color: 'rose' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* â”€â”€ Header Area â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <UserCheck className="w-7 h-7 text-brand-teal" />
            Teacher Attendance
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Mark and monitor daily attendance patterns for the instructional faculty.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-teal z-10" />
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all cursor-pointer shadow-sm"
              />
           </div>
           <Button onClick={() => loadAttendance(date)} variant="outline" className="rounded-2xl border-slate-200 h-12 px-5 font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
           </Button>
        </div>
      </div>

      {/* â”€â”€ Intelligence Recap â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="premium-card p-6 flex items-center gap-6 group relative overflow-hidden">
             <div className={cn(
               "p-4 rounded-2xl transition-all duration-500 group-hover:rotate-6 shadow-sm",
               stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
               stat.color === 'amber' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
             )}>
                <stat.icon size={24} strokeWidth={2.5} />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stat.val} <span className="text-xs font-bold text-slate-400">Instructors</span></h3>
             </div>
             <div className={cn(
               "absolute -right-2 -top-2 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
               stat.color === 'emerald' ? "bg-emerald-500" : stat.color === 'amber' ? "bg-amber-500" : "bg-rose-500"
             )} />
          </div>
        ))}
      </div>

      {/* â”€â”€ Checklist Container â”€â”€ */}
      <div className="premium-card overflow-hidden flex flex-col border-white/40">
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
              <input 
                type="text"
                placeholder="Seek Instructor or Department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-100/50 border-none rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all"
              />
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{filteredTeachers.length} Personnel Found</span>
              <Button variant="ghost" className="rounded-xl text-slate-400 hover:text-blue-600"><Filter size={18} /></Button>
           </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[600px] no-scrollbar">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
               <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin" />
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Marking Station Loading...</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
                  <SortableTableHeader label="Personnel Intel" sortKey="teacher_name" currentSort={sortConfig} onSort={requestSort} />
                  <SortableTableHeader label="Department" sortKey="specialization" currentSort={sortConfig} onSort={requestSort} />
                  <SortableTableHeader label="Current Vector (Status)" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                  <th className="p-6 pr-8 text-right border-b border-slate-100">Shift Authorization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map(t => (
                  <tr key={t.teacher_id} className="group hover:bg-blue-50/50 transition-all">
                    <td className="p-6 pl-8">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-teal to-emerald-600 p-0.5 shadow-lg group-hover:scale-110 transition-transform duration-500">
                            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-brand-teal font-black text-sm">
                               {t.teacher_name?.[0] || 'T'}
                            </div>
                         </div>
                         <div>
                            <p className="font-black text-slate-900 tracking-tight leading-tight group-hover:text-brand-teal transition-colors">{t.teacher_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: faculty-{t.teacher_id.slice(-6)}</p>
                         </div>
                      </div>
                    </td>
                    <td className="p-6">
                       <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {t.specialization || 'General Faculty'}
                       </span>
                    </td>
                    <td className="p-6">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                        t.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                        t.status === 'ABSENT' ? 'bg-rose-100 text-rose-700' :
                        t.status === 'LATE' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      )}>
                        {t.status === 'PRESENT' && <Check size={12} strokeWidth={3} />}
                        {t.status === 'ABSENT' && <X size={12} strokeWidth={3} />}
                        {t.status === 'LATE' && <Clock size={12} strokeWidth={3} />}
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-6 pr-8 text-right">
                       <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => markAttendance(t.teacher_id, 'PRESENT')} 
                            title="Mark Present"
                            className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          >
                             <Check className="w-5 h-5" strokeWidth={3} />
                          </button>
                          <button 
                            onClick={() => markAttendance(t.teacher_id, 'LATE')} 
                            title="Mark Late"
                            className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          >
                             <Clock className="w-5 h-5" strokeWidth={3} />
                          </button>
                          <button 
                            onClick={() => markAttendance(t.teacher_id, 'ABSENT')} 
                            title="Mark Absent"
                            className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          >
                             <X className="w-5 h-5" strokeWidth={3} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center">
                       <div className="flex flex-col items-center gap-4 text-slate-300">
                          <UserPlus size={48} strokeWidth={1} />
                          <p className="text-sm font-black uppercase tracking-widest">Registry Vacuum: No Personnel Found</p>
                       </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
