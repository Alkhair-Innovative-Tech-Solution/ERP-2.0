'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import {
  getCategories, createCategory, updateCategory,
  getBudgets, createBudget, updateBudget,
  getCashFund, updateCashFund,
  getSettings, updateSetting,
  getFundTypes,
  getReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate,
} from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, CheckCircle, XCircle, Settings, Wallet, Tag, Calendar, Building2, Shield, Sliders, Users, Layers, FileText, Edit3, Trash2 } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function SettingsPage() {
  const { isAccountsHead, isFinanceHead } = useAuth()
  const canManage = isAccountsHead || isFinanceHead
  const [categories, setCategories] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [fund, setFund] = useState<any>(null)
  const [systemSettings, setSystemSettings] = useState<any[]>([])
  const [fundTypes, setFundTypes] = useState<any[]>([])
  const [reportTemplates, setReportTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('categories')
  const [showCatModal, setShowCatModal] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [editBudget, setEditBudget] = useState<any>(null)
  const [showRepModal, setShowRepModal] = useState(false)
  const [editRep, setEditRep] = useState<any>(null)

  const catForm = useForm()
  const budgetForm = useForm()
  const fundForm = useForm()

  const fetchAll = async () => {
    const [catRes, budRes, fundRes, settingsRes, fundTypesRes, repRes] = await Promise.all([
      getCategories(), getBudgets(), getCashFund(),
      getSettings(), getFundTypes(), getReportTemplates(),
    ])
    setCategories(catRes.data.results || catRes.data)
    setBudgets(budRes.data.results || budRes.data)
    setFund(fundRes.data)
    setSystemSettings(settingsRes.data.results || settingsRes.data)
    setFundTypes(fundTypesRes.data.results || fundTypesRes.data)
    setReportTemplates(repRes.data.results || repRes.data)
    fundForm.reset({
      current_balance: fundRes.data.current_balance,
      low_balance_threshold: fundRes.data.low_balance_threshold,
    })
  }

  useEffect(() => { fetchAll().finally(() => setLoading(false)) }, [])

  const onCreateCategory = async (data: any) => {
    try {
      await createCategory({ ...data, is_allowed: data.is_allowed === 'true' })
      toast.success('Category created')
      catForm.reset(); setShowCatModal(false); fetchAll()
    } catch { toast.error('Failed to create category') }
  }

  const onToggleCategory = async (cat: any) => {
    try {
      await updateCategory(cat.id, { is_active: !cat.is_active })
      toast.success(`Category ${cat.is_active ? 'deactivated' : 'activated'}`)
      fetchAll()
    } catch { toast.error('Failed to update') }
  }

  const onSaveBudget = async (data: any) => {
    try {
      if (editBudget) {
        await updateBudget(editBudget.id, { total_budget: data.total_budget, notes: data.notes })
        toast.success('Budget updated')
      } else {
        await createBudget(data)
        toast.success('Budget set')
      }
      budgetForm.reset(); setShowBudgetModal(false); setEditBudget(null); fetchAll()
    } catch (err: any) {
      toast.error(err.response?.data?.non_field_errors?.[0] || 'Failed to save')
    }
  }

  const onUpdateFund = async (data: any) => {
    try {
      await updateCashFund(data)
      toast.success('Fund settings updated')
      fetchAll()
    } catch { toast.error('Failed to update') }
  }

  const onUpdateSetting = async (setting: any, newValue: any) => {
    try {
      await updateSetting(setting.id, { value: newValue })
      toast.success(`Setting "${setting.key}" updated`)
      fetchAll()
    } catch { toast.error('Failed to update setting') }
  }

  const [repName, setRepName] = useState('')
  const [repAudience, setRepAudience] = useState('management')
  const [repConfig, setRepConfig] = useState<any>({})

  const onSaveReport = async () => {
    if (!repName.trim()) return toast.error('Name is required')
    try {
      const payload = { name: repName, audience: repAudience, config: repConfig }
      if (editRep) {
        await updateReportTemplate(editRep.id, payload)
        toast.success('Template updated')
      } else {
        await createReportTemplate(payload)
        toast.success('Template created')
      }
      setShowRepModal(false); setEditRep(null); setRepName(''); setRepAudience('management'); setRepConfig({})
      fetchAll()
    } catch { toast.error('Failed to save template') }
  }

  const onDeleteReport = async (id: number) => {
    if (!confirm('Delete this report template?')) return
    try {
      await deleteReportTemplate(id)
      toast.success('Template deleted')
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  const tabs = [
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'budget', label: 'Budgets', icon: Calendar },
    { id: 'controls', label: 'Controls', icon: Sliders },
    { id: 'fund-types', label: 'Fund Types', icon: Layers },
    { id: 'fund', label: 'Fund Settings', icon: Wallet },
    { id: 'reports', label: 'Report Templates', icon: FileText },
  ]

  if (!canManage) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Settings size={48} className="mx-auto text-navy-300 mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">Access Restricted</h2>
          <p className="text-sm text-navy-400 mt-1">Only Accounts Head or Finance Head can access settings.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Settings</h1>
          <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Manage categories, budgets, and fund configuration</p>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-1 bg-navy-100 p-1 rounded-xl w-max sm:w-fit min-w-full sm:min-w-0">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap
                  ${activeTab === id ? 'bg-white text-navy-900 shadow-soft' : 'text-navy-500 hover:text-navy-700'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-navy-400">Manage expense categories</p>
              <button onClick={() => setShowCatModal(true)} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Add Category
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle size={15} /> Allowed in Petty Cash
                  </p>
                </div>
                <div className="divide-y divide-navy-50">
                  {categories.filter(c => c.is_allowed).map(cat => (
                    <CategoryRow key={cat.id} cat={cat} onToggle={onToggleCategory} />
                  ))}
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <XCircle size={15} /> NOT Allowed
                  </p>
                </div>
                <div className="divide-y divide-navy-50">
                  {categories.filter(c => !c.is_allowed).map(cat => (
                    <CategoryRow key={cat.id} cat={cat} onToggle={onToggleCategory} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BUDGETS */}
        {activeTab === 'budget' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-navy-400">Set monthly budgets per branch</p>
              <button onClick={() => { setEditBudget(null); budgetForm.reset(); setShowBudgetModal(true) }}
                className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Set Budget
              </button>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-navy-100/60 bg-navy-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Period</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Branch</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Department</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Budget</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Spent</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Remaining</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Used</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {budgets.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-navy-400">No budgets set yet</td></tr>
                    ) : budgets.map((b) => {
                      const pct = b.percent_used
                      const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      return (
                        <tr key={b.id} className="hover:bg-navy-50/50">
                          <td data-label="Period" className="px-4 py-3.5 font-medium text-navy-900">{MONTHS[b.month - 1]} {b.year}</td>
                          <td data-label="Branch" className="px-4 py-3.5 text-navy-500">{b.branch_name || 'General'}</td>
                          <td data-label="Dept" className="px-4 py-3.5 text-navy-500">{b.department || 'General'}</td>
                          <td data-label="Budget" className="px-4 py-3.5 text-right text-navy-900">PKR {Number(b.total_budget).toLocaleString()}</td>
                          <td data-label="Spent" className="px-4 py-3.5 text-right text-red-500">PKR {Number(b.total_spent).toLocaleString()}</td>
                          <td data-label="Remaining" className="px-4 py-3.5 text-right text-emerald-600">PKR {Number(b.remaining).toLocaleString()}</td>
                          <td data-label="Used" className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-navy-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-navy-400 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td data-label="" className="px-4 py-3.5 text-right">
                            <button onClick={() => {
                              setEditBudget(b)
                              budgetForm.reset({ total_budget: b.total_budget, notes: b.notes })
                              setShowBudgetModal(true)
                            }} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Edit</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS */}
        {activeTab === 'controls' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-navy-400">System-wide approval and behavior settings</p>
            </div>
            <div className="card overflow-hidden">
              <div className="divide-y divide-navy-50">
                {systemSettings.length === 0 ? (
                  <div className="px-4 py-10 text-center text-navy-400">No settings loaded</div>
                ) : systemSettings.map(setting => (
                  <div key={setting.id} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-medium text-navy-900">{setting.key.replace(/_/g, ' ')}</p>
                      {setting.description && (
                        <p className="text-xs text-navy-400 mt-0.5">{setting.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 w-48">
                      {setting.value_type === 'boolean' || setting.key.includes('block_') || setting.key.includes('require_') ? (
                        <button
                          onClick={() => onUpdateSetting(setting, setting.value === 'true' ? 'false' : 'true')}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${setting.value === 'true' ? 'bg-emerald-500' : 'bg-navy-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting.value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      ) : (
                        <input
                          type="number"
                          defaultValue={setting.value}
                          onBlur={(e) => {
                            if (e.target.value !== setting.value) onUpdateSetting(setting, e.target.value)
                          }}
                          className="input text-sm w-full text-center"
                          min="0"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FUND TYPES */}
        {activeTab === 'fund-types' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-navy-400">Manage fund type categories (Unrestricted, Restricted, Project, etc.)</p>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-navy-100/60 bg-navy-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Code</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Description</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {fundTypes.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-400">No fund types found</td></tr>
                    ) : fundTypes.map(ft => (
                      <tr key={ft.id} className="hover:bg-navy-50/50">
                        <td data-label="Name" className="px-4 py-3.5 font-medium text-navy-900">{ft.name}</td>
                        <td data-label="Code" className="px-4 py-3.5 text-navy-500 font-mono text-xs">{ft.code}</td>
                        <td data-label="Description" className="px-4 py-3.5 text-navy-400 text-xs">{ft.description || '-'}</td>
                        <td data-label="Status" className="px-4 py-3.5 text-center">
                          {ft.is_active ? <span className="badge-emerald">Active</span> : <span className="badge-red">Inactive</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FUND SETTINGS */}
        {activeTab === 'fund' && (
          <div className="max-w-md">
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-navy-900 mb-4">Cash Fund Configuration</h2>
              <form onSubmit={fundForm.handleSubmit(onUpdateFund)} className="space-y-4">
                <div>
                  <label className="label">Current Balance (PKR)</label>
                  <input type="number" step="0.01" className="input" {...fundForm.register('current_balance')} />
                  <p className="text-xs text-navy-400 mt-1">Only update if correction needed</p>
                </div>
                <div>
                  <label className="label">Low Balance Alert (PKR)</label>
                  <input type="number" step="0.01" className="input" {...fundForm.register('low_balance_threshold')} />
                </div>
                <button type="submit" className="btn-primary w-full">Save Settings</button>
              </form>
            </div>
          </div>
        )}

        {/* REPORT TEMPLATES */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-navy-400">Manage report templates used on the Reports page</p>
              <button onClick={() => { setEditRep(null); setRepName(''); setRepAudience('management'); setRepConfig({}); setShowRepModal(true) }}
                className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Add Template
              </button>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="responsive-table">
                  <thead>
                    <tr className="border-b border-navy-100/60 bg-navy-50/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Audience</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Active</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {reportTemplates.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-navy-400">No report templates yet</td></tr>
                    ) : reportTemplates.map(t => (
                      <tr key={t.id} className="hover:bg-navy-50/40 transition-colors">
                        <td data-label="Name" className="px-4 py-3.5 font-medium text-navy-900">{t.name}</td>
                        <td data-label="Audience" className="px-4 py-3.5">
                          <span className="badge-navy text-[10px]">{t.audience_display || t.audience}</span>
                        </td>
                        <td data-label="Status" className="px-4 py-3.5 text-center">
                          {t.is_active ? <span className="badge-emerald">Active</span> : <span className="badge-red">Inactive</span>}
                        </td>
                        <td data-label="" className="px-4 py-3.5 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => {
                              setEditRep(t); setRepName(t.name); setRepAudience(t.audience); setRepConfig(t.config || {}); setShowRepModal(true)
                            }} className="btn-ghost text-navy-500 hover:text-emerald-700 text-xs flex items-center gap-1">
                              <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={() => onDeleteReport(t.id)}
                              className="btn-ghost text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Template Modal */}
      {showRepModal && (
        <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">{editRep ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => { setShowRepModal(false); setEditRep(null) }} className="text-navy-400 hover:text-navy-600"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="label">Template Name *</label>
                <input className="input" placeholder="e.g. Monthly Donor Report" value={repName}
                  onChange={(e) => setRepName(e.target.value)} />
              </div>
              <div>
                <label className="label">Audience</label>
                <select className="select" value={repAudience} onChange={(e) => setRepAudience(e.target.value)}>
                  <option value="management">Management</option>
                  <option value="donor">Donor</option>
                  <option value="audit">Audit</option>
                  <option value="branch">Branch</option>
                  <option value="program">Program</option>
                </select>
              </div>
              <div className="border-t border-navy-100 pt-4">
                <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-3">Template Configuration</p>
                <div>
                  <label className="label">Report Title Prefix</label>
                  <input className="input" placeholder="e.g. Monthly Expense Report" value={repConfig.title_prefix || ''}
                    onChange={(e) => setRepConfig({ ...repConfig, title_prefix: e.target.value })} />
                </div>
                <div className="mt-3">
                  <label className="label">Default Branch (optional)</label>
                  <input className="input" placeholder="Branch code e.g. HQ" value={repConfig.default_branch || ''}
                    onChange={(e) => setRepConfig({ ...repConfig, default_branch: e.target.value })} />
                </div>
                <div className="mt-3">
                  <label className="label">Default Program Tag</label>
                  <input className="input" placeholder="e.g. STEAM" value={repConfig.default_program || ''}
                    onChange={(e) => setRepConfig({ ...repConfig, default_program: e.target.value })} />
                </div>
                <div className="mt-3">
                  <label className="label">Default Date Range (months)</label>
                  <input type="number" min="1" max="36" className="input w-24" placeholder="3"
                    value={repConfig.default_months || ''}
                    onChange={(e) => setRepConfig({ ...repConfig, default_months: e.target.value })} />
                  <p className="text-xs text-navy-400 mt-1">Auto-set date_from to N months ago</p>
                </div>
                <div className="mt-3">
                  <label className="label">Columns to Display</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {['date', 'description', 'category', 'amount', 'branch', 'program_tag', 'donor_fund_tag', 'vendor', 'payee', 'payment_method', 'receipt', 'status'].map(col => (
                      <label key={col} className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
                        <input type="checkbox" className="rounded border-navy-300 text-emerald-600 focus:ring-emerald-500"
                          checked={!repConfig.columns || repConfig.columns.includes(col)}
                          onChange={(e) => {
                            const cols = repConfig.columns ? [...repConfig.columns] : ['date', 'description', 'category', 'amount', 'branch', 'program_tag', 'donor_fund_tag', 'vendor', 'payee', 'payment_method', 'receipt', 'status']
                            if (e.target.checked) {
                              setRepConfig({ ...repConfig, columns: cols.filter((c: string) => c !== col ? true : !e.target.checked).concat(col) })
                            } else {
                              setRepConfig({ ...repConfig, columns: cols.filter((c: string) => c !== col) })
                            }
                          }} />
                        {col.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowRepModal(false); setEditRep(null) }} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={onSaveReport} className="btn-primary flex-1">{editRep ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">New Category</h2>
              <button onClick={() => setShowCatModal(false)} className="text-navy-400 hover:text-navy-600"><X size={20} /></button>
            </div>
            <form onSubmit={catForm.handleSubmit(onCreateCategory)} className="p-6 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" placeholder="e.g. Stationery" {...catForm.register('name', { required: true })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Brief description" {...catForm.register('description')} />
              </div>
              <div>
                <label className="label">Type *</label>
                <select className="select" {...catForm.register('is_allowed', { required: true })}>
                  <option value="true">Allowed in Petty Cash</option>
                  <option value="false">Not Allowed (reference only)</option>
                </select>
              </div>
              <div>
                <label className="label">Monthly Limit (PKR)</label>
                <input type="number" step="0.01" className="input" placeholder="No limit" {...catForm.register('monthly_limit')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-navy-100">
              <h2 className="font-semibold text-navy-900 text-sm sm:text-base">{editBudget ? 'Edit Budget' : 'Set Budget'}</h2>
              <button onClick={() => { setShowBudgetModal(false); setEditBudget(null) }} className="text-navy-400 hover:text-navy-600"><X size={20} /></button>
            </div>
            <form onSubmit={budgetForm.handleSubmit(onSaveBudget)} className="p-6 space-y-4">
              {!editBudget && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Year *</label>
                    <input type="number" className="input" defaultValue={new Date().getFullYear()} {...budgetForm.register('year', { required: true })} />
                  </div>
                  <div>
                    <label className="label">Month *</label>
                    <select className="select" defaultValue={new Date().getMonth() + 1} {...budgetForm.register('month', { required: true })}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {!editBudget && (
                <div>
                  <label className="label">Branch</label>
                  <input className="input" placeholder="Leave empty for General" {...budgetForm.register('department')} />
                </div>
              )}
              <div>
                <label className="label">Total Budget (PKR) *</label>
                <input type="number" step="0.01" className="input" placeholder="0.00" {...budgetForm.register('total_budget', { required: true })} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} {...budgetForm.register('notes')} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowBudgetModal(false); setEditBudget(null) }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editBudget ? 'Update' : 'Set Budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function CategoryRow({ cat, onToggle }: { cat: any; onToggle: (cat: any) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className={`text-sm font-medium ${cat.is_active ? 'text-navy-900' : 'text-navy-400 line-through'}`}>{cat.name}</p>
        <p className="text-xs text-navy-400">{cat.description}</p>
      </div>
      <div className="flex items-center gap-3">
        {cat.monthly_limit && <span className="text-xs text-navy-400">Limit: PKR {Number(cat.monthly_limit).toLocaleString()}</span>}
        {cat.is_active ? <span className="badge-emerald">Active</span> : <span className="badge-red">Inactive</span>}
        <button onClick={() => onToggle(cat)} className="text-xs text-navy-400 hover:text-navy-700 font-medium">
          {cat.is_active ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
