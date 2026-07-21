'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getReplenishmentRequests, createReplenishmentRequest, getReplenishments, getCashFund } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, Wallet, AlertTriangle, Building2, Clock, CheckCircle, XCircle, Upload, Download, Loader } from 'lucide-react'

export default function ReplenishmentsPage() {
  const { canEdit, isAccountsHead, isFinanceHead } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [completed, setCompleted] = useState<any[]>([])
  const [fund, setFund] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchData = async () => {
    const reqParams: any = {}
    const repParams: any = {}
    if (dateFrom) { reqParams.date_from = dateFrom; repParams.date_from = dateFrom }
    if (dateTo) { reqParams.date_to = dateTo; repParams.date_to = dateTo }
    const [reqRes, repRes, fundRes] = await Promise.all([
      getReplenishmentRequests(reqParams),
      getReplenishments(repParams),
      getCashFund(),
    ])
    setRequests(reqRes.data.results || reqRes.data)
    setCompleted(repRes.data.results || repRes.data)
    setFund(fundRes.data)
  }

  useEffect(() => { fetchData().finally(() => setLoading(false)) }, [])
  useEffect(() => { fetchData() }, [dateFrom, dateTo])

  const onSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      await createReplenishmentRequest({
        amount_requested: data.amount_requested,
        reason: data.reason || '',
        program_tag: data.program_tag || '',
      })
      toast.success('Replenishment request submitted for approval')
      reset(); setShowModal(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit request')
    } finally { setSubmitting(false) }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const approvedRequests = requests.filter(r => r.status === 'approved')

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Replenishments</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Request and manage fund replenishments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <input type="date" className="input text-xs w-32 sm:w-36" title="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="input text-xs w-32 sm:w-36" title="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {canEdit && (
              <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
                <Plus size={15} /> Request
              </button>
            )}
          </div>
        </div>

        {/* Fund status */}
        {fund && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`card p-5 ${fund.is_low ? 'border-amber-200 bg-amber-50' : ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2.5 rounded-xl ${fund.is_low ? 'bg-amber-100' : 'bg-blue-50'}`}>
                  {fund.is_low ? <AlertTriangle size={18} className="text-amber-500" /> : <Wallet size={18} className="text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm text-navy-400">Current Balance</p>
                </div>
              </div>
              <p className={`text-2xl font-bold ${fund.is_low ? 'text-amber-600' : 'text-navy-900'}`}>
                PKR {Number(fund.current_balance).toLocaleString()}
              </p>
              {fund.is_low && (
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  Below threshold of PKR {Number(fund.low_balance_threshold).toLocaleString()}
                </p>
              )}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-amber-50">
                  <Clock size={18} className="text-amber-600" />
                </div>
                <p className="text-sm text-navy-400">Pending Requests</p>
              </div>
              <p className={`text-2xl font-bold ${pendingRequests.length > 0 ? 'text-amber-600' : 'text-navy-900'}`}>
                {pendingRequests.length}
              </p>
              <p className="text-xs text-navy-400 mt-1">Awaiting approval</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-50">
                  <CheckCircle size={18} className="text-emerald-600" />
                </div>
                <p className="text-sm text-navy-400">Total Approved</p>
              </div>
              <p className="text-2xl font-bold text-navy-900">{approvedRequests.length}</p>
              <p className="text-xs text-navy-400 mt-1">Approved requests</p>
            </div>
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-amber-50 to-white">
              <h2 className="text-sm font-semibold text-amber-800">Pending Requests</h2>
            </div>
            <div className="divide-y divide-navy-50">
              {pendingRequests.map((r: any) => (
                <div key={r.id} className="px-5 py-4 flex items-center justify-between hover:bg-navy-50/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900">PKR {Number(r.amount_requested).toLocaleString()}</p>
                      {r.req_number && <span className="badge-navy text-[10px]">{r.req_number}</span>}
                    </div>
                    <p className="text-xs text-navy-400 mt-0.5">{r.reason || 'No reason provided'}</p>
                    <div className="flex gap-2 mt-1 text-xs text-navy-400">
                      <span>Requested by {r.requested_by_name}</span>
                      {r.program_tag && <span>· Program: {r.program_tag}</span>}
                      <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="badge-amber">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed History */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-white to-navy-50/30">
            <h2 className="text-sm font-semibold text-navy-900">Replenishment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="responsive-table">
              <thead>
                <tr className="border-b border-navy-100/60 bg-navy-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Donor Fund</th>
                  {isAccountsHead && <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Branch</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Added By</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(isAccountsHead ? 7 : 6)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-navy-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : completed.length === 0 ? (
                  <tr><td colSpan={isAccountsHead ? 7 : 6} className="px-4 py-12 text-center text-navy-400">No replenishments yet</td></tr>
                ) : completed.map((r: any) => (
                  <tr key={r.id} className="hover:bg-navy-50/40 transition-colors">
                    <td data-label="Date" className="px-4 py-3.5 text-navy-500 text-xs">{r.date}</td>
                    <td data-label="Amount" className="px-4 py-3.5 text-emerald-600 font-bold">PKR {Number(r.amount).toLocaleString()}</td>
                    <td data-label="Reference" className="px-4 py-3.5">
                      {r.reference_number ? <span className="badge-navy text-[10px]">{r.reference_number}</span> : <span className="text-navy-400">—</span>}
                    </td>
                    <td data-label="Donor Fund" className="px-4 py-3.5 text-navy-500 text-xs">{r.donor_fund_tag || '—'}</td>
                    {isAccountsHead && <td data-label="Branch" className="px-4 py-3.5 text-navy-500 text-xs">{r.branch_name || '—'}</td>}
                    <td data-label="Added By" className="px-4 py-3.5 text-navy-500 text-xs">{r.added_by_name}</td>
                    <td data-label="Proof" className="px-4 py-3.5 text-center">
                      {r.transfer_proof_url ? (
                        <a href={r.transfer_proof_url} target="_blank" className="text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1 text-xs font-medium">
                          <Upload size={12} /> View
                        </a>
                      ) : <span className="text-navy-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">Request Replenishment</h2>
              <button onClick={() => { setShowModal(false); reset() }} className="text-navy-400 hover:text-navy-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="label">Amount Required (PKR) *</label>
                <input type="number" step="0.01" min="1" className="input" placeholder="0.00"
                  {...register('amount_requested', { required: true, min: 1 })} />
              </div>
              <div>
                <label className="label">Justification / Reason</label>
                <textarea className="input resize-none" rows={3} placeholder="Why is this replenishment needed?"
                  {...register('reason')} />
              </div>
              <div>
                <label className="label">Program Tag</label>
                <input className="input" placeholder="e.g. Education, Health" {...register('program_tag')} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset() }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
