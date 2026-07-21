'use client';

import { useState, useEffect } from 'react';
import { feeAPI, userAPI } from '@/lib/api';
import {
  Receipt, Search, DollarSign, CheckCircle, AlertCircle, Clock,
  Loader2, User, Calendar, Filter, IdCard, CreditCard, Percent,
  Banknote, BookOpen, Users, X, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import TodaySummaryCard from '@/components/features/fees/TodaySummaryCard';
import ReceiptDocument from '@/components/features/fees/ReceiptDocument';

export default function FeeCollectionPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [user, setUser] = useState<any>(null);

  // Student Lookup
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Payment Modal
  const [payModal, setPayModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [paying, setPaying] = useState(false);

  // Full Payment Modal
  const [fullPayModal, setFullPayModal] = useState<{
    student: any; enrollment: any; feeStructure?: any;
  } | null>(null);
  const [fpMethod, setFpMethod] = useState('cash');
  const [fpRef, setFpRef] = useState('');
  const [fpDiscountType, setFpDiscountType] = useState<string>('');
  const [fpDiscountValue, setFpDiscountValue] = useState(0);
  const [fpRemarks, setFpRemarks] = useState('');
  const [fpProcessing, setFpProcessing] = useState(false);

  // Receipt Modal
  const [receiptModal, setReceiptModal] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('lms_user') || '{}');
    setUser(u);
  }, []);

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

  const handleLookup = async () => {
    if (!lookupId.trim()) { toast.error('Enter a Student ID'); return; }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await feeAPI.lookupStudent(lookupId.trim());
      setLookupResult(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Student not found');
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePay = async () => {
    if (!payModal || payAmount <= 0) { toast.error('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await feeAPI.recordPayment(payModal.id, {
        amount: payAmount, payment_method: payMethod,
        transaction_reference: payRef || undefined,
        received_by_id: user?.id, received_by_name: user?.full_name,
        remarks: payRemarks || undefined,
      });
      toast.success('Payment recorded successfully');
      setPayModal(null); setPayAmount(0); setPayRef(''); setPayRemarks('');
      fetchRecords();
      handleLookup();
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Payment failed'); }
    finally { setPaying(false); }
  };

  const handleFullPay = async () => {
    if (!fullPayModal) return;
    setFpProcessing(true);
    try {
      await feeAPI.recordFullPayment({
        student_id: fullPayModal.student.id,
        course_id: fullPayModal.enrollment.course_id,
        scheduled_class_id: fullPayModal.enrollment.scheduled_class_id || undefined,
        payment_method: fpMethod,
        transaction_reference: fpRef || undefined,
        received_by_id: user?.id,
        received_by_name: user?.full_name,
        discount_type: fpDiscountType || undefined,
        discount_value: fpDiscountValue > 0 ? fpDiscountValue : undefined,
        remarks: fpRemarks || undefined,
      });
      toast.success('Full payment recorded successfully');
      setFullPayModal(null);
      setFpMethod('cash'); setFpRef(''); setFpDiscountType(''); setFpDiscountValue(0); setFpRemarks('');
      handleLookup();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Payment failed');
    } finally {
      setFpProcessing(false);
    }
  };

  const handleWaive = async (record: any) => {
    if (!confirm('Waive this fee record?')) return;
    try { await feeAPI.waiveFee(record.id); toast.success('Fee waived'); fetchRecords(); }
    catch (error: any) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const openReceipt = async (recordId: string) => {
    setReceiptLoading(true);
    setReceiptModal(recordId);
    try {
      const data = await feeAPI.getReceiptData(recordId);
      setReceiptData(data);
    } catch {
      toast.error('Failed to load receipt');
      setReceiptModal(null);
    } finally {
      setReceiptLoading(false);
    }
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

  const calcFullAmount = (enrollment: any) => {
    const monthlyFee = lookupResult?.pending_fees?.find((f: any) =>
      f.course_id === enrollment.course_id
    )?.amount_due || 0;
    const duration = enrollment.course_duration || 6;
    return monthlyFee * duration;
  };

  // Track which section to show
  const [activeSection, setActiveSection] = useState<'lookup' | 'all'>('lookup');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Receipt className="w-7 h-7 text-brand-teal" /> Fee Collection
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Collect and track student fees</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveSection('lookup')}
          className={cn(
            "px-4 py-2 text-xs font-black rounded-t-lg transition-all",
            activeSection === 'lookup'
              ? "bg-brand-teal text-white"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <IdCard size={14} className="inline mr-1.5" /> Student Lookup
        </button>
        <button
          onClick={() => setActiveSection('all')}
          className={cn(
            "px-4 py-2 text-xs font-black rounded-t-lg transition-all",
            activeSection === 'all'
              ? "bg-brand-teal text-white"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Receipt size={14} className="inline mr-1.5" /> All Records
        </button>
      </div>

      {activeSection === 'lookup' ? (
        <>
          {/* Student ID Lookup */}
          <div className="premium-card p-5">
            <h2 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <IdCard className="w-4 h-4 text-brand-teal" />
              Find Student by ID Card Number
            </h2>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="Enter student ID (e.g., AIT-PH-2026-WD-1-0001)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-brand-teal"
                />
              </div>
              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="px-6 py-3 bg-brand-teal text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-teal/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {lookupLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Lookup Result */}
          {lookupResult && (
            <div className="space-y-4">
              {/* Student Info Card */}
              <div className="premium-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-brand-teal/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-brand-teal" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{lookupResult.full_name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-xs font-bold text-slate-400">ID: {lookupResult.student_id || 'N/A'}</span>
                        <span className="text-xs font-bold text-slate-400">Email: {lookupResult.email}</span>
                        {lookupResult.phone && <span className="text-xs font-bold text-slate-400">Phone: {lookupResult.phone}</span>}
                        {lookupResult.cnic && <span className="text-xs font-bold text-slate-400">CNIC: {lookupResult.cnic}</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setLookupResult(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <X size={16} className="text-slate-400" />
                  </button>
                </div>

                {/* Enrolled Courses */}
                {lookupResult.enrollments && lookupResult.enrollments.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Enrolled Courses</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {lookupResult.enrollments.map((enr: any) => {
                        const fullAmount = calcFullAmount(enr);
                        return (
                          <div key={enr.enrollment_id} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen size={14} className="text-brand-teal" />
                              <p className="text-sm font-black text-slate-900">{enr.course_name}</p>
                            </div>
                            {enr.section_label && (
                              <p className="text-[10px] font-bold text-slate-400">{enr.section_label} {enr.branch_name ? `(${enr.branch_name})` : ''}</p>
                            )}
                            <p className="text-[10px] font-bold text-slate-400">Duration: {enr.course_duration} months</p>
                            <p className="text-[10px] font-bold text-slate-400">Full Amount: PKR {fullAmount.toLocaleString()}</p>
                            <button
                              onClick={() => setFullPayModal({ student: lookupResult, enrollment: enr })}
                              className="mt-3 w-full px-3 py-2 bg-brand-teal/10 text-brand-teal rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-brand-teal/20 transition-all"
                            >
                              <CreditCard size={12} className="inline mr-1" /> Collect Full Payment
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pending Fee Records */}
              {lookupResult.pending_fees && lookupResult.pending_fees.length > 0 && (
                <div className="premium-card overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="text-xs font-black text-slate-900">Fee Records</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/80 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Course</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Due</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Paid</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {lookupResult.pending_fees.map((r: any) => (
                          <tr key={r.id} className="hover:bg-brand-teal/5 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-700">{r.course_name}</p>
                              {r.section_label && <p className="text-[9px] text-slate-400">{r.section_label}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <Calendar size={12} className="text-brand-teal" />{formatMonth(r.fee_month)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full border bg-slate-50 text-slate-500 border-slate-200">
                                {r.fee_type === 'full' ? 'Full Course' : 'Monthly'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-sm font-black text-slate-900">PKR {r.amount_due?.toLocaleString()}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className={cn("text-sm font-black", r.amount_paid > 0 ? "text-emerald-500" : "text-slate-300")}>
                                PKR {r.amount_paid?.toLocaleString()}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "text-[9px] font-black uppercase px-2 py-1 rounded-full border",
                                statusColors[r.payment_status] || "bg-slate-100 text-slate-500"
                              )}>{r.payment_status}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {r.payment_status === 'paid' || r.payment_status === 'waived' ? (
                                <button
                                  onClick={() => openReceipt(r.id)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                  <Printer size={12} className="inline mr-1" /> Receipt
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setPayModal(r); setPayAmount(r.outstanding_balance || r.amount_due); }}
                                  className="px-3 py-1.5 bg-brand-teal text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-brand-teal/90 transition-all"
                                >
                                  Collect
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(!lookupResult.pending_fees || lookupResult.pending_fees.length === 0) && (
                <div className="premium-card p-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
                  <p className="text-lg font-black text-slate-900">No outstanding fees</p>
                  <p className="text-sm text-slate-400 font-medium mt-1">This student has no pending fee records.</p>
                </div>
              )}
            </div>
          )}

          {/* Today's Summary */}
          <TodaySummaryCard />
        </>
      ) : (
        <>
          {/* All Records View */}
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <span className="text-brand-teal font-black">{total}</span> records
          </div>

          {/* Filters */}
          <div className="premium-card p-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, remarks..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-brand-teal"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-brand-teal"
            >
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
              <p className="text-slate-400 font-medium mt-1">Generate monthly fees first, then collect here</p>
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
                          <p className={cn("text-sm font-black", r.amount_paid > 0 ? "text-emerald-500" : "text-slate-300")}>
                            PKR {r.amount_paid?.toLocaleString()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-600">{new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-full border", statusColors[r.payment_status] || "bg-slate-100 text-slate-500")}>{r.payment_status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.payment_status === 'paid' || r.payment_status === 'waived' ? (
                            <button
                              onClick={() => openReceipt(r.id)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                              <Printer size={12} className="inline mr-1" /> Receipt
                            </button>
                          ) : (
                            <button
                              onClick={() => { setPayModal(r); setPayAmount(r.outstanding_balance || r.amount_due); }}
                              className="px-3 py-1.5 bg-brand-teal text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-brand-teal/90 transition-all"
                            >
                              Collect
                            </button>
                          )}
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

          {/* Today's Summary */}
          <TodaySummaryCard />
        </>
      )}

      {/* Payment Modal (Monthly) */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-black text-slate-900 mb-2">Collect Fee Payment</h2>
            <p className="text-sm text-slate-400 font-bold mb-6">{payModal.student_name || 'Student'} - {payModal.course_name}</p>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Amount Due</span>
                  <span className="text-slate-900 font-black">PKR {payModal.amount_due?.toLocaleString()}</span>
                </div>
                {payModal.amount_paid > 0 && (
                  <div className="flex justify-between text-xs font-bold text-slate-500 mt-1">
                    <span>Already Paid</span>
                    <span className="text-emerald-500 font-black">PKR {payModal.amount_paid?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 mt-2 pt-2 border-t border-slate-200">
                  <span>Outstanding</span>
                  <span className="text-brand-teal">PKR {(payModal.outstanding_balance || payModal.amount_due)?.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Payment Amount (PKR)</label>
                <input
                  type="number" value={payAmount}
                  onChange={(e) => setPayAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-lg text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Payment Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Transaction Reference (optional)</label>
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Bank ref / cheque no." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Remarks (optional)</label>
                <input type="text" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="Any notes..." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => setPayModal(null)} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">Cancel</button>
              <button onClick={handlePay} disabled={paying || payAmount <= 0} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                {paying && <Loader2 size={14} className="animate-spin" />}
                {paying ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Payment Modal */}
      {fullPayModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-900 mb-2">Full Course Payment</h2>
            <p className="text-sm text-slate-400 font-bold mb-2">{fullPayModal.student.full_name}</p>
            <p className="text-xs font-bold text-brand-teal mb-6">{fullPayModal.enrollment.course_name}</p>

            <div className="space-y-4">
              {/* Amount Calculation */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Duration</span>
                  <span className="text-slate-900 font-black">{fullPayModal.enrollment.course_duration} months</span>
                </div>
                {(() => {
                  const monthlyFee = lookupResult?.pending_fees?.find(
                    (f: any) => f.course_id === fullPayModal.enrollment.course_id
                  )?.amount_due || 0;
                  const total = monthlyFee * (fullPayModal.enrollment.course_duration || 6);
                  return (
                    <>
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Monthly Fee</span>
                        <span className="text-slate-900 font-black">PKR {monthlyFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 pt-1 border-t border-slate-200">
                        <span>Total Full Payment</span>
                        <span className="text-lg font-black text-brand-teal">PKR {total.toLocaleString()}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Discount */}
              <div className="p-4 bg-amber-50 rounded-xl">
                <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 mb-3">
                  <Percent size={12} /> Apply Discount (Optional)
                </h3>
                <div className="flex gap-3">
                  <select
                    value={fpDiscountType}
                    onChange={(e) => setFpDiscountType(e.target.value)}
                    className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="">No Discount</option>
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (PKR)</option>
                  </select>
                  {fpDiscountType && (
                    <input
                      type="number"
                      value={fpDiscountValue || ''}
                      onChange={(e) => setFpDiscountValue(parseInt(e.target.value) || 0)}
                      placeholder={fpDiscountType === 'percent' ? 'e.g. 10' : 'e.g. 5000'}
                      className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
                {fpDiscountType && fpDiscountValue > 0 && (
                  <div className="mt-2 text-xs font-bold text-amber-700">
                    {(() => {
                      const monthlyFee = lookupResult?.pending_fees?.find(
                        (f: any) => f.course_id === fullPayModal.enrollment.course_id
                      )?.amount_due || 0;
                      const total = monthlyFee * (fullPayModal.enrollment.course_duration || 6);
                      const discount = fpDiscountType === 'percent'
                        ? Math.round(total * fpDiscountValue / 100)
                        : Math.min(fpDiscountValue, total);
                      return `Discount: PKR ${discount.toLocaleString()} | Final: PKR ${(total - discount).toLocaleString()}`;
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Payment Method</label>
                <select value={fpMethod} onChange={(e) => setFpMethod(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online Payment</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Transaction Reference (optional)</label>
                <input type="text" value={fpRef} onChange={(e) => setFpRef(e.target.value)} placeholder="Bank ref / cheque no." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Remarks (optional)</label>
                <input type="text" value={fpRemarks} onChange={(e) => setFpRemarks(e.target.value)} placeholder="Any notes..." className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => setFullPayModal(null)}
                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleFullPay}
                disabled={fpProcessing}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {fpProcessing && <Loader2 size={14} className="animate-spin" />}
                {fpProcessing ? 'Processing...' : 'Confirm Full Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal && receiptLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" /></div>
        </div>
      )}
      {receiptData && !receiptLoading && (
        <ReceiptDocument data={receiptData} onClose={() => { setReceiptModal(null); setReceiptData(null); }} />
      )}
    </div>
  );
}
