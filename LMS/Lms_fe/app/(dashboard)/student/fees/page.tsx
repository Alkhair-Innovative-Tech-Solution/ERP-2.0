'use client';

import { useState, useEffect } from 'react';
import {
  Wallet, CheckCircle, Clock, AlertTriangle, XCircle,
  BookOpen, Calendar, DollarSign, Receipt, ChevronDown,
  Banknote, TrendingUp, Ban, Loader2, Printer
} from 'lucide-react';
import { feeAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import ReceiptDocument from '@/components/features/fees/ReceiptDocument';

interface FeeRecord {
  id: string;
  course_name: string;
  section_label?: string;
  fee_month: string;
  amount_due: number;
  amount_paid: number;
  outstanding_balance: number;
  due_date: string;
  payment_status: string;
  paid_date?: string;
  collected_by_name?: string;
  transactions: any[];
}

interface FeeSummary {
  total_due: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  total_waived: number;
  overdue_count: number;
  pending_count: number;
  paid_count: number;
  collection_rate: number;
}

export default function StudentFeesPage() {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    fetchFees();
  }, []);

  const openReceipt = async (recordId: string) => {
    setReceiptLoading(true);
    try {
      const data = await feeAPI.getReceiptData(recordId);
      setReceiptData(data);
    } catch { console.error('Failed to load receipt'); }
    finally { setReceiptLoading(false); }
  };

  const fetchFees = async () => {
    try {
      setLoading(true);
      const data = await feeAPI.getMyFees();
      setSummary(data.summary);
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (err) {
      console.error('Failed to fetch fees:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedByCourse = records.reduce<Record<string, FeeRecord[]>>((acc, r) => {
    const key = r.course_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const formatMonth = (m: string) => {
    const d = new Date(m + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest"><CheckCircle className="w-3 h-3" /> Paid</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[9px] font-black uppercase tracking-widest"><Clock className="w-3 h-3" /> Pending</span>;
      case 'overdue':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black uppercase tracking-widest"><AlertTriangle className="w-3 h-3" /> Overdue</span>;
      case 'partial':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-[9px] font-black uppercase tracking-widest"><Clock className="w-3 h-3" /> Partial</span>;
      case 'waived':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest"><Ban className="w-3 h-3" /> Waived</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Wallet className="w-7 h-7 text-brand-teal" />
          My Fees
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Track your fee payments and outstanding balances</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg"><Wallet className="w-4 h-4 text-indigo-600" /></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Due</span>
            </div>
            <p className="text-2xl font-black text-slate-900">PKR {summary.total_due.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-4 h-4 text-green-600" /></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Paid</span>
            </div>
            <p className="text-2xl font-black text-green-600">PKR {summary.total_paid.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-yellow-50 rounded-lg"><Clock className="w-4 h-4 text-yellow-600" /></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending</span>
            </div>
            <p className="text-2xl font-black text-yellow-600">PKR {summary.total_pending.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Overdue</span>
            </div>
            <p className="text-2xl font-black text-red-600">PKR {summary.total_overdue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* No records */}
      {records.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-black">No fee records found</p>
          <p className="text-sm mt-1">Fee records will appear here once your courses are enrolled and fees are generated.</p>
        </div>
      ) : (
        /* Records grouped by course */
        <div className="space-y-6">
          {Object.entries(groupedByCourse).map(([courseName, courseRecords]) => (
            <div key={courseName} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedCourse(expandedCourse === courseName ? null : courseName)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <div className="text-left">
                    <h3 className="text-sm font-black text-slate-800">{courseName}</h3>
                    <p className="text-[10px] text-slate-400">{courseRecords.length} month{courseRecords.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expandedCourse === courseName && "rotate-180")} />
              </button>
              {expandedCourse === courseName && (
                <div className="overflow-x-auto border-t border-slate-50">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="text-left px-5 py-3">Month</th>
                        <th className="text-right px-4 py-3">Amount Due</th>
                        <th className="text-right px-4 py-3">Amount Paid</th>
                        <th className="text-right px-4 py-3">Outstanding</th>
                        <th className="text-center px-4 py-3">Status</th>
                        <th className="text-center px-4 py-3">Paid On</th>
                        <th className="text-center px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseRecords.map((r) => (
                        <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-bold text-slate-800">{formatMonth(r.fee_month)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-bold text-slate-800">PKR {r.amount_due.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={cn("text-sm font-bold", r.amount_paid > 0 ? 'text-green-600' : 'text-slate-400')}>
                              {r.amount_paid > 0 ? `PKR ${r.amount_paid.toLocaleString()}` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={cn("text-sm font-bold", r.outstanding_balance > 0 ? 'text-red-500' : 'text-green-600')}>
                              {r.outstanding_balance > 0 ? `PKR ${r.outstanding_balance.toLocaleString()}` : 'PKR 0'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {statusBadge(r.payment_status)}
                          </td>
                          <td className="px-4 py-3.5 text-center text-xs text-slate-500">
                            {r.paid_date ? new Date(r.paid_date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {(r.payment_status === 'paid' || r.payment_status === 'waived') ? (
                              <button onClick={() => openReceipt(r.id)} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-100 transition-all">
                                <Printer size={11} className="inline mr-0.5" /> Receipt
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Collection Rate */}
      {summary && records.length > 0 && (
        <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Overall Payment Rate</span>
            </div>
            <span className="text-2xl font-black text-indigo-600">{summary.collection_rate}%</span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-2.5">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(summary.collection_rate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-indigo-500 font-bold">
            <span>{summary.paid_count} months paid</span>
            <span>{summary.pending_count + summary.overdue_count} months pending</span>
          </div>
        </div>
      )}
      {/* Receipt Modal */}
      {receiptLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></div>
        </div>
      )}
      {receiptData && !receiptLoading && (
        <ReceiptDocument data={receiptData} onClose={() => { setReceiptData(null); }} />
      )}
    </div>
  );
}
