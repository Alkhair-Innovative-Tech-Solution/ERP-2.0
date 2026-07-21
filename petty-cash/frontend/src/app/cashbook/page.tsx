'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getTransactions, getReplenishments, getCashFund, exportCashbook } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { Download, ChevronLeft, ChevronRight, Building2, Loader } from 'lucide-react'

interface Entry {
  id: string; date: string; type: 'expense' | 'replenishment'
  description: string; category?: string; vendor?: string
  debit: number; credit: number; has_receipt?: boolean
  is_void?: boolean; ref?: string; branch_name?: string
}

export default function CashbookPage() {
  const { isAccountsHead } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [balance, setBalance] = useState(0)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [txnRes, repRes, fundRes] = await Promise.all([
        getTransactions({ year: selectedYear, month: selectedMonth }),
        getReplenishments(),
        getCashFund(),
      ])
      setBalance(Number(fundRes.data.current_balance))

      const txns: Entry[] = (txnRes.data.results || txnRes.data).map((t: any) => ({
        id: `txn-${t.id}`, date: t.date, type: 'expense',
        description: t.description, category: t.category_name,
        vendor: t.vendor_name, debit: Number(t.amount), credit: 0,
        has_receipt: t.has_receipt, is_void: t.is_void, branch_name: t.branch_name,
      }))

      const reps: Entry[] = (repRes.data.results || repRes.data)
        .filter((r: any) => {
          const d = new Date(r.date)
          return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth
        })
        .map((r: any) => ({
          id: `rep-${r.id}`, date: r.date, type: 'replenishment',
          description: r.notes || 'Fund Replenishment', debit: 0,
          credit: Number(r.amount), ref: r.reference_number, branch_name: r.branch_name,
        }))

      const combined = [...txns, ...reps].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      setEntries(combined)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [selectedYear, selectedMonth])

  const totalDebit = entries.filter(e => !e.is_void).reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1) }
    else setSelectedMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1) }
    else setSelectedMonth(m => m + 1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportCashbook(selectedYear, selectedMonth)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cashbook_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch { toast.error('Failed to export cashbook') }
    finally { setExporting(false) }
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Cashbook</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Complete transaction ledger with running balance</p>
          </div>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 self-start sm:self-auto">
            {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>

        {/* Month selector + summary */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-white border border-navy-200 rounded-xl px-3 py-2 shadow-soft self-start">
            <button onClick={prevMonth} className="p-1 hover:bg-navy-50 rounded-lg transition-colors text-navy-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-navy-800 w-36 text-center">
              {months[selectedMonth - 1]} {selectedYear}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-navy-50 rounded-lg transition-colors text-navy-500">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <SummaryPill label="Expenses" value={totalDebit} color="red" />
            <SummaryPill label="Replenishments" value={totalCredit} color="green" />
            <SummaryPill label="Balance" value={balance} color="blue" />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table">
              <thead>
                <tr className="border-b border-navy-100/60 bg-navy-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider w-24">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Particulars</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Category / Ref</th>
                  {isAccountsHead && <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Branch</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Vendor</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-red-400 uppercase tracking-wider">Debit (Out)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-500 uppercase tracking-wider">Credit (In)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Receipt</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(isAccountsHead ? 9 : 8)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-navy-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr><td colSpan={isAccountsHead ? 9 : 8} className="px-4 py-12 text-center text-navy-400">No records for {months[selectedMonth - 1]} {selectedYear}</td></tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}
                      className={`hover:bg-navy-50/40 transition-colors
                        ${entry.is_void ? 'opacity-40 line-through' : ''}
                        ${entry.type === 'replenishment' ? 'bg-emerald-50/30' : ''}`}>
                      <td data-label="Date" className="px-4 py-3.5 text-navy-400 whitespace-nowrap text-xs">{entry.date}</td>
                      <td data-label="Description" className="px-4 py-3.5">
                        <p className="font-medium text-navy-900">{entry.description}</p>
                        {entry.type === 'replenishment' && <p className="text-xs text-emerald-600 font-medium mt-0.5">Fund Replenishment</p>}
                      </td>
                      <td data-label="Ref" className="px-4 py-3.5 text-navy-400 text-xs">{entry.category || entry.ref || '—'}</td>
                      {isAccountsHead && <td data-label="Branch" className="px-4 py-3.5 text-navy-400 text-xs">{entry.branch_name || '—'}</td>}
                      <td data-label="Vendor" className="px-4 py-3.5 text-navy-400 text-xs">{entry.vendor || '—'}</td>
                      <td data-label="Debit" className="px-4 py-3.5 text-right">
                        {entry.debit > 0 ? <span className="font-semibold text-red-500">PKR {entry.debit.toLocaleString()}</span> : '—'}
                      </td>
                      <td data-label="Credit" className="px-4 py-3.5 text-right">
                        {entry.credit > 0 ? <span className="font-semibold text-emerald-600">PKR {entry.credit.toLocaleString()}</span> : '—'}
                      </td>
                      <td data-label="Receipt" className="px-4 py-3.5 text-center">
                        {entry.type === 'expense' ? (
                          entry.has_receipt ? <span className="badge-emerald">Yes</span> : <span className="badge-red">No</span>
                        ) : <span className="text-navy-300">—</span>}
                      </td>
                      <td data-label="Status" className="px-4 py-3.5 text-center">
                        {entry.is_void ? <span className="badge-red">Voided</span>
                          : entry.type === 'replenishment' ? <span className="badge-emerald">Added</span>
                          : <span className="badge-navy">Posted</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && entries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-navy-200 bg-navy-50">
                    <td colSpan={isAccountsHead ? 5 : 4} className="px-4 py-3 text-sm font-semibold text-navy-700">Month Total</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">PKR {totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">PKR {totalCredit.toLocaleString()}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  const styles: Record<string, string> = {
    red: 'bg-red-50 border-red-100 text-red-600',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
  }
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm shadow-soft ${styles[color]}`}>
      <span className="text-xs opacity-70">{label}</span>
      <span className="font-semibold">PKR {value.toLocaleString()}</span>
    </div>
  )
}
