'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { Receipt, Search, Loader2, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function AccountsOfficerFeesPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
    } catch { toast.error('Failed to load fee records'); }
    finally { setLoading(false); }
  };

  const statusColors: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-600',
    pending: 'bg-amber-50 text-amber-600',
    overdue: 'bg-rose-50 text-rose-600',
    partial: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Receipt className="w-7 h-7 text-brand-teal" /> Fee Collection
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">View and manage student fee records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="premium-card p-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search students..." value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        </div>
      ) : records.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No fee records found</p>
        </div>
      ) : (
        <div className="premium-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{r.student_id?.slice(0, 8)}...</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600">{r.invoice_number || '—'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600">{r.fee_month} / {r.fee_year || ''}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-900">PKR {r.amount_due?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-500">PKR {r.amount_paid?.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded", statusColors[r.payment_status] || 'bg-slate-100 text-slate-400')}>
                      {r.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
