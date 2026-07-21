'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getAuditLogs } from '@/lib/api'
import { Shield, Filter, ChevronDown, ChevronRight, Settings, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  create: 'badge-emerald',
  update: 'badge-navy',
  void: 'badge-red',
  login: 'badge-amber',
  replenish: 'badge-emerald',
  budget_set: 'badge-blue',
  settings_change: 'badge-navy',
  approve: 'badge-emerald',
  reject: 'badge-red',
  transfer: 'badge-amber',
}

const ACTION_ICONS: Record<string, any> = {
  settings_change: Settings,
  approve: CheckCircle,
  reject: XCircle,
  transfer: ArrowRightLeft,
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchLogs = async () => {
    const params: any = {}
    if (filterAction) params.action = filterAction
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const res = await getAuditLogs(params)
    setLogs(res.data.results || res.data)
  }

  useEffect(() => { fetchLogs().finally(() => setLoading(false)) }, [])
  useEffect(() => { fetchLogs() }, [filterAction, dateFrom, dateTo])

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Audit Trail</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Every action logged — read only</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <input type="date" className="input text-xs w-32 sm:w-36" title="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="input text-xs w-32 sm:w-36" title="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <div className="relative flex-1 sm:flex-none">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <select className="select pl-8 w-full sm:w-44" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="void">Void</option>
                <option value="login">Login</option>
                <option value="replenish">Replenish</option>
                <option value="budget_set">Budget Set</option>
                <option value="settings_change">Settings Change</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="transfer">Fund Transfer</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table">
              <thead>
                <tr className="border-b border-navy-100/60 bg-navy-50/60">
                  <th className="w-8 px-2 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Module</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-navy-500 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-2 py-3.5" />
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-navy-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-navy-400">No audit logs found</td></tr>
                ) : logs.map((log) => {
                  const Icon = ACTION_ICONS[log.action]
                  const isExpanded = expandedId === log.id
                  const isSettingsChange = log.action === 'settings_change'
                  return (
                    <tr key={log.id} className="hover:bg-navy-50/40 transition-colors">
                      <td className="px-2 py-3 text-center">
                        {isSettingsChange && (
                          <button onClick={() => setExpandedId(isExpanded ? null : log.id)} className="text-navy-400 hover:text-navy-600">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                      <td data-label="Time" className="px-4 py-3 text-xs text-navy-400 whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleString('en-PK')}
                      </td>
                      <td data-label="User" className="px-4 py-3 text-navy-900 font-medium text-xs">{log.user_name || 'System'}</td>
                      <td data-label="Action" className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 ${ACTION_COLORS[log.action] || 'badge-navy'}`}>
                          {Icon && <Icon size={10} />}
                          {log.action_display}
                        </span>
                      </td>
                      <td data-label="Module" className="px-4 py-3 text-xs text-navy-400 font-mono">{log.model_name}</td>
                      <td data-label="Description" className="px-4 py-3 text-xs text-navy-600 max-w-xs">
                        <span className="truncate block">{log.description}</span>
                        {isExpanded && isSettingsChange && (
                          <div className="mt-2 p-2 bg-navy-50 rounded-lg text-navy-500 font-mono text-[10px] leading-relaxed">
                            {log.description}
                          </div>
                        )}
                      </td>
                      <td data-label="IP" className="px-4 py-3 text-xs text-navy-400 font-mono">{log.ip_address || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
