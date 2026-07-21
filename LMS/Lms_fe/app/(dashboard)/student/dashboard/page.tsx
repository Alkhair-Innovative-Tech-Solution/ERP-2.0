'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, FileText, CheckCircle, Clock, TrendingUp, Award,
  ArrowRight, PlayCircle, Calendar, Flame, Star, Zap,
  ChevronRight, BarChart3, Target, BookMarked, MapPin,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { courseAPI, assignmentAPI, authAPI, userAPI } from '@/lib/api';
import { getStoredUser, setStoredUser } from '@/lib/auth';
import { useCurrentTime } from '@/hooks/useCurrentTime';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function StudentDashboard() {
    const currentTime = useCurrentTime();
    const queryClient = useQueryClient();
    const storedUser = getStoredUser();
    const router = useRouter();
    const userId = storedUser?.id;

    const { data: fresh = null } = useQuery({
      queryKey: ['student-current-user', userId],
      queryFn: () => authAPI.getCurrentUser().then((u: any) => { setStoredUser(u); return u; }),
      staleTime: 10 * 60 * 1000,
    });
    const current = fresh || storedUser;

    const { data: teachersList = [] } = useQuery({
      queryKey: ['student-teachers'],
      queryFn: () => userAPI.getTeachers().catch(() => []),
      staleTime: 10 * 60 * 1000,
    });

    const { data: enrollmentsData = [] } = useQuery({
      queryKey: ['student-enrollments', userId],
      queryFn: () => courseAPI.getMyEnrollments().then((d: any) =>
        Array.isArray(d) ? d : d.results || []
      ),
      staleTime: 5 * 60 * 1000,
    });

    const activeEnrollments = (enrollmentsData as any[]).filter(
      (e: any) => e.status === 'enrolled' || e.status === 'Enrolled'
    );

    const coursesWithProgress = useMemo(() =>
      activeEnrollments.map((e: any) => {
        const instructorId = e.scheduled_class?.instructor_id;
        const instructor = (teachersList as any[]).find((t: any) => t.id === instructorId);
        return {
          ...(e.course || e),
          id: (e.course || e).id || e.course_id,
          enrollment_id: e.id,
          progress: e.progress || 0,
          enrollment_date: e.registration_date,
          title: (e.course || e).name || (e.course || e).title,
          scheduled_class: e.scheduled_class,
          roll_number: e.roll_number,
          instructor_name: instructor?.full_name || 'Awaiting Selection',
          instructor_specialization: instructor?.specialization || ''
        };
      }),
    [activeEnrollments, teachersList]);

    const courseIds = coursesWithProgress.map((c: any) => c.id).filter(Boolean);

    const { data: assignments = [] } = useQuery({
      queryKey: ['student-assignments', ...courseIds],
      queryFn: async () => {
        if (courseIds.length === 0) return [];
        const results = await Promise.all(
          courseIds.map((id: string) => assignmentAPI.getAll(id).catch(() => []))
        );
        return results
          .flat()
          .filter((a: any, i: number, s: any[]) => i === s.findIndex((t: any) => t.id === a.id))
          .sort((a: any, b: any) =>
            (a.due_date ? new Date(a.due_date).getTime() : Infinity) -
            (b.due_date ? new Date(b.due_date).getTime() : Infinity)
          );
      },
      enabled: courseIds.length > 0,
      staleTime: 5 * 60 * 1000,
    });

    const upcoming = (assignments as any[]).filter((a: any) => a.due_date && new Date(a.due_date) > new Date());
    const completed = coursesWithProgress.filter((c: any) => c.progress === 100).length;

    const greeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 17) return 'Good Afternoon';
      return 'Good Evening';
    };
  
    return (
      <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
  
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-brand-teal" />
            {greeting()}, <span className="text-brand-teal">{current?.first_name || current?.username || 'Student'}</span>
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Track your learning progress and assignments</p>
        </div>

      {/* â”€â”€ Stat Cards (Admin Layout) â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { icon: BookOpen, label: 'Courses', value: coursesWithProgress.length, trend: 'My tracks', color: 'teal' },
          { icon: FileText, label: 'To-do', value: upcoming.length, trend: 'Due soon', color: 'orange' },
          { icon: CheckCircle, label: 'Done', value: completed, trend: 'Finished', color: 'emerald' },
          { icon: TrendingUp, label: 'Streak', value: '5 Days', trend: 'Active streak', color: 'rose' },
        ].map((card, i) => (
          <div key={i} className="premium-card p-6 flex flex-col group relative overflow-hidden">
            <div className={cn(
              "absolute -right-2 -top-2 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
              card.color === 'teal' ? "bg-brand-teal" : card.color === 'orange' ? "bg-brand-orange" : card.color === 'emerald' ? "bg-emerald-500" : "bg-rose-500"
            )} />
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500 shadow-sm',
              card.color === 'teal' ? 'bg-brand-teal/10 text-brand-teal' :
              card.color === 'orange' ? 'bg-brand-orange/10 text-brand-orange' :
              card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            )}>
              <card.icon size={20} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 leading-none">{card.label}</p>
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{card.value}</h3>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400">{card.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Main Grid â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* My Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                  <BookMarked className="w-5 h-5" />
                </div>
                My Courses
              </h2>
              <p className="text-sm font-medium text-slate-400 mt-1 ml-13">Continue your lessons</p>
            </div>
            <button onClick={() => router.push('/student/my-courses')} className="text-[11px] font-black text-brand-teal uppercase tracking-widest hover:bg-brand-teal/5 px-4 py-2 rounded-xl transition-all">
              View All Courses
            </button>
          </div>

          {coursesWithProgress.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-16 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <BookOpen className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Start Learning</h3>
              <p className="text-sm font-medium text-slate-400 mb-8 max-w-xs mx-auto">You haven't joined any courses yet. Take a look at what we offer!</p>
              <button onClick={() => router.push('/student/my-courses')} className="px-8 py-3.5 bg-brand-teal text-white text-sm font-black rounded-2xl hover:bg-teal-600 transition-all shadow-xl shadow-brand-teal/20">
                Browse Courses
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {coursesWithProgress.slice(0, 4).map((course, idx) => {
                const colors = [
                  { from: 'from-brand-teal', to: 'to-teal-600', text: 'text-brand-teal', bg: 'bg-teal-50' },
                  { from: 'from-brand-dark', to: 'to-slate-800', text: 'text-brand-dark', bg: 'bg-slate-100' },
                  { from: 'from-brand-orange', to: 'to-orange-600', text: 'text-brand-orange', bg: 'bg-orange-50' },
                  { from: 'from-slate-700', to: 'to-slate-900', text: 'text-slate-600', bg: 'bg-slate-50' },
                ];
                const c = colors[idx % colors.length];
                return (
                  <div key={course.id} className="group bg-white rounded-[2rem] border border-slate-50 shadow-lg shadow-slate-200/30 hover:shadow-2xl hover:shadow-slate-300/40 hover:-translate-y-2 transition-all duration-500 overflow-hidden flex flex-col">
                    <div className={cn('relative h-36 p-6 bg-gradient-to-br text-white overflow-hidden', c.from, c.to)}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-inner font-black">
                            {course.title?.[0] || 'ðŸ“š'}

                          </div>
                          <div>
                            <h3 className="font-black text-base leading-tight line-clamp-2">{course.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{course.course_code}</span>
                              {course.roll_number && (
                                <>
                                  <span className="text-white/20">|</span>
                                  <span className="text-[10px] font-bold text-brand-teal uppercase tracking-widest">{course.roll_number}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Instructor Info on Card */}
                        <div className="flex items-center gap-3 bg-black/10 backdrop-blur-sm p-2 rounded-xl border border-white/5 mt-auto">
                           <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black">
                              {course.instructor_name?.[0]}
                           </div>
                           <div className="min-w-0">
                              <p className="text-[9px] font-black text-white/50 uppercase tracking-tighter leading-none">Instructor</p>
                              <p className="text-[11px] font-black text-white truncate">{course.instructor_name}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mastery Level</span>
                            <span className="text-xs font-black text-slate-900">{course.progress || 0}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
                            <div className={cn('h-full rounded-full transition-all duration-1000 shadow-sm', c.from)} style={{ width: `${course.progress || 0}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                          {course.scheduled_class && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Schedule</span>
                              <span className="text-[11px] font-bold text-slate-700 truncate">{course.scheduled_class.days?.join(', ') || 'N/A'}</span>
                            </div>
                          )}
                          {course.branch_name && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Campus</span>
                              <span className="text-[11px] font-bold text-brand-teal truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {course.branch_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-6">
                        <button
                          onClick={() => router.push(`/student/courses/${course.id}`)}
                          className="btn-primary flex-1 !bg-brand-dark !text-white rounded-xl py-3"
                        >
                          View Lectures
                        </button>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Learning Roadmap / Path Section */}
          <div className="mt-12 bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Learning Roadmap</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Your academic progression</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-teal" />
                  <span className="text-[9px] font-black text-slate-400 uppercase">Completed</span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                  <span className="text-[9px] font-black text-slate-400 uppercase">Upcoming</span>
                </div>
              </div>
            </div>
            <div className="p-10">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
                {/* Horizontal Connector Line for Desktop */}
                <div className="hidden lg:block absolute top-[28px] left-[56px] right-[56px] h-[2px] bg-slate-100 z-0" />
                
                {[
                  { title: 'Orientation & Fundamentals', status: 'completed', date: 'Oct 15' },
                  { title: 'Advanced Core Concepts', status: 'active', date: 'Now' },
                  { title: 'Project Implementation', status: 'upcoming', date: 'Nov 10' },
                  { title: 'Final Certification', status: 'upcoming', date: 'Dec 05' },
                ].map((step, i) => (
                  <div key={i} className="flex lg:flex-col items-center lg:items-center text-center gap-6 group relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-4 border-white shadow-xl transition-all duration-500 group-hover:scale-110",
                      step.status === 'completed' ? "bg-brand-teal text-white" : 
                      step.status === 'active' ? "bg-brand-orange text-white animate-pulse" : "bg-slate-50 text-slate-300"
                    )}>
                      {step.status === 'completed' ? <CheckCircle size={24} /> : 
                       step.status === 'active' ? <Zap size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <h4 className={cn("text-sm font-black tracking-tight", step.status === 'upcoming' ? "text-slate-400" : "text-slate-900")}>
                        {step.title}
                      </h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {step.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* â”€â”€ Personal Identity Hub (New Professional Section) â”€â”€ */}
          <div className="mt-12">
             <div className="flex items-center gap-3 mb-6 px-2">
                <div className="w-10 h-10 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Student Identity Hub</h2>
                  <p className="text-sm font-medium text-slate-400">Your verified institutional profile</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <IdentityField label="Full Name" value={current?.full_name || 'N/A'} icon={Award} />
                <IdentityField label="Father's Name" value={(current as any)?.father_name || 'N/A'} icon={BookOpen} />
                <IdentityField label="CNIC / B-Form" value={(current as any)?.cnic || 'N/A'} icon={FileText} />
                <IdentityField label="WhatsApp Number" value={(current as any)?.whatsapp_number || current?.phone || 'N/A'} icon={PlayCircle} />
                <IdentityField label="LMS Student ID" value={(current as any)?.student_id || 'AIT-2024-0001'} icon={Zap} />
                <IdentityField label="Residential Address" value={(current as any)?.address || 'Address not listed'} icon={FileText} />
             </div>

          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-8">

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                  <Clock className="w-4 h-4" />
                </div>
                Upcoming Deadlines
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {upcoming.length > 0 ? (
                upcoming.slice(0, 4).map((a) => {
                  const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000);
                  const isUrgent = daysLeft <= 2;
                  return (
                    <div key={a.id} className="p-6 hover:bg-slate-50/50 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-black text-slate-800 truncate group-hover:text-brand-orange transition-colors">{a.title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{a.course?.course_code || 'General'}</p>
                        </div>
                        <span className={cn('shrink-0 text-[10px] font-black px-2.5 py-1 rounded-xl border',
                          isUrgent ? 'bg-orange-50 text-brand-orange border-brand-orange/10' : 'bg-slate-50 text-slate-500 border-slate-100'
                        )}>
                          {daysLeft <= 0 ? (daysLeft === 0 ? 'Today!' : 'Overdue') : `${daysLeft}d left`}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Due: {new Date(a.due_date).toLocaleDateString()}</span>
                        <Link href={`/student/assignments/${a.id}`} className="text-[11px] font-black text-brand-teal hover:underline flex items-center gap-1 group/btn">
                          View Details <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-gray-400">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500 opacity-20" />
                  </div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">All caught up!</p>
                </div>
              )}
            </div>
            <button onClick={() => router.push('/student/assignments')} className="w-full py-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50 hover:bg-slate-100 transition-colors border-t border-slate-50">
              View Assignments
            </button>
          </div>

          {/* Course Progress Snapshot */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
            <h3 className="text-base font-black text-slate-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                <Target className="w-4 h-4" />
              </div>
              My Progress
            </h3>
            <div className="space-y-6">
              {coursesWithProgress.slice(0, 3).map((c, i) => {
                const colors = ['bg-brand-teal', 'bg-brand-dark', 'bg-brand-orange'];
                return (
                  <div key={c.id} className="space-y-2.5">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider truncate max-w-[140px]">{c.title}</span>
                      <span className="text-xs font-black text-slate-900">{c.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div className={cn('h-full rounded-full transition-all duration-1000 shadow-sm', colors[i % colors.length])} style={{ width: `${c.progress || 0}%` }} />
                    </div>
                  </div>
                );
              })}
              {coursesWithProgress.length === 0 && <p className="text-xs font-bold text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed">Enroll in a track to monitor progress</p>}
            </div>
          </div>

          {/* Motivational CTA */}
          <div className="relative overflow-hidden rounded-[2rem] p-8 bg-brand-dark text-white shadow-2xl shadow-brand-dark/20 border border-white/5 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-4 h-4 text-brand-orange animate-pulse" />
              <span className="text-[10px] font-black text-brand-teal uppercase tracking-[0.2em]">Success</span>
              </div>
              <p className="text-lg font-black mb-6 leading-tight">Download your certificates here.</p>
              <button
                onClick={() => router.push('/student/certificates')}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 backdrop-blur-md"
              >
                <Award className="w-4 h-4 text-brand-teal" />
                Get Certificates
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function IdentityField({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-teal/10 group-hover:text-brand-teal transition-all">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-sm font-black text-slate-800 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

