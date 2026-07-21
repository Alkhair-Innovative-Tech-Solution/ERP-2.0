'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { DollarSign, CheckCircle, XCircle, Loader2, Eye, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function AccountsOfficerPaymentsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await feeAPI.getPendingTransactions();
      setTransactions(data || []);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  const handleVerify = async (txnId: string, approved: boolean) => {
    try {
      await feeAPI.verifyTransaction(txnId, approved);
      toast.success(approved ? 'Payment approved' : 'Payment rejected');
      fetchTransactions();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to verify');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-brand-teal" /> Payment Verification
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Review and verify bank transfer payments</p>
      </div>

      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <CheckCircle className="w-16 h-16 mx-auto text-emerald-200 mb-4" />
          <p className="text-xl font-black text-slate-900">All clear!</p>
          <p className="text-slate-400 font-medium mt-1">No pending payment verifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((txn) => (
            <div key={txn.id} className="premium-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Transaction: {txn.transaction_id}</p>
                      <p className="text-xs text-slate-400 font-bold">PKR {txn.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                  {txn.screenshot && (
                    <button onClick={() => { setSelectedTxn(txn); setShowModal(true); }}
                      className="mt-3 flex items-center gap-1 text-xs font-bold text-brand-teal hover:underline">
                      <Eye size={14} /> View Screenshot
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleVerify(txn.id, true)}
                    className="flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs transition-all">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button onClick={() => handleVerify(txn.id, false)}
                    className="flex items-center gap-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-xs transition-all">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot Modal */}
      {showModal && selectedTxn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8">
            <h2 className="text-xl font-black text-slate-900 mb-4">Payment Screenshot</h2>
            {selectedTxn.screenshot && (
              <img src={selectedTxn.screenshot} alt="Payment screenshot" className="w-full rounded-xl" />
            )}
            <button onClick={() => setShowModal(false)}
              className="mt-4 w-full px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
