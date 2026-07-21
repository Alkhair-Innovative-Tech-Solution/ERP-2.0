'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock,
  Receipt, Users, BookOpen, BarChart3, Loader2
} from 'lucide-react';
import { feeAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AccountsOfficerDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const data = await feeAPI.getFeeAnalytics(undefined, orgId);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Collected',
      value: `PKR ${(analytics?.total_collected || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Outstanding',
      value: `PKR ${(analytics?.total_outstanding || 0).toLocaleString()}`,
      icon: AlertCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-50'
    },
    {
      title: 'Collection Rate',
      value: `${analytics?.collection_rate || 0}%`,
      icon: TrendingUp,
      color: 'text-brand-teal',
      bg: 'bg-brand-teal/5'
    },
    {
      title: 'Pending Verifications',
      value: analytics?.pending_count || 0,
      icon: Clock,
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-brand-teal" />
          Financial Dashboard
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Fee collection overview and payment management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="premium-card p-5">
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">{stat.title}</p>
            <p className={cn("text-2xl font-black mt-1", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/accounts_officer/fees" className="premium-card p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Fee Collection</h3>
              <p className="text-xs text-slate-400 font-bold">Record payments</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-brand-teal transition-colors" />
          </div>
        </Link>

        <Link href="/accounts_officer/payments" className="premium-card p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Payment Verification</h3>
              <p className="text-xs text-slate-400 font-bold">Verify bank transfers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-brand-teal transition-colors" />
          </div>
        </Link>

        <Link href="/accounts_officer/reports" className="premium-card p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Reports</h3>
              <p className="text-xs text-slate-400 font-bold">Collection analytics</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 ml-auto group-hover:text-brand-teal transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
