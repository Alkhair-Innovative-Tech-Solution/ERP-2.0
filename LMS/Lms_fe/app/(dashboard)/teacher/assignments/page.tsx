'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Clock, CheckCircle, AlertCircle, ChevronRight, Users } from 'lucide-react';
import { courseAPI, assignmentAPI, submissionAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, pending: 0, graded: 0 });
  const user = getStoredUser();
  const router = useRouter();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const coursesData = await courseAPI.getMyCourses();
      const coursesList = Array.isArray(coursesData) ? coursesData : (coursesData as any).results || [];
      setCourses(coursesList);

      const allAssignments: any[] = [];
      let totalPending = 0;
      let totalGraded = 0;

      for (const course of coursesList) {
        const data = await assignmentAPI.getAll(course.id).catch(() => ({ results: [] }));
        const list = Array.isArray(data) ? data : (data as any).results || [];
        const enriched = list.map((a: any) => ({ ...a, course_name: course.name || course.title }));
        allAssignments.push(...enriched);
      }

      const totalUngraded = await submissionAPI.getUngradedCount(user?.id || '').catch(() => 0);

      allAssignments.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setAssignments(allAssignments);
      setStats({ total: allAssignments.length, pending: totalUngraded, graded: Math.max(0, totalUngraded) });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const filtered = assignments.filter(a => {
    if (selectedCourse !== 'all') {
      const courseId = a.course?.id || a.course_id;
      if (courseId !== selectedCourse) return false;
    }
    if (searchQuery && !a.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-3 border-slate-100 border-t-brand-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-brand-teal" />
            Assignments
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Manage and grade student submissions.</p>
        </div>
        <button
          onClick={() => router.push('/teacher/assignments/create')}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
          { label: 'To Grade', value: stats.pending, color: 'bg-orange-50 text-brand-orange' },
          { label: 'Graded', value: stats.graded, color: 'bg-emerald-50 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={cn('px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2', s.color)}>
            {s.label === 'To Grade' && <AlertCircle className="w-4 h-4" />}
            {s.label === 'Graded' && <CheckCircle className="w-4 h-4" />}
            <span>{s.value}</span>
            <span className="opacity-70">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => setSelectedCourse('all')}
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-medium transition-colors border',
            selectedCourse === 'all'
              ? 'bg-brand-teal text-white border-brand-teal'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-teal/30'
          )}
        >
          All
        </button>
        {courses.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setSelectedCourse(c.id)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-colors border',
              selectedCourse === c.id
                ? 'bg-brand-teal text-white border-brand-teal'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-teal/30'
            )}
          >
            {c.name || c.title}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search assignments..."
          className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none bg-white"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Assignment Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">No assignments found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => {
            const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'CLOSED';
            return (
              <div
                key={a.id}
                onClick={() => router.push(`/teacher/assignments/${a.id}`)}
                className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
              >
                {/* Status bar */}
                <div className={cn(
                  'w-1 h-10 rounded-full shrink-0',
                  isOverdue ? 'bg-red-500' : a.status === 'CLOSED' ? 'bg-slate-300' : 'bg-brand-teal'
                )} />

                {/* Icon */}
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  isOverdue ? 'bg-red-50' : 'bg-teal-50'
                )}>
                  <FileText className={cn('w-5 h-5', isOverdue ? 'text-red-500' : 'text-brand-teal')} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-teal transition-colors">
                      {a.title}
                    </p>
                    {a.status === 'CLOSED' && (
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Closed</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.course_name || a.course?.name || ''}
                    {a.due_date && ` â€¢ Due ${new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                    {a.total_marks && ` â€¢ ${a.total_marks} pts`}
                  </p>
                </div>

                {/* Right info */}
                <div className="text-right hidden sm:block">
                  {isOverdue && <p className="text-xs font-medium text-red-500">Overdue</p>}
                  {!isOverdue && a.due_date && !a.status?.includes('CLOSED') && (
                    <p className="text-xs text-slate-400 font-medium">
                      {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-teal transition-colors hidden sm:block" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
