'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getTransactions, createTransaction, voidTransaction, getCategories, getBranches, exportTransactions as downloadTransactions, amendTransaction } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, Upload, Ban, Search, Building2, Receipt, Download, Loader } from 'lucide-react'

interface Transaction {
  id: number; date: string; amount: string; category: number
  category_name: string; description: string; vendor_name: string
  narration: string; payee: string
  program_tag: string; donor_fund_tag: string
  payment_method: string
  has_receipt: boolean; is_void: boolean; entered_by_name: string
  branch: number | null; branch_name: string; created_at: string
  cpv_number?: string
}

interface Category { id: number; name: string; is_allowed: boolean; is_active: boolean }
interface Branch { id: number; name: string; code: string; type_display: string }

export default function ExpensesPage() {
  const { canEdit, isAccountsHead } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voidModal, setVoidModal] = useState<{ id: number; amount: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [amendTarget, setAmendTarget] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [exporting, setExporting] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchTransactions = async () => {
    const params: any = {}
    if (searchTerm) params.search = searchTerm
    if (filterCategory) params.category = filterCategory
    if (filterBranch) params.branch = filterBranch
    if (filterProgram) params.program_tag = filterProgram
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const res = await getTransactions(params)
    setTransactions(res.data.results || res.data)
  }

  useEffect(() => {
    Promise.all([
      fetchTransactions(),
      getCategories().then(r => setCategories(r.data.results || r.data)),
      getBranches().then(r => setBranches(r.data.results || r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchTransactions, 400)
    return () => clearTimeout(t)
  }, [searchTerm, filterCategory, filterBranch, filterProgram, dateFrom, dateTo])

  const onSubmit = async (data: any) => {
    if (!receiptFile) return toast.error('Receipt is mandatory')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('date', data.date)
      fd.append('amount', data.amount)
      fd.append('category', data.category)
      fd.append('description', data.description)
      fd.append('vendor_name', data.vendor_name || '')
      if (data.narration) fd.append('narration', data.narration)
      if (data.payee) fd.append('payee', data.payee)
      if (data.program_tag) fd.append('program_tag', data.program_tag)
      if (data.donor_fund_tag) fd.append('donor_fund_tag', data.donor_fund_tag)
      if (data.payment_method) fd.append('payment_method', data.payment_method)
      fd.append('receipt', receiptFile)
      if (data.branch) fd.append('branch', data.branch)
      await createTransaction(fd)
      toast.success('Expense recorded')
      reset(); setReceiptFile(null); setShowModal(false)
      fetchTransactions()
    } catch (err: any) {
      const errData = err.response?.data
      const msg = typeof errData === 'object'
        ? Object.values(errData).flat().join(', ')
        : 'Failed to add expense'
      toast.error(msg)
    } finally { setSubmitting(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await downloadTransactions()
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'transactions.xlsx'; a.click()
      window.URL.revokeObjectURL(url)
    } catch { toast.error('Failed to export') }
    finally { setExporting(false) }
  }

  const handleVoid = async () => {
    if (!voidModal || !voidReason.trim()) return toast.error('Void reason required')
    try {
      await voidTransaction(voidModal.id, voidReason)
      toast.success('Transaction voided')
      setVoidModal(null); setVoidReason('')
      fetchTransactions()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to void') }
  }

  const allowedCategories = categories.filter(c => c.is_allowed && c.is_active)

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight">Expenses</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-1">Record and manage petty cash expenses</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
              {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            {canEdit && (
              <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 shadow-lg shadow-emerald-500/15 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5">
                <Plus size={15} /> New Expense
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          <div className="relative w-full sm:flex-1 sm:max-w-xs sm:min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            <input className="input pl-9" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="select w-[calc(50%-5px)] sm:w-44" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.filter(c => c.is_allowed).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {isAccountsHead && (
            <select className="select w-[calc(50%-5px)] sm:w-44" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          )}
          <input className="input w-[calc(50%-5px)] sm:w-36" placeholder="Program" value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} />
          <input type="date" className="input w-[calc(50%-5px)] sm:w-36" title="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="input w-[calc(50%-5px)] sm:w-36" title="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {/* Table */}
        <div className="card overflow-hidden border border-navy-100/60">
          <div className="overflow-x-auto">
            <table className="responsive-table">
              <thead>
                <tr className="border-b border-navy-100/60 bg-gradient-to-r from-navy-50/80 to-white">
                    <th className="table-header">Date</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Category</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header text-center">Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(canEdit ? 6 : 5)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-navy-100 rounded animate-shimmer" /></td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-16 text-center text-navy-400"><div className="flex flex-col items-center gap-2"><Receipt size={32} className="text-navy-200" /><p>No expenses found</p></div></td></tr>
                ) : transactions.map((txn) => (
                  <tr key={txn.id} className={`hover:bg-gradient-to-r hover:from-navy-50/60 hover:to-transparent transition-all duration-150 ${txn.is_void ? 'opacity-40' : ''}`}>
                    <td data-label="Date" className="px-4 py-3.5 text-navy-500 whitespace-nowrap text-xs font-medium align-top">{txn.date}</td>
                    <td data-label="Description" className="px-4 py-3.5">
                      <p className="font-medium text-navy-900">{txn.description}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-navy-400 mt-0.5">
                        {txn.cpv_number && <span className="font-mono text-navy-500">CPV: {txn.cpv_number}</span>}
                        {txn.vendor_name && <span>Vendor: {txn.vendor_name}</span>}
                        {txn.payee && <span>Payee: {txn.payee}</span>}
                        <span className="text-navy-300">{txn.entered_by_name}</span>
                      </div>
                      {(txn.program_tag || txn.donor_fund_tag) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {txn.program_tag && <span className="badge-navy text-[10px]">{txn.program_tag}</span>}
                          {txn.donor_fund_tag && <span className="badge-amber text-[10px]">{txn.donor_fund_tag}</span>}
                        </div>
                      )}
                    </td>
                    <td data-label="Category" className="px-4 py-3.5 align-top pt-4"><span className="badge-navy">{txn.category_name}</span></td>
                    <td data-label="Amount" className="px-4 py-3.5 text-right font-bold text-navy-900 align-top pt-4">PKR {Number(txn.amount).toLocaleString()}</td>
                    <td data-label="Status" className="px-4 py-3.5 text-center align-top pt-4">
                      <div className="flex flex-col items-center gap-1">
                        {txn.is_void ? <span className="badge-red">Voided</span> : <span className="badge-emerald">Active</span>}
                        <span className={`text-[10px] ${txn.has_receipt ? 'text-emerald-500' : 'text-red-400'}`}>
                          {txn.has_receipt ? '✓ Receipt' : '✗ No rcpt'}
                        </span>
                      </div>
                    </td>
                    {canEdit && (
                      <td data-label="" className="px-4 py-3.5 text-right align-top pt-3">
                        <div className="flex items-center gap-1 justify-end">
                          {!txn.is_void && (
                            <>
                              <button onClick={() => setAmendTarget(txn)}
                                className="btn-ghost text-navy-500 hover:text-emerald-700 text-xs flex items-center gap-1">
                                <Upload size={12} /> Amend
                              </button>
                              <button onClick={() => setVoidModal({ id: txn.id, amount: txn.amount })}
                                className="btn-ghost text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                                <Ban size={13} /> Void
                              </button>
                            </>
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
      </div>

      {/* New Expense Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100 bg-gradient-to-r from-white to-navy-50/30">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">New Expense Entry</h2>
              <button onClick={() => { setShowModal(false); reset(); setReceiptFile(null) }} className="w-8 h-8 rounded-lg flex items-center justify-center text-navy-400 hover:text-navy-600 hover:bg-navy-50 transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" defaultValue={new Date().toISOString().split('T')[0]} {...register('date', { required: true })} />
                </div>
                <div>
                  <label className="label">Amount (PKR) *</label>
                  <input type="number" step="0.01" min="1" className="input" placeholder="0.00" {...register('amount', { required: true, min: 0.01 })} />
                  {errors.amount && <p className="text-xs text-red-500 mt-1">Valid amount required</p>}
                </div>
              </div>
              <div>
                <label className="label">Category *</label>
                <select className="select" {...register('category', { required: true })}>
                  <option value="">Select category...</option>
                  {allowedCategories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              {isAccountsHead && (
                <div>
                  <label className="label">Branch</label>
                  <select className="select" {...register('branch')}>
                    <option value="">Select branch...</option>
                    {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Description *</label>
                <textarea className="input resize-none" rows={2} placeholder="What was the expense for?" {...register('description', { required: true })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Payee</label>
                  <input className="input" placeholder="Who received payment" {...register('payee')} />
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="select" {...register('payment_method')}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Program Tag</label>
                  <input className="input" placeholder="e.g. Education, Health" {...register('program_tag')} />
                </div>
                <div>
                  <label className="label">Donor Fund Tag</label>
                  <input className="input" placeholder="e.g. UNICEF-2024" {...register('donor_fund_tag')} />
                </div>
              </div>
              <div>
                <label className="label">Narration (Detailed Notes)</label>
                <textarea className="input resize-none" rows={2} placeholder="Additional details about this expense" {...register('narration')} />
              </div>
              <div>
                <label className="label">Vendor</label>
                <input className="input" placeholder="Vendor / supplier name" {...register('vendor_name')} />
              </div>
              <div>
                <label className="label">Receipt * <span className="text-red-400 font-normal">(mandatory)</span></label>
                <label className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
                  ${receiptFile ? 'border-emerald-300 bg-emerald-50' : 'border-navy-200 hover:border-emerald-300 hover:bg-emerald-50/30'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${receiptFile ? 'bg-emerald-100' : 'bg-navy-100'}`}>
                    <Upload size={16} className={receiptFile ? 'text-emerald-600' : 'text-navy-400'} />
                  </div>
                  <span className={`text-sm ${receiptFile ? 'text-emerald-700 font-medium' : 'text-navy-400'}`}>
                    {receiptFile ? receiptFile.name : 'Upload receipt (image or PDF)'}
                  </span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); setReceiptFile(null) }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving...' : 'Save Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Amend Modal */}
      {amendTarget && (
        <div className="modal-overlay">
          <div className="modal-card max-w-lg">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100 bg-gradient-to-r from-white to-navy-50/30">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">Amend Expense</h2>
              <button onClick={() => setAmendTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-navy-400 hover:text-navy-600 hover:bg-navy-50 transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data: any = {}
              fd.forEach((v, k) => { if (v) data[k] = v })
              try {
                await amendTransaction(amendTarget.id, data)
                toast.success('Expense amended')
                setAmendTarget(null)
                fetchTransactions()
              } catch (err: any) {
                toast.error(err.response?.data?.error || 'Failed to amend')
              }
            }} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (PKR)</label>
                  <input type="number" step="0.01" className="input" name="amount" defaultValue={amendTarget.amount} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="select" name="category" defaultValue={amendTarget.category}>
                    <option value="">No change</option>
                    {allowedCategories.filter(c => c.id !== amendTarget.category).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2} name="description" defaultValue={amendTarget.description} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Payee</label>
                  <input className="input" name="payee" defaultValue={amendTarget.payee} />
                </div>
                <div>
                  <label className="label">Vendor</label>
                  <input className="input" name="vendor_name" defaultValue={amendTarget.vendor_name} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Program Tag</label>
                  <input className="input" name="program_tag" defaultValue={amendTarget.program_tag} />
                </div>
                <div>
                  <label className="label">Donor Fund Tag</label>
                  <input className="input" name="donor_fund_tag" defaultValue={amendTarget.donor_fund_tag} />
                </div>
              </div>
              <div>
                <label className="label">Narration</label>
                <textarea className="input resize-none" rows={2} name="narration" defaultValue={amendTarget.narration} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAmendTarget(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-sm border border-navy-100/60 p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Ban size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-navy-900">Void Transaction</h2>
                <p className="text-sm text-navy-400">PKR {Number(voidModal.amount).toLocaleString()}</p>
              </div>
            </div>
            <label className="label">Reason *</label>
            <textarea className="input resize-none mb-4" rows={3} placeholder="Why is this being voided?" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => { setVoidModal(null); setVoidReason('') }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleVoid} disabled={!voidReason.trim()} className="btn-danger flex-1">Void Transaction</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
