'use client';

import { useState } from 'react';
import {
  Users, BookOpen, Bell, Award, UserPlus, TrendingUp, Activity,
  GraduationCap, ArrowUpRight, Target, Briefcase, CheckCircle2,
  Calendar, LayoutDashboard, RefreshCw, ChevronRight,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStoredUser } from '@/lib/auth';
import { authAPI, courseAPI, certificateAPI, notificationAPI, admissionAPI, branchAPI } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
} from 'recharts';

// Import new components
import WelcomeBanner from '@/components/dashboard/WelcomeBanner';
import KPICard from '@/components/dashboard/KPICard';
import ChartCard from '@/components/dashboard/ChartCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import CircularProgress from '@/components/dashboard/CircularProgress';
import { SkeletonCards, SkeletonChart } from '@/components/shared/SkeletonLoader';

const CHART_COLORS = ['#2a9f90', '#8b5cf6', '#f59e0b', '#3b82f6', '#f43f5e'];

export default function AdminDashboardPage() {
  const user = getStoredUser();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const branchParam = selectedBranchId || undefined;

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('selected_org_id') || '' : '';

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
  };

  // Data fetching
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchAPI.getAll(true).then((d: any) => Array.isArray(d) ? d : d?.results || []),
    staleTime: 10 * 60 * 1000,
  });

  const { data: analytics = null, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedBranchId, orgId],
    queryFn: () => authAPI.getAnalyticsOverview(branchParam, orgId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['admin-courses', selectedBranchId, orgId],
    queryFn: () => courseAPI.getAll({ branch_id: branchParam, organization_id: orgId }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: certsRes = [] } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => certificateAPI.getAll().catch(() => []),
    staleTime: 10 * 60 * 1000,
  });

  const { data: leadsRes = [] } = useQuery({
    queryKey: ['leads', selectedBranchId],
    queryFn: () => admissionAPI.getLeads(false, branchParam).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: pipelineRes = null } = useQuery({
    queryKey: ['lead-stats', selectedBranchId],
    queryFn: () => admissionAPI.getLeadStats(branchParam).catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const fetchEnrollmentCount = async (extra: Record<string, string>) => {
    const res = await courseAPI.getEnrollments({ page: 1, limit: 1, ...extra, branch_id: branchParam }).catch(() => ({ total: 0 }));
    return res?.total ?? 0;
  };

  const { data: enrollTotal = 0 } = useQuery({
    queryKey: ['enrollments', 'total', selectedBranchId],
    queryFn: () => fetchEnrollmentCount({}),
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollActive = 0 } = useQuery({
    queryKey: ['enrollments', 'active', selectedBranchId],
    queryFn: () => fetchEnrollmentCount({ status: 'enrolled' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollAlumni = 0 } = useQuery({
    queryKey: ['enrollments', 'alumni', selectedBranchId],
    queryFn: () => fetchEnrollmentCount({ status: 'completed' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollUpcoming = 0 } = useQuery({
    queryKey: ['enrollments', 'upcoming', selectedBranchId],
    queryFn: () => fetchEnrollmentCount({ class_status: 'upcoming', status: 'enrolled' }),
    staleTime: 5 * 60 * 1000,
  });

  // Computed values
  const certCount = Array.isArray(certsRes) ? certsRes.length : 0;
  const parsedLeads = Array.isArray(leadsRes) ? leadsRes : [];
  const leadsCount = parsedLeads.length || 0;
  const pipeline = (pipelineRes as any)?.pipeline || null;
  const totalTeachers = analytics?.total_teachers ?? 0;

  // Build top courses
  const topCourses = courses
    .filter((c: any) => c.active)
    .slice(0, 5)
    .map((c: any) => ({
      name: c.name?.length > 20 ? c.name.slice(0, 20) + '...' : c.name,
      enrollments: c.total_students || 0,
    }));

  // Build activity feed from recent users
  const recentActivities = (analytics?.recent_users || []).slice(0, 5).map((u: any, i: number) => ({
    id: `user-${i}`,
    type: 'enrollment' as const,
    title: `${u.full_name || 'New user'} joined`,
    description: `Registered as ${u.role}`,
    timestamp: u.created_at,
    user: u.full_name,
  }));

  // Enrollment trend data
  const enrollmentTrends = analytics?.enrollment_trends || [];

  // Demographics data
  const demographics = analytics?.demographics || [];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Welcome Banner */}
      <WelcomeBanner
        userName={(user as any)?.full_name?.split(' ')[0] || 'Administrator'}
        role={(user as any)?.role}
      />

      {/* Branch Filter & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="form-input-sm w-48"
          >
            <option value="">All Branches</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <button onClick={refreshAll} className="btn-ghost text-xs">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Total Enrollments"
            value={enrollTotal}
            icon={<Users className="w-6 h-6" />}
            color="teal"
          />
          <KPICard
            title="Active Learners"
            value={enrollActive}
            icon={<Activity className="w-6 h-6" />}
            color="blue"
            subtitle="In Progress"
          />
          <KPICard
            title="Alumni"
            value={enrollAlumni}
            icon={<GraduationCap className="w-6 h-6" />}
            color="green"
            subtitle="Certified"
          />
          <KPICard
            title="Upcoming"
            value={enrollUpcoming}
            icon={<Calendar className="w-6 h-6" />}
            color="orange"
            subtitle="Not Started"
          />
          <KPICard
            title="Entrance Leads"
            value={leadsCount}
            icon={<Target className="w-6 h-6" />}
            color="purple"
          />
          <KPICard
            title="Faculty"
            value={totalTeachers}
            icon={<Briefcase className="w-6 h-6" />}
            color="teal"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Trend Chart */}
        <ChartCard
          title="Enrollment Trend"
          subtitle="New registrations over time"
          className="lg:col-span-2"
          loading={analyticsLoading}
        >
          <div className="h-[300px] w-full">
            {enrollmentTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2a9f90" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2a9f90" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                  />
                  <Area type="monotone" dataKey="students" stroke="#2a9f90" strokeWidth={3} fillOpacity={1} fill="url(#enrollmentGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                <div className="text-center">
                  <Target size={48} strokeWidth={1} />
                  <p className="text-sm font-medium mt-4">No enrollment data yet</p>
                </div>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Demographics Chart */}
        <ChartCard
          title="Demographics"
          subtitle="Gender distribution"
          loading={analyticsLoading}
        >
          <div className="flex flex-col items-center">
            <div className="relative w-[200px] h-[200px]">
              {demographics.length > 0 ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <p className="text-3xl font-black text-slate-900">{analytics?.enrolled_students || 0}</p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={demographics}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {demographics.map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <p className="text-xs">No data</p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="w-full mt-4 space-y-2">
              {demographics.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-xs font-medium text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Courses & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Courses Chart */}
        <ChartCard
          title="Top Courses"
          subtitle="By enrollment count"
          className="lg:col-span-2"
          loading={coursesLoading}
          actions={
            <Link href="/admin/courses" className="text-xs font-medium text-brand-teal hover:underline">
              View All
            </Link>
          }
        >
          <div className="h-[300px] w-full">
            {topCourses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCourses} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 11 }} width={140} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="enrollments" radius={[0, 8, 8, 0]} barSize={24}>
                    {topCourses.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <BookOpen size={48} strokeWidth={1} />
                <p className="text-sm font-medium mt-4">No courses yet</p>
                <Link href="/admin/courses" className="text-xs text-brand-teal mt-2 hover:underline">
                  Create your first course
                </Link>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Activity Feed */}
        <ActivityFeed
          activities={recentActivities}
          loading={analyticsLoading}
        />
      </div>

      {/* Admission Pipeline */}
      {pipeline && (
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Admission Pipeline</h3>
              <p className="text-xs text-slate-500">Student acquisition funnel</p>
            </div>
            <Link href="/admin/leads" className="text-xs font-medium text-brand-teal hover:underline">
              Manage Pipeline
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Leads', value: pipeline.total_leads, color: 'bg-slate-100 text-slate-700', barColor: 'bg-slate-400', icon: Target },
              { label: 'Passed Test', value: pipeline.passed_test, color: 'bg-blue-50 text-blue-700', barColor: 'bg-blue-500', icon: CheckCircle2 },
              { label: 'Deposit Paid', value: pipeline.deposit_paid, color: 'bg-amber-50 text-amber-700', barColor: 'bg-amber-500', icon: Briefcase },
              { label: 'Converted', value: pipeline.converted_to_student, color: 'bg-emerald-50 text-emerald-700', barColor: 'bg-emerald-500', icon: GraduationCap },
            ].map((step, i) => {
              const pct = pipeline.total_leads > 0 ? Math.round((step.value / pipeline.total_leads) * 100) : 0;
              return (
                <div key={i} className={cn('rounded-2xl p-5', step.color)}>
                  <div className="flex items-center justify-between mb-3">
                    <step.icon size={18} />
                    <span className="text-2xl font-black">{step.value}</span>
                  </div>
                  <p className="text-xs font-medium opacity-70 mb-2">{step.label}</p>
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', step.barColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-medium opacity-50 mt-1 block">{pct}% of leads</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Users', desc: 'Manage personnel', icon: Users, href: '/admin/users', color: 'from-brand-teal to-emerald-600' },
          { label: 'Courses', desc: 'Academic programs', icon: BookOpen, href: '/admin/courses', color: 'from-brand-dark to-slate-800' },
          { label: 'Enrollments', desc: 'Student registry', icon: GraduationCap, href: '/admin/enrollments', color: 'from-amber-500 to-orange-600' },
          { label: 'Notifications', desc: 'Broadcast alerts', icon: Bell, href: '/admin/notifications', color: 'from-rose-500 to-pink-600' },
        ].map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity", item.color)} />
            <div className="absolute top-0 right-0 p-6 opacity-20 transition-transform group-hover:rotate-12 duration-500">
              <item.icon size={60} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm inline-block mb-3">
                <item.icon size={20} />
              </div>
              <h4 className="text-lg font-bold">{item.label}</h4>
              <p className="text-xs text-white/70 mt-1">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
