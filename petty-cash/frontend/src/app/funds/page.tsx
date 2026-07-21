'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getAllCashFunds, getFundTypes, getFundTransfers, createFundTransfer, executeFundTransfer, updateCashFundById } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Wallet, AlertTriangle, Building2, TrendingUp, Calendar, Tag, ArrowRightLeft, ArrowRight, X, CheckCircle, Loader } from 'lucide-react'

export default function FundsPage() {
  const { isAccountsHead, isFinanceHead } = useAuth()
  const [funds, setFunds] = useState<any[]>([])
  const [fundTypes, setFundTypes] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, reset, watch } = useForm()

  const canManage = isAccountsHead || isFinanceHead
  const canExecute = isFinanceHead
  const sourceFundId = watch('source_fund')
  const selectedSource = Array.isArray(funds) ? funds.find(f => f.id === Number(sourceFundId)) : null

  const fetchAll = async () => {
    const [fundRes, ftRes, transferRes] = await Promise.all([
      getAllCashFunds(),
      getFundTypes(),
      getFundTransfers(),
    ])
    setFunds(fundRes.data.results || fundRes.data)
    setFundTypes(ftRes.data.results || ftRes.data)
    setTransfers(transferRes.data.results || transferRes.data)
  }

  useEffect(() => {
    if (!canManage) { setLoading(false); return }
    fetchAll().finally(() => setLoading(false))
  }, [])

  const onSubmitTransfer = async (data: any) => {
    if (data.source_fund === data.destination_fund) {
      return toast.error('Source and destination must be different')
    }
    setSubmitting(true)
    try {
      await createFundTransfer({
        source_fund: data.source_fund,
        destination_fund: data.destination_fund,
        amount: data.amount,
        reason: data.reason || '',
      })
      toast.success('Transfer request created')
      reset(); setShowTransferModal(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create transfer')
    } finally { setSubmitting(false) }
  }

  const handleExecute = async (id: number) => {
    try {
      await executeFundTransfer(id)
      toast.success('Transfer executed')
      fetchAll()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to execute transfer')
    }
  }

  if (!canManage) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Wallet size={48} className="mx-auto text-navy-300 mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">Access Restricted</h2>
          <p className="text-sm text-navy-400 mt-1">Only Finance Head and Accounts Head can view this page.</p>
        </div>
      </AppLayout>
    )
  }

  const fundList = Array.isArray(funds) ? funds : []
  const totalBalance = fundList.reduce((s: number, f: any) => s + Number(f.current_balance), 0)
  const lowFunds = fundList.filter((f: any) => f.is_low)
  const activeFunds = fundList.filter((f: any) => f.status === 'active')
  const pendingTransfers = Array.isArray(transfers) ? transfers.filter(t => t.status === 'pending') : []

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Fund Management</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Overview of all cash funds across branches</p>
          </div>
          <button onClick={() => setShowTransferModal(true)} className="btn-primary flex items-center justify-center gap-2 self-start sm:self-auto text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
            <ArrowRightLeft size={15} /> Transfer Funds
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 bg-gradient-to-br from-blue-50 to-white">
            <p className="text-xs text-navy-400 font-medium mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-navy-900">PKR {totalBalance.toLocaleString()}</p>
            <p className="text-xs text-navy-400 mt-1">{activeFunds.length} active funds</p>
          </div>
          <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white">
            <p className="text-xs text-navy-400 font-medium mb-1">Fund Types</p>
            <p className="text-2xl font-bold text-navy-900">{fundTypes.length}</p>
            <p className="text-xs text-navy-400 mt-1">Configured fund categories</p>
          </div>
          <div className="card p-5 bg-gradient-to-br from-amber-50 to-white">
            <p className="text-xs text-navy-400 font-medium mb-1">Low Balance Alerts</p>
            <p className={`text-2xl font-bold ${lowFunds.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{lowFunds.length}</p>
            <p className="text-xs text-navy-400 mt-1">Funds below threshold</p>
          </div>
          <div className="card p-5 bg-gradient-to-br from-purple-50 to-white">
            <p className="text-xs text-navy-400 font-medium mb-1">Pending Transfers</p>
            <p className={`text-2xl font-bold ${pendingTransfers.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{pendingTransfers.length}</p>
            <p className="text-xs text-navy-400 mt-1">Awaiting execution</p>
          </div>
        </div>

        {/* Fund Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fundTypes.map((ft: any) => (
            <div key={ft.id} className="card p-4 card-hover">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={14} className="text-emerald-500" />
                <span className="text-sm font-semibold text-navy-900">{ft.name}</span>
                <span className="text-[10px] text-navy-400 ml-auto">{ft.fund_count} funds</span>
              </div>
              <p className="text-xs text-navy-400">{ft.description}</p>
            </div>
          ))}
        </div>

        {/* Fund Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-white to-navy-50/30">
            <h2 className="text-sm font-semibold text-navy-900">All Funds</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="responsive-table">
              <thead>
                <tr className="border-b border-navy-100/60 bg-navy-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Fund Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Program</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Annual Budget</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Status</th>
                  {canExecute && <th className="px-4 py-3 text-xs font-semibold text-navy-500 uppercase" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(canExecute ? 7 : 6)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-navy-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : funds.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-navy-400">No funds found</td></tr>
                ) : funds.map((fund: any) => (
                  <tr key={fund.id} className="hover:bg-navy-50/40 transition-colors">
                    <td data-label="Branch" className="px-4 py-3.5 text-navy-900 font-medium">{fund.branch_name || 'Unassigned'}</td>
                    <td data-label="Fund Type" className="px-4 py-3.5">
                      <span className="badge-navy">{fund.fund_type_name || 'N/A'}</span>
                      <span className="text-[10px] text-navy-400 ml-1.5">{fund.fund_type_display}</span>
                    </td>
                    <td data-label="Program" className="px-4 py-3.5 text-navy-500 text-xs">{fund.program_tag || '—'}</td>
                    <td data-label="Balance" className="px-4 py-3.5 text-right">
                      <span className={`font-bold ${fund.is_low ? 'text-red-500' : 'text-navy-900'}`}>
                        PKR {Number(fund.current_balance).toLocaleString()}
                      </span>
                      {fund.is_low && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                    </td>
                    <td data-label="Budget" className="px-4 py-3.5 text-right text-navy-500">
                      {fund.annual_budget ? `PKR ${Number(fund.annual_budget).toLocaleString()}` : '—'}
                    </td>
                    <td data-label="Status" className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${fund.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          fund.status === 'suspended' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-navy-50 text-navy-500 border border-navy-200'}`}>
                        {fund.status_display}
                      </span>
                    </td>
                    {canExecute && (
                      <td data-label="" className="px-4 py-3.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {fund.status === 'active' && (
                            <>
                              <button onClick={async () => {
                                try { await updateCashFundById(fund.id, { status: 'suspended' }); toast.success('Fund suspended'); fetchAll() }
                                catch { toast.error('Failed to suspend') }
                              }} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Suspend</button>
                              <button onClick={async () => {
                                try { await updateCashFundById(fund.id, { status: 'archived' }); toast.success('Fund archived'); fetchAll() }
                                catch { toast.error('Failed to archive') }
                              }} className="text-xs text-navy-400 hover:text-red-600 font-medium">Archive</button>
                            </>
                          )}
                          {fund.status === 'suspended' && (
                            <button onClick={async () => {
                              try { await updateCashFundById(fund.id, { status: 'active' }); toast.success('Fund reactivated'); fetchAll() }
                              catch { toast.error('Failed to reactivate') }
                            }} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Reactivate</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer History */}
        {transfers.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-white to-navy-50/30">
              <h2 className="text-sm font-semibold text-navy-900">Transfer History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-navy-100/60 bg-navy-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">From</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">To</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Reason</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {transfers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-navy-50/40 transition-colors">
                      <td data-label="Date" className="px-4 py-3.5 text-navy-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td data-label="From" className="px-4 py-3.5 text-navy-900 font-medium text-xs">{t.source_fund_name}</td>
                      <td data-label="To" className="px-4 py-3.5 text-navy-900 font-medium text-xs">{t.destination_fund_name}</td>
                      <td data-label="Amount" className="px-4 py-3.5 text-right font-bold text-navy-900">PKR {Number(t.amount).toLocaleString()}</td>
                      <td data-label="Reason" className="px-4 py-3.5 text-navy-400 text-xs">{t.reason || '—'}</td>
                      <td data-label="Status" className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                          ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            t.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-red-50 text-red-700 border border-red-200'}`}>
                          {t.status_display}
                        </span>
                      </td>
                      <td data-label="" className="px-4 py-3.5 text-right">
                        {t.status === 'pending' && canExecute && (
                          <button onClick={() => handleExecute(t.id)}
                            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 ml-auto">
                            <CheckCircle size={13} /> Execute
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
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">Transfer Between Funds</h2>
              <button onClick={() => { setShowTransferModal(false); reset() }} className="text-navy-400 hover:text-navy-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmitTransfer)} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="label">Source Fund *</label>
                <select className="select" {...register('source_fund', { required: true })}>
                  <option value="">Select source fund...</option>
                  {funds.filter(f => f.status === 'active').map(f => (
                    <option key={f.id} value={f.id}>
                      {f.branch_name || 'Unassigned'} — PKR {Number(f.current_balance).toLocaleString()}
                    </option>
                  ))}
                </select>
                {selectedSource && (
                  <p className="text-xs text-navy-400 mt-1">Balance: PKR {Number(selectedSource.current_balance).toLocaleString()}</p>
                )}
              </div>
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <ArrowRight size={16} className="text-emerald-500" />
                </div>
              </div>
              <div>
                <label className="label">Destination Fund *</label>
                <select className="select" {...register('destination_fund', { required: true })}>
                  <option value="">Select destination fund...</option>
                  {funds.filter(f => f.status === 'active').map(f => (
                    <option key={f.id} value={f.id}>
                      {f.branch_name || 'Unassigned'} — PKR {Number(f.current_balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount (PKR) *</label>
                <input type="number" step="0.01" min="1" className="input" placeholder="0.00"
                  {...register('amount', { required: true, min: 1 })} />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea className="input resize-none" rows={2} placeholder="Why is this transfer needed?"
                  {...register('reason')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowTransferModal(false); reset() }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
