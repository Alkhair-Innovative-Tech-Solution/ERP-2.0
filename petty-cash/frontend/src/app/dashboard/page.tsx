'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getDashboard } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { TrendingUp, AlertTriangle, Receipt, Wallet, Building2, Banknote, CheckSquare, Clock } from 'lucide-react'
import { format } from 'date-fns'

const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const { user, isAccountsHead, isFinanceHead } = useAuth()
  const canViewAll = isAccountsHead || isFinanceHead
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-5">
          <div className="h-8 bg-navy-100 rounded-xl w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-navy-100 rounded-2xl" />)}
          </div>
        </div>
      </AppLayout>
    )
  }

  const budgetPct = data?.budget_percent_used || 0
  const budgetColor = budgetPct >= 90 ? 'text-red-500' : budgetPct >= 70 ? 'text-amber-500' : 'text-emerald-500'
  const budgetBarColor = budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight">Dashboard</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>
          {user?.branch && (
            <div className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200/70 rounded-xl text-xs sm:text-sm shadow-soft">
              <Building2 size={14} className="text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-700">{user.branch.name}</span>
              <span className="text-emerald-400 text-xs">({user.branch.type_display})</span>
            </div>
          )}
        </div>

        {/* Low balance alert */}
        {data?.is_low_balance && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <p className="text-sm text-amber-800 font-medium">
              Low balance — PKR {Number(data.current_balance).toLocaleString()} is below threshold PKR {Number(data.low_balance_threshold).toLocaleString()}
            </p>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
          <StatCard
            label="Current Balance"
            value={`PKR ${Number(data?.current_balance || 0).toLocaleString()}`}
            icon={<Wallet size={18} />}
            color="emerald"
          />
          <StatCard
            label="This Month Spent"
            value={`PKR ${Number(data?.this_month_spent || 0).toLocaleString()}`}
            icon={<Receipt size={18} />}
            color="blue"
          />
          <StatCard
            label="Budget Remaining"
            value={`PKR ${Number(data?.budget_remaining || 0).toLocaleString()}`}
            icon={<TrendingUp size={18} />}
            color="purple"
          />
          <StatCard
            label="Transactions"
            value={data?.total_transactions_this_month || 0}
            icon={<Banknote size={18} />}
            color="amber"
          />
          {data?.pending_approvals > 0 && (
            <StatCard
              label="Pending Approvals"
              value={data.pending_approvals}
              icon={<Clock size={18} />}
              color="amber"
            />
          )}
        </div>

        {/* Budget Progress */}
        {data?.this_month_budget > 0 && (
          <div className="card p-5 card-gradient">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-900">Monthly Budget Usage</h2>
              <span className={`text-sm font-bold ${budgetColor} bg-white px-2.5 py-0.5 rounded-lg border border-current/10`}>{budgetPct}%</span>
            </div>
            <div className="h-3 bg-navy-100 rounded-full overflow-hidden p-[2px]">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${budgetBarColor}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-navy-400">
              <span className="font-medium text-navy-600">PKR {Number(data.this_month_spent).toLocaleString()} spent</span>
              <span className="font-medium text-navy-600">PKR {Number(data.this_month_budget).toLocaleString()} total</span>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly trend */}
          <div className="card p-5 card-gradient">
            <h2 className="text-sm font-semibold text-navy-900 mb-4">Monthly Spending Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.monthly_trend || []} barSize={32}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => [`PKR ${Number(v).toLocaleString()}`, 'Spent']}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="spent" radius={[6, 6, 0, 0]}>
                  {(data?.monthly_trend || []).map((_: any, i: number) => (
                    <Cell key={i} fill={i === (data.monthly_trend.length - 1) ? '#10b981' : '#d1fae5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="card p-5 card-gradient">
            <h2 className="text-sm font-semibold text-navy-900 mb-4">Category Breakdown</h2>
            {data?.category_breakdown?.length ? (
              <div className="space-y-3">
                {data.category_breakdown.map((cat: any, i: number) => {
                  const pct = data.this_month_spent > 0
                    ? (cat.total / data.this_month_spent * 100).toFixed(0)
                    : 0
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-navy-700 font-medium">{cat.category}</span>
                        <span className="text-navy-500">PKR {Number(cat.total).toLocaleString()} <span className="text-navy-300">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-navy-400 text-center py-8">No data this month</p>
            )}
          </div>
        </div>

        {/* Branch-wise breakdown */}
        {canViewAll && data?.branch_wise_spent?.length > 0 && (
          <div className="card p-5 card-gradient">
            <h2 className="text-sm font-semibold text-navy-900 mb-4">Branch-wise Spending <span className="text-navy-400 font-normal">(This Month)</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.branch_wise_spent.map((b: any, idx: number) => {
                const maxTotal = Math.max(...data.branch_wise_spent.map((x: any) => x.total))
                const pct = (b.total / maxTotal) * 100
                const style = { '--delay': `${idx * 0.05}s` } as React.CSSProperties
                return (
                  <div key={b.branch_code} className="bg-gradient-to-br from-navy-50 to-white rounded-xl p-4 border border-navy-100/70 hover:shadow-medium hover:border-navy-200/50 transition-all duration-200"
                    style={style}>
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-widest">{b.branch_code}</p>
                    <p className="text-base font-bold text-navy-900 mt-1">PKR {Number(b.total).toLocaleString()}</p>
                    <div className="mt-2.5 h-1.5 bg-navy-100/70 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-navy-400 mt-1.5">{b.count} transactions</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cross-branch balances (Finance Head view) */}
        {isFinanceHead && data?.cross_branch_balances?.length > 0 && (
          <div className="card p-5 card-gradient">
            <h2 className="text-sm font-semibold text-navy-900 mb-4">Cross-Branch Fund Balances <span className="text-navy-400 font-normal">(Current)</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.cross_branch_balances.map((b: any, idx: number) => {
                const maxBal = Math.max(...data.cross_branch_balances.map((x: any) => x.balance))
                const pct = maxBal > 0 ? (b.balance / maxBal) * 100 : 0
                const isLow = b.balance < (b.threshold || 0)
                return (
                  <div key={idx} className={`rounded-xl p-4 border transition-all duration-200 ${isLow ? 'bg-amber-50 border-amber-200' : 'bg-gradient-to-br from-navy-50 to-white border-navy-100/70'}`}>
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-widest">{b.branch_name || b.branch_code}</p>
                    <p className={`text-base font-bold mt-1 ${isLow ? 'text-amber-600' : 'text-navy-900'}`}>
                      PKR {Number(b.balance).toLocaleString()}
                    </p>
                    <div className="mt-2.5 h-1.5 bg-navy-100/70 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-navy-400 mt-1.5">
                      {b.fund_type || 'General'} {isLow && <span className="text-amber-500 font-medium">· Low</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-navy-100/60 bg-gradient-to-r from-white to-navy-50/30">
            <h2 className="text-sm font-semibold text-navy-900">Recent Transactions</h2>
          </div>
          {data?.recent_transactions?.length ? (
            <div className="divide-y divide-navy-50">
              {data.recent_transactions.map((txn: any) => (
                <div key={txn.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-navy-50/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">{txn.description}</p>
                    <p className="text-xs text-navy-400 mt-0.5 flex items-center gap-1.5">
                      <span className="badge-navy text-[10px]">{txn.category_name}</span>
                      {txn.branch_name && <span>· {txn.branch_name}</span>}
                      <span>· {txn.date}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-bold text-navy-900">PKR {Number(txn.amount).toLocaleString()}</p>
                    <div className="mt-0.5">
                      {txn.has_receipt
                        ? <span className="badge-emerald text-[10px]"><span className="w-1 h-1 rounded-full bg-emerald-500 mr-1" />Receipt</span>
                        : <span className="badge-red text-[10px]">No receipt</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-navy-400 text-center py-8">No transactions yet</p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string
}) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600 bg-emerald-50 text-emerald-600',
    blue: 'from-blue-500 to-blue-600 bg-blue-50 text-blue-600',
    purple: 'from-violet-500 to-violet-600 bg-purple-50 text-purple-600',
    amber: 'from-amber-500 to-amber-600 bg-amber-50 text-amber-600',
  }
  const gradientBgs: Record<string, string> = {
    emerald: 'from-emerald-50 to-white',
    blue: 'from-blue-50 to-white',
    purple: 'from-purple-50 to-white',
    amber: 'from-amber-50 to-white',
  }
  const ringColors: Record<string, string> = {
    emerald: 'ring-emerald-500/20',
    blue: 'ring-blue-500/20',
    purple: 'ring-purple-500/20',
    amber: 'ring-amber-500/20',
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-navy-100/60 shadow-soft p-5 bg-gradient-to-br ${gradientBgs[color]} hover:shadow-medium transition-all duration-200`}>
      <div className={`inline-flex p-2.5 rounded-xl bg-white ring-1 ${ringColors[color]} mb-3`}>
        <span className={colors[color].split(' ').slice(2).join(' ')}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-navy-900 tracking-tight">{value}</p>
      <p className="text-xs text-navy-400 mt-0.5 font-medium">{label}</p>
    </div>
  )
}
