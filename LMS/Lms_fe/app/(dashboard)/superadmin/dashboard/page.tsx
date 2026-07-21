'use client';

import { useState, useEffect } from 'react';
import {
  Shield, Building2, Users, BookOpen, TrendingUp, Loader2,
  School, DollarSign, Award, Activity
} from 'lucide-react';
import { organizationAPI, userAPI, courseAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    organizations: 0,
    activeOrgs: 0,
    totalUsers: 0,
    totalCourses: 0,
  });
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [orgsRes, usersRes, coursesRes] = await Promise.all([
        organizationAPI.getAll().catch(() => []),
        userAPI.getAll().catch(() => []),
        courseAPI.getAll().catch(() => []),
      ]);

      const orgs = Array.isArray(orgsRes) ? orgsRes : [];
      const users = Array.isArray(usersRes) ? usersRes : ((usersRes as any)?.results || []);
      const courses = Array.isArray(coursesRes) ? coursesRes : ((coursesRes as any)?.results || []);

      setStats({
        organizations: orgs.length,
        activeOrgs: orgs.filter((o: any) => o.is_active).length,
        totalUsers: users.length,
        totalCourses: courses.length,
      });
      setRecentOrgs(orgs.slice(0, 5));
    } catch (error) {
      console.error('Error loading stats:', error);
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

  const statCards = [
    { title: 'Organizations', value: stats.organizations, icon: Building2, color: 'text-brand-teal', bg: 'bg-brand-teal/5' },
    { title: 'Active Orgs', value: stats.activeOrgs, icon: School, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { title: 'Total Courses', value: stats.totalCourses, icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="w-7 h-7 text-brand-teal" />
          Platform Dashboard
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Manage all organizations and platform settings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/superadmin/organizations" className="premium-card p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-teal" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Manage Organizations</h3>
              <p className="text-xs text-slate-400 font-bold">Create, edit, and manage all organizations</p>
            </div>
          </div>
        </Link>

        <Link href="/superadmin/platform-stats" className="premium-card p-5 hover:shadow-lg transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Platform Statistics</h3>
              <p className="text-xs text-slate-400 font-bold">View platform-wide analytics</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Organizations */}
      {recentOrgs.length > 0 && (
        <div className="premium-card p-5">
          <h3 className="text-sm font-black text-slate-900 mb-4">Recent Organizations</h3>
          <div className="space-y-3">
            {recentOrgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-brand-teal" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{org.name}</p>
                    <p className="text-xs text-slate-400 font-bold">{org.subdomain || 'No subdomain'}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase px-2 py-1 rounded",
                  org.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                )}>
                  {org.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
