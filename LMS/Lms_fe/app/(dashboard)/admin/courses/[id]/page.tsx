'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BookOpen, Users, Calendar, Clock, Edit,
  BarChart3, Settings,
} from 'lucide-react';
import { courseAPI } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/shared/PageHeader';
import KPICard from '@/components/dashboard/KPICard';
import { SkeletonCards } from '@/components/shared/SkeletonLoader';
import EmptyState from '@/components/shared/EmptyState';

type TabType = 'overview' | 'enrollments' | 'schedule' | 'settings';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    if (courseId) fetchCourseData();
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const [courseRes, enrollRes, sessionsRes] = await Promise.all([
        courseAPI.getById(courseId).catch(() => null),
        courseAPI.getEnrollments({ course_id: courseId, limit: 100 }).catch(() => ({ items: [], total: 0 })),
        courseAPI.getScheduledClasses(courseId).catch(() => []),
      ]);
      setCourse(courseRes);
      setEnrollments(enrollRes?.items || (Array.isArray(enrollRes) ? enrollRes : []));
      setSessions(Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.results || []);
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <SkeletonCards count={4} />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        icon={<BookOpen className="w-10 h-10" />}
        title="Course not found"
        description="The course you're looking for doesn't exist or has been removed."
        action={{ label: "Back to Courses", onClick: () => router.push('/admin/courses') }}
      />
    );
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    closed: { label: 'Closed', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
    coming_soon: { label: 'Coming Soon', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  };

  const status = statusConfig[course.admission_status] || statusConfig.coming_soon;

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'enrollments', label: 'Enrollments', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title={course.name}
        subtitle={course.description || 'Course details and management'}
        badge={course.specialization?.name || 'Course'}
        backLink={{ label: 'Back to Courses', href: '/admin/courses' }}
        actions={
          <Link href={`/admin/courses?edit=${courseId}`} className="btn-primary">
            <Edit className="w-4 h-4" /> Edit Course
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', status.bg, status.color)}>
          {status.label}
        </span>
        {course.level && (
          <span className="text-xs text-slate-500">Level {course.level} &bull; {course.duration} months</span>
        )}
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total Enrolled" value={enrollments.length} icon={<Users className="w-5 h-5" />} color="teal" />
            <KPICard title="Scheduled Classes" value={sessions.length} icon={<Calendar className="w-5 h-5" />} color="blue" />
            <KPICard title="Duration" value={`${course.duration} mo`} icon={<Clock className="w-5 h-5" />} color="orange" />
            <KPICard title="Level" value={course.level === 1 ? 'Beginner' : 'Advanced'} icon={<BarChart3 className="w-5 h-5" />} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-card p-6">
              <h3 className="section-heading">Course Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="card-label">Description</label>
                  <p className="text-sm text-slate-700">{course.description || 'No description provided'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="card-label">Specialization</label>
                    <p className="text-sm text-slate-700">{course.specialization?.name || '—'}</p>
                  </div>
                  <div>
                    <label className="card-label">Course Code</label>
                    <p className="text-sm text-slate-700 font-mono">{course.course_code || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="premium-card p-6">
              <h3 className="section-heading">Quick Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'Admission Status', value: status.label, color: status.color },
                  { label: 'Active', value: course.active ? 'Yes' : 'No' },
                  { label: 'Total Students', value: course.total_students || 0 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className={cn('text-sm font-bold', item.color || 'text-slate-800')}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'enrollments' && (
        <div className="space-y-4">
          {enrollments.length === 0 ? (
            <EmptyState icon={<Users className="w-10 h-10" />} title="No enrollments yet" description="Students will appear here once they enroll." />
          ) : (
            <div className="premium-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="ui-table-head text-left">Student</th>
                    <th className="ui-table-head text-left">Roll Number</th>
                    <th className="ui-table-head text-left">Status</th>
                    <th className="ui-table-head text-left">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e: any) => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="ui-table-cell font-medium">{e.student_name || 'Student'}</td>
                      <td className="ui-table-cell font-mono text-xs">{e.roll_number || '—'}</td>
                      <td className="ui-table-cell">
                        <span className={cn('badge', e.status === 'enrolled' ? 'badge-green' : 'badge-slate')}>{e.status}</span>
                      </td>
                      <td className="ui-table-cell text-xs text-slate-500">
                        {e.registration_date ? new Date(e.registration_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <EmptyState icon={<Calendar className="w-10 h-10" />} title="No scheduled classes" description="Create scheduled classes to organize this course." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((s: any) => (
                <div key={s.id} className="premium-card p-5">
                  <h4 className="font-bold text-slate-800 mb-2">Section {s.section || '—'}</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> {s.start_time} - {s.end_time}</div>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> {(s.days || []).join(', ')}</div>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> {s.total_students || 0} students</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="premium-card p-6">
          <h3 className="section-heading">Course Settings</h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-800">Archive Course</p>
              <p className="text-xs text-slate-500">Soft-delete this course</p>
            </div>
            <button className="btn-danger text-xs">Archive</button>
          </div>
        </div>
      )}
    </div>
  );
}
