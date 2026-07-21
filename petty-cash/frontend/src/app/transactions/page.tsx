'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getTransactions, createTransaction, voidTransaction, getCategories } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, Upload, Eye, Ban, Search, Filter } from 'lucide-react'

interface Transaction {
  id: number
  date: string
  amount: string
  category: number
  category_name: string
  description: string
  vendor_name: string
  has_receipt: boolean
  is_void: boolean
  entered_by_name: string
  created_at: string
}

interface Category {
  id: number
  name: string
  is_allowed: boolean
  is_active: boolean
}

export default function TransactionsPage() {
  const { canEdit } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voidModal, setVoidModal] = useState<{ id: number; amount: string } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchTransactions = async () => {
    const params: any = {}
    if (searchTerm) params.search = searchTerm
    if (filterCategory) params.category = filterCategory
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const res = await getTransactions(params)
    setTransactions(res.data.results || res.data)
  }

  useEffect(() => {
    Promise.all([fetchTransactions(), getCategories().then(r => setCategories(r.data.results || r.data))])
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchTransactions, 400)
    return () => clearTimeout(t)
  }, [searchTerm, filterCategory, dateFrom, dateTo])

  const onSubmit = async (data: any) => {
    if (!receiptFile) return toast.error('Receipt is mandatory — please upload a receipt')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('date', data.date)
      fd.append('amount', data.amount)
      fd.append('category', data.category)
      fd.append('description', data.description)
      fd.append('vendor_name', data.vendor_name || '')
      fd.append('receipt', receiptFile)
      await createTransaction(fd)
      toast.success('Expense recorded successfully')
      reset()
      setReceiptFile(null)
      setShowModal(false)
      fetchTransactions()
    } catch (err: any) {
      const errData = err.response?.data
      const msg = typeof errData === 'object'
        ? Object.values(errData).flat().join(', ')
        : 'Failed to add transaction'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoid = async () => {
    if (!voidModal) return
    if (!voidReason.trim()) return toast.error('Void reason is required')
    try {
      await voidTransaction(voidModal.id, voidReason)
      toast.success('Transaction voided')
      setVoidModal(null)
      setVoidReason('')
      fetchTransactions()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to void')
    }
  }

  const allowedCategories = categories.filter(c => c.is_allowed && c.is_active)

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Expense Entry</h1>
            <p className="text-sm text-gray-500 mt-0.5">Record petty cash expenses with receipts</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Expense
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search description, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input w-48"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.filter(c => c.is_allowed).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input type="date" className="input w-40" title="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="input w-40" title="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(canEdit ? 8 : 7)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No transactions found
                    </td>
                  </tr>
                ) : transactions.map((txn) => (
                  <tr key={txn.id} className={`hover:bg-gray-50/50 transition-colors ${txn.is_void ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{txn.date}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900">{txn.description}</p>
                      <p className="text-xs text-gray-400">{txn.entered_by_name}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="badge-blue">{txn.category_name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{txn.vendor_name || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                      PKR {Number(txn.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {txn.has_receipt
                        ? <span className="badge-green">✓ Yes</span>
                        : <span className="badge-red">✗ No</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {txn.is_void
                        ? <span className="badge-red">Voided</span>
                        : <span className="badge-green">Active</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3.5 text-right">
                        {!txn.is_void && (
                          <button
                            onClick={() => setVoidModal({ id: txn.id, amount: txn.amount })}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 ml-auto"
                          >
                            <Ban size={13} /> Void
                          </button>
                        )}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Expense Entry</h2>
              <button onClick={() => { setShowModal(false); reset(); setReceiptFile(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date *</label>
                  <input
                    type="date"
                    className="input"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    {...register('date', { required: true })}
                  />
                </div>
                <div>
                  <label className="label">Amount (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="input"
                    placeholder="0.00"
                    {...register('amount', { required: true, min: 0.01 })}
                  />
                  {errors.amount && <p className="text-xs text-red-500 mt-1">Valid amount required</p>}
                </div>
              </div>

              <div>
                <label className="label">Category *</label>
                <select className="input" {...register('category', { required: true })}>
                  <option value="">Select category...</option>
                  {allowedCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1">Category is required</p>}
              </div>

              <div>
                <label className="label">Description *</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="What was the expense for?"
                  {...register('description', { required: true })}
                />
              </div>

              <div>
                <label className="label">Vendor / Shop Name</label>
                <input className="input" placeholder="e.g. Al-Fatah, Carrefour" {...register('vendor_name')} />
              </div>

              <div>
                <label className="label">Receipt * <span className="text-red-500">(mandatory)</span></label>
                <label className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                  ${receiptFile ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'}`}>
                  <Upload size={18} className={receiptFile ? 'text-emerald-600' : 'text-gray-400'} />
                  <span className={`text-sm ${receiptFile ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                    {receiptFile ? receiptFile.name : 'Click to upload receipt (image or PDF)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); setReceiptFile(null) }} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Void Transaction</h2>
            <p className="text-sm text-gray-500 mb-4">
              This will void PKR {Number(voidModal.amount).toLocaleString()} and restore it to fund balance.
            </p>
            <label className="label">Reason *</label>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              placeholder="Why is this being voided?"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setVoidModal(null); setVoidReason('') }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleVoid} className="btn-danger flex-1">Void Transaction</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
