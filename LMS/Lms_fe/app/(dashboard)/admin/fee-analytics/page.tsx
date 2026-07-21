'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { BarChart3, DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock, Loader2, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

export default function FeeAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      setAnalytics(await feeAPI.getFeeAnalytics(undefined, orgId));
    }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) return <div className="premium-card p-12 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-teal" /></div>;
  if (!analytics) return <div className="premium-card p-12 text-center"><p className="text-xl font-black text-slate-900">Failed to load analytics</p></div>;

  const kpis = [
    { title: 'Total Collected', value: `PKR ${analytics.total_collected?.toLocaleString() || 0}`, icon: DollarSign, color: 'emerald', trend: 'All Time' },
    { title: 'Outstanding', value: `PKR ${analytics.total_outstanding?.toLocaleString() || 0}`, icon: AlertCircle, color: 'rose', trend: 'Pending + Overdue' },
    { title: 'Collection Rate', value: `${analytics.collection_rate || 0}%`, icon: TrendingUp, color: 'teal', trend: 'Overall' },
    { title: 'Overdue Accounts', value: analytics.overdue_count || 0, icon: Clock, color: 'orange', trend: 'Need Attention' },
    { title: 'Paid Records', value: analytics.paid_count || 0, icon: CheckCircle, color: 'emerald', trend: 'Completed' },
    { title: 'Pending Records', value: analytics.pending_count || 0, icon: Users, color: 'blue', trend: 'Awaiting Payment' },
  ];

  const colorMap: Record<string, string> = { emerald: 'text-emerald-500', rose: 'text-rose-500', teal: 'text-brand-teal', orange: 'text-orange-500', blue: 'text-blue-500' };
  const bgMap: Record<string, string> = { emerald: 'bg-emerald-50', rose: 'bg-rose-50', teal: 'bg-brand-teal/5', orange: 'bg-orange-50', blue: 'bg-blue-50' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-brand-teal" /> Fee Analytics
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Revenue reports and collection analytics</p>
        </div>
        <button onClick={fetchAnalytics} className="px-4 py-2.5 bg-brand-teal text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-teal/90 transition-all">Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="premium-card p-5">
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgMap[kpi.color])}>
                <kpi.icon className={cn("w-5 h-5", colorMap[kpi.color])} />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.trend}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">{kpi.title}</p>
            <p className={cn("text-2xl font-black mt-1", colorMap[kpi.color])}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly Trend Chart */}
      {analytics.monthly_trend && analytics.monthly_trend.length > 0 && (
        <div className="premium-card p-8">
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-teal" /> Monthly Collection Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `PKR ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `PKR ${value?.toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      <div className="premium-card p-8">
        <h2 className="text-lg font-black text-slate-900 mb-4">Collection Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Total Revenue</span>
              <span className="text-lg font-black text-emerald-500">PKR {(analytics.total_collected || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Total Outstanding</span>
              <span className="text-lg font-black text-rose-500">PKR {(analytics.total_outstanding || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Overdue Amount</span>
              <span className="text-lg font-black text-orange-500">PKR {(analytics.total_overdue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Waived Amount</span>
              <span className="text-lg font-black text-slate-400">PKR {(analytics.total_waived || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Paid Records</span>
              <span className="text-lg font-black text-emerald-500">{analytics.paid_count || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Pending Records</span>
              <span className="text-lg font-black text-blue-500">{analytics.pending_count || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Overdue Accounts</span>
              <span className="text-lg font-black text-rose-500">{analytics.overdue_count || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-500">Collection Rate</span>
              <span className="text-lg font-black text-brand-teal">{analytics.collection_rate || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
