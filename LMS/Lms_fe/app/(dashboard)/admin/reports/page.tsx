'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, Download, Filter, Calendar, Users, BookOpen,
  TrendingUp, PieChart, FileText, RefreshCw, ChevronDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { courseAPI, authAPI, admissionAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/shared/PageHeader';
import ChartCard from '@/components/dashboard/ChartCard';
import KPICard from '@/components/dashboard/KPICard';
import { SkeletonCards, SkeletonChart } from '@/components/shared/SkeletonLoader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  LineChart, Line, Legend,
} from 'recharts';

const COLORS = ['#2a9f90', '#8b5cf6', '#f59e0b', '#3b82f6', '#f43f5e', '#06b6d4'];

type ReportType = 'enrollment' | 'courses' | 'demographics' | 'performance';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('enrollment');
  const [dateRange, setDateRange] = useState('30d');
  const [selectedBranch, setSelectedBranch] = useState('');

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('selected_org_id') || '' : '';

  // Fetch data
  const { data: analytics = null, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedBranch, orgId],
    queryFn: () => authAPI.getAnalyticsOverview(selectedBranch || undefined, orgId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['admin-courses', selectedBranch, orgId],
    queryFn: () => courseAPI.getAll({ branch_id: selectedBranch || undefined, organization_id: orgId }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { branchAPI } = await import('@/lib/api');
      const d = await branchAPI.getAll(true);
      return Array.isArray(d) ? d : d?.results || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Compute stats
  const totalStudents = analytics?.enrolled_students || 0;
  const totalTeachers = analytics?.total_teachers || 0;
  const totalCourses = courses.filter((c: any) => c.active).length;
  const demographics = analytics?.demographics || [];
  const enrollmentTrends = analytics?.enrollment_trends || [];

  // Course distribution by specialization
  const courseDistribution = courses
    .filter((c: any) => c.active)
    .reduce((acc: Record<string, number>, c: any) => {
      const spec = c.specialization?.name || 'Uncategorized';
      acc[spec] = (acc[spec] || 0) + 1;
      return acc;
    }, {});

  const courseChartData = Object.entries(courseDistribution)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Enrollment by course
  const enrollmentByCourse = courses
    .filter((c: any) => c.active)
    .map((c: any) => ({
      name: c.name?.length > 15 ? c.name.slice(0, 15) + '...' : c.name,
      students: c.total_students || 0,
    }))
    .sort((a, b) => b.students - a.students)
    .slice(0, 10);

  const handleExportCSV = () => {
    let csvContent = '';
    let filename = '';

    if (reportType === 'courses') {
      csvContent = 'Name,Specialization,Level,Duration,Students,Status\n';
      courses.forEach((c: any) => {
        csvContent += `"${c.name}","${c.specialization?.name || ''}",${c.level},${c.duration},${c.total_students || 0},"${c.admission_status}"\n`;
      });
      filename = 'courses_report.csv';
    } else if (reportType === 'enrollment') {
      csvContent = 'Month,Enrollments\n';
      enrollmentTrends.forEach((t: any) => {
        csvContent += `"${t.name}",${t.students}\n`;
      });
      filename = 'enrollment_report.csv';
    } else if (reportType === 'demographics') {
      csvContent = 'Category,Percentage\n';
      demographics.forEach((d: any) => {
        csvContent += `"${d.name}",${d.value}\n`;
      });
      filename = 'demographics_report.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reportTypes: { id: ReportType; label: string; icon: any }[] = [
    { id: 'enrollment', label: 'Enrollment Trends', icon: TrendingUp },
    { id: 'courses', label: 'Course Analytics', icon: BookOpen },
    { id: 'demographics', label: 'Demographics', icon: PieChart },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports & Analytics"
        subtitle="Comprehensive insights into your learning platform"
        badge="Analytics"
        actions={
          <button onClick={handleExportCSV} className="btn-primary">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="form-input-sm w-48"
        >
          <option value="">All Branches</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="form-input-sm w-36"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>

        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                reportType === type.id
                  ? 'bg-white text-brand-teal shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <type.icon className="w-3.5 h-3.5" />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {analyticsLoading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Total Students"
            value={totalStudents}
            icon={<Users className="w-5 h-5" />}
            color="teal"
          />
          <KPICard
            title="Active Courses"
            value={totalCourses}
            icon={<BookOpen className="w-5 h-5" />}
            color="blue"
          />
          <KPICard
            title="Faculty Members"
            value={totalTeachers}
            icon={<Users className="w-5 h-5" />}
            color="green"
          />
          <KPICard
            title="Completion Rate"
            value="78%"
            icon={<TrendingUp className="w-5 h-5" />}
            color="orange"
          />
        </div>
      )}

      {/* Charts based on report type */}
      {reportType === 'enrollment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Enrollment Trend"
            subtitle="New enrollments over time"
            loading={analyticsLoading}
          >
            <div className="h-[300px]">
              {enrollmentTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrollmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="students" stroke="#2a9f90" strokeWidth={3} dot={{ fill: '#2a9f90', strokeWidth: 0, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300">
                  <p className="text-sm">No enrollment data available</p>
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Enrollment by Course"
            subtitle="Top courses by student count"
            loading={coursesLoading}
          >
            <div className="h-[300px]">
              {enrollmentByCourse.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentByCourse} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 11 }} width={120} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="students" radius={[0, 8, 8, 0]} barSize={20}>
                      {enrollmentByCourse.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300">
                  <p className="text-sm">No course data available</p>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      {reportType === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Course Distribution"
            subtitle="By specialization"
            loading={coursesLoading}
          >
            <div className="h-[300px]">
              {courseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={courseChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {courseChartData.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300">
                  <p className="text-sm">No course data available</p>
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Course Status"
            subtitle="Active vs Inactive courses"
            loading={coursesLoading}
          >
            <div className="space-y-4 mt-4">
              {[
                { label: 'Active', count: courses.filter((c: any) => c.active).length, color: 'bg-emerald-500' },
                { label: 'Inactive', count: courses.filter((c: any) => !c.active).length, color: 'bg-slate-300' },
                { label: 'Open Admission', count: courses.filter((c: any) => c.admission_status === 'open').length, color: 'bg-blue-500' },
                { label: 'Coming Soon', count: courses.filter((c: any) => c.admission_status === 'coming_soon').length, color: 'bg-amber-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn('w-3 h-3 rounded-full', item.color)} />
                  <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                  <span className="text-sm font-bold text-slate-800">{item.count}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {reportType === 'demographics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Gender Distribution"
            subtitle="Student demographics"
            loading={analyticsLoading}
          >
            <div className="h-[300px]">
              {demographics.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={demographics}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {demographics.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300">
                  <p className="text-sm">No demographic data available</p>
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Demographics Breakdown"
            subtitle="Detailed percentages"
            loading={analyticsLoading}
          >
            <div className="space-y-4 mt-4">
              {demographics.map((d: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{d.name}</span>
                    <span className="text-sm font-bold text-slate-900">{d.value}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${d.value}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {reportType === 'performance' && (
        <div className="grid grid-cols-1 gap-6">
          <ChartCard
            title="Performance Overview"
            subtitle="Key performance indicators"
            loading={analyticsLoading}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              {[
                { label: 'Avg. Completion', value: '78%', color: 'text-brand-teal' },
                { label: 'Avg. Grade', value: 'B+', color: 'text-blue-600' },
                { label: 'Attendance Rate', value: '92%', color: 'text-emerald-600' },
                { label: 'Satisfaction', value: '4.5/5', color: 'text-amber-600' },
              ].map((stat, i) => (
                <div key={i} className="text-center p-4 bg-slate-50 rounded-xl">
                  <p className={cn('text-3xl font-black', stat.color)}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}