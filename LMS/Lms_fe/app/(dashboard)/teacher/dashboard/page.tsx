'use client';

import {
  GraduationCap, Users, FileText, Calendar, CheckCircle, Video,
  ChevronRight, Clock, BookMarked, Star,
  ArrowUpRight, PlusCircle, Edit3, Eye,
  RefreshCw, LayoutDashboard,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { courseAPI, submissionAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCurrentTime } from '@/hooks/useCurrentTime';

export default function TeacherDashboard() {
  const currentTime = useCurrentTime();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const router = useRouter();

  const { data: courses = [] } = useQuery({
    queryKey: ['teacher-courses', user?.id],
    queryFn: () => courseAPI.getMyCourses().then((d: any) => {
      const list = Array.isArray(d) ? d : d?.results || [];
      return list;
    }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: () => courseAPI.getScheduledClasses(undefined, user?.id).then((d: any) =>
      Array.isArray(d) ? d : d?.results || []
    ),
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['teacher-enrollments', user?.id],
    queryFn: () => courseAPI.getEnrollmentsByInstructor(user?.id || '').then((d: any) => {
      const list = Array.isArray(d) ? d : d?.results || [];
      return list;
    }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: ungradedCount = 0 } = useQuery({
    queryKey: ['ungraded-count', user?.id],
    queryFn: () => submissionAPI.getUngradedCount(user?.id || ''),
    staleTime: 2 * 60 * 1000,
  });

  const { data: contentData = [] } = useQuery({
    queryKey: ['teacher-content'],
    queryFn: () => courseAPI.getCourseContent().then((d: any) =>
      Array.isArray(d) ? d : d?.results || []
    ),
    staleTime: 5 * 60 * 1000,
  });

  const uniqueStudents = new Set(
    (enrollments as any[]).filter((e: any) => e.completion_status !== 'DROPPED').map((e: any) => e.student_id)
  );
  const todayClasses = (classes as any[]).filter((c: any) =>
    c.days?.includes(new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase())
  ).length;

  const stats = {
    totalClasses: (classes as any[]).length,
    totalStudents: uniqueStudents.size,
    activeCourses: (courses as any[]).length,
    pendingGrading: ungradedCount as number,
    todayClasses,
    totalContent: (contentData as any[]).length,
  };

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const batches = Array.from(new Set(classes.map((c: any) => c.batch?.name).filter(Boolean)));
  const userName = user?.first_name || user?.username || user?.email?.split('@')[0] || 'User';

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* â”€â”€ Dashboard Hero â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-brand-teal" />
            {greeting()}, <span className="text-brand-teal">{userName}</span>
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">
            Today is {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{currentTime.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <p className="text-sm font-black text-slate-800 leading-none tracking-tight">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['teacher-'] })} className="h-11 px-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 bg-white shadow-sm hover:bg-slate-50 transition-all flex gap-2 items-center">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* â”€â”€ KPI Metrics Grid â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <TeacherStatCard icon={GraduationCap} label="Classes Today" value={stats.totalClasses} iconBg="bg-teal-50" iconColor="text-brand-teal" />
        <TeacherStatCard icon={Users} label="Total Students" value={stats.totalStudents} iconBg="bg-slate-100" iconColor="text-brand-dark" />
        <TeacherStatCard icon={BookMarked} label="My Courses" value={stats.activeCourses} iconBg="bg-cyan-50" iconColor="text-cyan-700" />
        <TeacherStatCard icon={CheckCircle} label="To Grade" value={stats.pendingGrading} iconBg="bg-orange-50" iconColor="text-brand-orange" highlight={stats.pendingGrading > 0} />
        <TeacherStatCard icon={Video} label="Materials" value={stats.totalContent} iconBg="bg-slate-50" iconColor="text-slate-600" />
      </div>

      {/* â”€â”€ Primary Intel Row â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="premium-card shadow-xl shadow-slate-200/40 overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50">
            <div>
              <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Schedule Intelligence</p>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Calendar className="w-5 h-5 text-brand-teal" />
                Class Schedule
              </h2>
            </div>
            <button onClick={() => router.push('/teacher/my-classes')} className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-brand-teal hover:border-brand-teal/20 transition-all">Full Schedule</button>
          </div>
          <div className="divide-y divide-slate-100">
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Calendar className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">No active sessions</p>
              </div>
            ) : (
              classes.slice(0, 5).map((cls: any, idx: number) => {
                const isToday = cls.days?.includes(new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase());
                return (
                  <div key={cls.id} className="flex items-center justify-between px-8 py-6 hover:bg-slate-50/50 transition-all group cursor-pointer">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm',
                        isToday ? 'bg-brand-teal text-white shadow-brand-teal/20' : 'bg-slate-100 text-slate-400'
                      )}>
                        0{idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-3 group-hover:text-brand-teal transition-colors">
                          {cls.course?.name || 'Untitled Course'}
                          {isToday && <span className="text-[9px] bg-teal-50 text-brand-teal font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter">TODAY</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{cls.start_time?.slice(0, 5)} â€“ {cls.end_time?.slice(0, 5)}</span>
                          <span className="text-slate-300">|</span>
                          <span>{cls.days?.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {cls.batch && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border border-slate-200/50">
                          {cls.batch.name}
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-brand-orange group-hover:bg-brand-orange/10 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="premium-card shadow-xl shadow-slate-200/40 p-6 bg-brand-dark text-white overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand-teal/10 blur-3xl" />
          <div className="relative z-10 space-y-4">
            <div className="mb-6">
              <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Live Metrics</p>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                <Star className="w-4 h-4 text-brand-orange animate-pulse" />
                Today's Summary
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Classes', val: stats.todayClasses, icon: Calendar },
                { label: 'Students', val: stats.totalStudents, icon: Users },
                { label: 'Grading', val: stats.pendingGrading, icon: CheckCircle },
                { label: 'Materials', val: stats.totalContent, icon: Video },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label} className="bg-white/5 rounded-2xl p-4 border border-white/10 transition-colors hover:bg-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-3.5 h-3.5 text-brand-teal opacity-80" />
                    <span className="text-[9px] uppercase tracking-[0.25em] text-slate-300">Live</span>
                  </div>
                  <p className="text-2xl font-black text-white leading-none">{val}</p>
                  <p className="text-[9px] uppercase tracking-[0.25em] text-slate-300 mt-2">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Secondary Intelligence Row â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-2 gap-6">
          {[
            { icon: Video, label: 'Course Materials', desc: 'Manage your course files', href: '/teacher/my-courses', color: 'text-brand-teal', bg: 'bg-teal-50' },
            { icon: Users, label: 'My Students', desc: 'View and manage student list', href: '/teacher/students', color: 'text-brand-dark', bg: 'bg-slate-100' },
            { icon: FileText, label: 'My Courses', desc: 'Manage your course content', href: '/teacher/my-courses', color: 'text-brand-teal', bg: 'bg-cyan-50' },
            { icon: Edit3, label: 'Grade Assignments', desc: 'Review and grade submissions', href: '/teacher/assignments', color: 'text-brand-orange', bg: 'bg-orange-50' },
          ].map(({ icon: Icon, label, desc, href, color, bg }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className="group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-300/50 hover:-translate-y-2 transition-all duration-500"
            >
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner transition-transform duration-500 group-hover:scale-110', bg)}>
                <Icon className={cn('w-7 h-7', color)} />
              </div>
              <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{label}</p>
              <p className="text-xs text-slate-400 mt-2">{desc}</p>
              <div className="absolute bottom-6 right-6 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-all duration-300">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="premium-card p-8 bg-white border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col">
          <div className="mb-8">
            <p className="text-brand-dark font-black tracking-[0.2em] text-[10px] uppercase mb-1">Performance Metrics</p>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Class Overview</h2>
          </div>
          <div className="flex-1 space-y-8">
            {[
              { label: 'Attendance Rate', pct: 75, color: 'bg-brand-teal' },
              { label: 'Grading Progress', pct: stats.pendingGrading === 0 ? 100 : Math.max(10, 100 - stats.pendingGrading * 10), color: 'bg-brand-dark' },
              { label: 'Course Progress', pct: stats.totalContent > 0 ? Math.min(100, stats.totalContent * 10) : 0, color: 'bg-brand-orange' },
            ].map(({ label, pct, color }) => (
              <div key={label} className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
                  <span className="text-sm font-black text-slate-900">{pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-50 overflow-hidden p-0.5 shadow-inner border border-slate-100">
                  <div className={cn('h-full rounded-full transition-all duration-1000 shadow-sm', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Operational Core Links â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Take Attendance', desc: 'Mark student presence', icon: CheckCircle, href: '/teacher/attendance', color: 'from-brand-teal to-[#208a7d]' },
          { label: 'Grade Assignments', desc: 'Review submissions', icon: Edit3, href: '/teacher/assignments', color: 'from-brand-orange to-red-700' },
          { label: 'Manage Materials', desc: 'Upload course files', icon: PlusCircle, href: '/teacher/my-courses', color: 'from-brand-dark to-[#1a323b]' },
          { label: 'Student List', desc: 'View all students', icon: Eye, href: '/teacher/students', color: 'from-indigo-600 to-purple-700' },
        ].map((item, i) => (
          <Link key={i} href={item.href} className="group relative overflow-hidden rounded-[32px] p-8 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1">
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-[0.95] group-hover:opacity-100 transition-opacity', item.color)} />
            <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform group-hover:rotate-12 duration-500">
              <item.icon size={80} strokeWidth={1} color="white" />
            </div>
            <div className="relative z-10 flex flex-col items-start gap-4">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 text-white">
                <item.icon size={24} />
              </div>
              <div>
                <h4 className="text-lg font-black text-white tracking-tighter leading-tight">{item.label}</h4>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">{item.desc}</p>
              </div>
              <div className="mt-2 w-8 h-8 rounded-full border border-white/30 flex items-center justify-center text-white transition-all group-hover:w-full group-hover:rounded-xl group-hover:bg-white group-hover:text-slate-900 group-hover:border-white">
                <ArrowUpRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TeacherStatCard({ icon: Icon, label, value, iconBg, iconColor, highlight }: any) {
  return (
    <div className={cn(
      'group relative bg-white rounded-[2rem] border border-slate-50 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-300/50 hover:-translate-y-2 transition-all duration-500 p-8 overflow-hidden',
      highlight ? 'ring-2 ring-brand-orange/20 border-brand-orange/10' : ''
    )}>
      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner transition-transform duration-500 group-hover:scale-110', iconBg)}>
        <Icon className={cn('w-7 h-7', iconColor)} />
      </div>

      <div className="relative z-10">
        <p className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{value}</p>
        <p className="text-sm font-black text-slate-700 uppercase tracking-widest leading-none">{label}</p>
      </div>

      {highlight && value > 0 && (
        <span className="absolute top-4 right-4 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-orange" />
        </span>
      )}
    </div>
  );
}

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <a href={href} className={className} onClick={(e) => { e.preventDefault(); router.push(href); }}>
      {children}
    </a>
  );
}
