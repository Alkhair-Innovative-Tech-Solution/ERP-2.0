'use client';

import { useState, useEffect } from 'react';
import { feeAPI } from '@/lib/api';
import { BarChart3, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function AccountsOfficerReportsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem('selected_org_id') || '';
      const data = await feeAPI.getFeeAnalytics(undefined, orgId);
      setAnalytics(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-brand-teal" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-brand-teal" /> Fee Reports
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Collection analytics and financial reports</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Collected</p>
          <p className="text-2xl font-black text-emerald-500 mt-1">PKR {(analytics?.total_collected || 0).toLocaleString()}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outstanding</p>
          <p className="text-2xl font-black text-rose-500 mt-1">PKR {(analytics?.total_outstanding || 0).toLocaleString()}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collection Rate</p>
          <p className="text-2xl font-black text-brand-teal mt-1">{analytics?.collection_rate || 0}%</p>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {analytics?.monthly_trend && analytics.monthly_trend.length > 0 && (
        <div className="premium-card p-8">
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-teal" /> Monthly Collection Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
