'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getReportTemplates, generateReport, getBranches, getCategories } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { FileText, Download, Filter, Loader, FileSpreadsheet, Building2, Tag, Calendar, Users, DollarSign } from 'lucide-react'

const AUDIENCE_ICONS: Record<string, any> = {
  donor: DollarSign,
  management: Users,
  audit: FileText,
  branch: Building2,
  program: Tag,
}

const AUDIENCE_COLORS: Record<string, string> = {
  donor: 'from-emerald-50 to-white border-emerald-200 text-emerald-700',
  management: 'from-blue-50 to-white border-blue-200 text-blue-700',
  audit: 'from-purple-50 to-white border-purple-200 text-purple-700',
  branch: 'from-amber-50 to-white border-amber-200 text-amber-700',
  program: 'from-rose-50 to-white border-rose-200 text-rose-700',
}

export default function ReportsPage() {
  const { isAccountsHead, isFinanceHead } = useAuth()
  const canView = isAccountsHead || isFinanceHead
  const [templates, setTemplates] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [filters, setFilters] = useState<any>({})
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (!canView) { setLoading(false); return }
    Promise.all([
      getReportTemplates().then(r => setTemplates(r.data.results || r.data)),
      getBranches().then(r => setBranches(r.data.results || r.data)),
      getCategories().then(r => setCategories(r.data.results || r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const handleGenerate = async () => {
    if (!selectedTemplate) return toast.error('Select a report template')
    setGenerating(true)
    setResult(null)
    try {
      const cleaned: any = {}
      Object.entries(filters).forEach(([k, v]) => { if (v) cleaned[k] = v })
      const res = await generateReport({ template_id: selectedTemplate.id, filters: cleaned })
      setResult(res.data)
      toast.success('Report generated')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate report')
    } finally { setGenerating(false) }
  }

  if (!canView) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-navy-300 mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">Access Restricted</h2>
          <p className="text-sm text-navy-400 mt-1">Only Finance Head and Accounts Head can access reports.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Reports</h1>
          <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Generate branded reports for donors, management, and auditors</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Template Selection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-navy-900 mb-3">Report Templates</h2>
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-navy-100 rounded-xl animate-pulse" />)}</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-6 text-navy-400 text-sm">No templates configured</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => {
                    const Icon = AUDIENCE_ICONS[t.audience] || FileText
                    const isSelected = selectedTemplate?.id === t.id
                    return (
                      <button key={t.id} onClick={() => { setSelectedTemplate(t); setResult(null) }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-navy-100 hover:border-navy-200'}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-100' : 'bg-navy-50'}`}>
                            <Icon size={15} className={isSelected ? 'text-emerald-600' : 'text-navy-400'} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-navy-900 truncate">{t.name}</p>
                            <p className={`text-[10px] font-medium ${isSelected ? 'text-emerald-600' : 'text-navy-400'}`}>{t.audience_display}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filters + Results */}
          <div className="lg:col-span-2 space-y-4">
            {selectedTemplate && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Filter size={15} className="text-navy-400" />
                  <h2 className="text-sm font-semibold text-navy-900">Filters — {selectedTemplate.name}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Date From</label>
                    <input type="date" className="input" value={filters.date_from || ''} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Date To</label>
                    <input type="date" className="input" value={filters.date_to || ''} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Branch</label>
                    <select className="select" value={filters.branch || ''} onChange={(e) => setFilters({ ...filters, branch: e.target.value })}>
                      <option value="">All Branches</option>
                      {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Program Tag</label>
                    <input className="input" placeholder="e.g. STEAM" value={filters.program_tag || ''} onChange={(e) => setFilters({ ...filters, program_tag: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Donor Fund Tag</label>
                    <input className="input" placeholder="e.g. UNICEF" value={filters.donor_fund_tag || ''} onChange={(e) => setFilters({ ...filters, donor_fund_tag: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="select" value={filters.category || ''} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                      <option value="">All Categories</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Min Amount</label>
                    <input type="number" className="input" placeholder="0" value={filters.amount_min || ''} onChange={(e) => setFilters({ ...filters, amount_min: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Max Amount</label>
                    <input type="number" className="input" placeholder="999999" value={filters.amount_max || ''} onChange={(e) => setFilters({ ...filters, amount_max: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Approval Status</label>
                    <select className="select" value={filters.approval_status || ''} onChange={(e) => setFilters({ ...filters, approval_status: e.target.value })}>
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2 mt-4">
                  {generating ? <Loader size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                  {generating ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4 animate-fade-in">
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-navy-900">{result.report_name}</h2>
                      <p className="text-xs text-navy-400 mt-0.5">{result.audience} · {new Date(result.generated_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-navy-50 rounded-xl p-3 text-center">
                      <p className="text-lg sm:text-2xl font-bold text-navy-900">{result.summary.total_transactions}</p>
                      <p className="text-xs text-navy-400">Transactions</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-lg sm:text-2xl font-bold text-emerald-600">PKR {Number(result.summary.non_void_amount).toLocaleString()}</p>
                      <p className="text-xs text-emerald-500">Net Amount</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-lg sm:text-2xl font-bold text-red-600">{result.summary.void_count}</p>
                      <p className="text-xs text-red-500">Voided</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-lg sm:text-2xl font-bold text-amber-600">{result.summary.pending_approval_count}</p>
                      <p className="text-xs text-amber-500">Pending</p>
                    </div>
                  </div>
                </div>

                {result.transactions?.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-white to-navy-50/30">
                      <h2 className="text-sm font-semibold text-navy-900">Transactions ({result.transactions.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="responsive-table">
                        <thead>
                          <tr className="border-b border-navy-100/60 bg-navy-50/60">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Date</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Description</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Category</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Program</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Amount</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-navy-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-50">
                          {result.transactions.slice(0, 50).map((t: any) => (
                            <tr key={t.id} className="hover:bg-navy-50/40 transition-colors">
                              <td data-label="Date" className="px-4 py-2.5 text-xs text-navy-400">{t.date}</td>
                              <td data-label="Description" className="px-4 py-2.5 text-sm text-navy-900">{t.description}</td>
                              <td data-label="Category" className="px-4 py-2.5"><span className="badge-navy text-[10px]">{t.category_name}</span></td>
                              <td data-label="Program" className="px-4 py-2.5 text-xs text-navy-400">{t.program_tag || '—'}</td>
                              <td data-label="Amount" className="px-4 py-2.5 text-right text-sm font-bold text-navy-900">PKR {Number(t.amount).toLocaleString()}</td>
                              <td data-label="Status" className="px-4 py-2.5 text-center">
                                {t.is_void ? <span className="badge-red text-[10px]">Voided</span> : <span className="badge-emerald text-[10px]">Active</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
