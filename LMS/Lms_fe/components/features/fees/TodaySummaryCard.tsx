'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { Receipt, Users, DollarSign, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TodaySummaryCard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const res = await feeAPI.getTodaySummary(undefined, orgId);
      setData(Array.isArray(res) ? res : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="premium-card p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
      </div>
    );
  }

  const totalPaidToday = data.reduce((sum, c) => sum + c.paid_today, 0);
  const totalCollectedToday = data.reduce((sum, c) => sum + c.total_collected, 0);

  return (
    <div className="premium-card overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-teal" />
            Today's Collection Summary
          </h2>
          <button onClick={fetchSummary} className="text-[9px] font-black text-brand-teal uppercase tracking-widest hover:underline">
            Refresh
          </button>
        </div>
      </div>

      {/* Mini KPI row */}
      <div className="grid grid-cols-3 gap-px bg-slate-100">
        <div className="bg-white p-4 text-center">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Classes</p>
          <p className="text-xl font-black text-slate-900 mt-1">{data.length}</p>
        </div>
        <div className="bg-white p-4 text-center">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Paid Today</p>
          <p className="text-xl font-black text-emerald-500 mt-1">{totalPaidToday}</p>
        </div>
        <div className="bg-white p-4 text-center">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Collected</p>
          <p className="text-xl font-black text-brand-teal mt-1">PKR {totalCollectedToday.toLocaleString()}</p>
        </div>
      </div>

      {/* Class list */}
      {data.length === 0 ? (
        <div className="p-8 text-center">
          <Receipt className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-sm font-black text-slate-400">No active classes with enrollments</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {data.map((cls) => (
            <div key={cls.scheduled_class_id}>
              <button
                onClick={() => setExpanded(expanded === cls.scheduled_class_id ? null : cls.scheduled_class_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{cls.course_name}</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                    Sec {cls.section} {cls.branch_name ? `(${cls.branch_name})` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{cls.paid_today}<span className="text-slate-400 font-bold">/{cls.total_enrolled}</span></p>
                    <p className="text-[9px] text-slate-400 font-bold">paid</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-500">PKR {cls.total_collected?.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-400 font-bold">collected</p>
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    cls.total_enrolled > 0
                      ? (cls.paid_today / cls.total_enrolled) >= 0.8 ? 'bg-emerald-500'
                      : (cls.paid_today / cls.total_enrolled) >= 0.5 ? 'bg-amber-500'
                      : 'bg-rose-400'
                      : 'bg-slate-200'
                  )} />
                  {expanded === cls.scheduled_class_id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </button>
              {expanded === cls.scheduled_class_id && (
                <div className="px-4 pb-4">
                  {cls.students && cls.students.length > 0 ? (
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Students who paid today:</p>
                      {cls.students.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          {s.name || s.id?.slice(0, 8)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] font-bold text-slate-400">No payments recorded today for this class</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-[9px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><Clock size={10} /> {cls.pending_count} pending</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {cls.total_enrolled - cls.paid_today} unpaid</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
