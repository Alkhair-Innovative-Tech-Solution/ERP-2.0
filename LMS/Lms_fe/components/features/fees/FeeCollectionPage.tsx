'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { Receipt, Search, CheckCircle, Loader2, User, Calendar, Filter, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import TodaySummaryCard from './TodaySummaryCard';
import ReceiptDocument from './ReceiptDocument';

export default function FeeCollectionPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Receipt
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => { fetchRecords(); }, [currentPage, statusFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const data = await feeAPI.getFeeRecords({
        page: currentPage, limit: 50,
        payment_status: statusFilter || undefined,
        search: search || undefined,
        organization_id: orgId,
      });
      setRecords(data.items || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load fee records'); }
    finally { setLoading(false); }
  };

  const openReceipt = async (recordId: string) => {
    setReceiptLoading(true);
    try {
      const data = await feeAPI.getReceiptData(recordId);
      setReceiptData(data);
    } catch { toast.error('Failed to load receipt'); }
    finally { setReceiptLoading(false); }
  };

  const statusColors: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    pending: 'bg-amber-50 text-amber-600 border-amber-200',
    overdue: 'bg-rose-50 text-rose-600 border-rose-200',
    partial: 'bg-blue-50 text-blue-600 border-blue-200',
    waived: 'bg-slate-50 text-slate-400 border-slate-200',
  };

  const formatMonth = (m: string) => {
    const d = new Date(m + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Receipt className="w-7 h-7 text-brand-teal" /> Fee Collection
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">View fee records and generate receipts</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="text-brand-teal font-black">{total}</span> records
        </div>
      </div>

      {/* Today's Summary */}
      <TodaySummaryCard />

      {/* Filters */}
      <div className="premium-card p-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-brand-teal" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-brand-teal">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial</option>
          <option value="waived">Waived</option>
        </select>
        <button onClick={fetchRecords} className="px-4 py-2.5 bg-brand-teal text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-teal/90 transition-all">
          <Filter size={14} className="inline mr-1" /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-teal" /></div>
      ) : records.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No fee records</p>
          <p className="text-slate-400 font-medium mt-1">Generate monthly fees first</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Course</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount Due</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-teal/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={14} /></div>
                        <div>
                          <p className="text-xs font-black text-slate-900 truncate max-w-[150px]">{r.student_name || 'Unknown'}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{r.student_id?.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-700">{r.course_name}</p>
                      {r.section_label && <p className="text-[9px] text-slate-400">{r.section_label}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <Calendar size={12} className="text-brand-teal" />{formatMonth(r.fee_month)}
                        {r.fee_type === 'full' && <span className="text-[8px] font-black text-brand-teal ml-1">FULL</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-black text-slate-900">PKR {r.amount_due?.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className={cn("text-sm font-black", r.amount_paid > 0 ? "text-emerald-500" : "text-slate-300")}>PKR {r.amount_paid?.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-600">{new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-full border", statusColors[r.payment_status] || "bg-slate-100 text-slate-500")}>{r.payment_status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openReceipt(r.id)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                        <Printer size={12} className="inline mr-1" /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-200 transition-all">Prev</button>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-200 transition-all">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" /></div>
        </div>
      )}
      {receiptData && !receiptLoading && (
        <ReceiptDocument data={receiptData} onClose={() => { setReceiptData(null); }} />
      )}
    </div>
  );
}
