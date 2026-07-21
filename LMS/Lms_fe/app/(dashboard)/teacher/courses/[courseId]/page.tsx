'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  BookOpen, Users, FileText, Calendar, ArrowLeft, Plus, Clock,
  ChevronRight, PlayCircle, CheckCircle, AlertCircle, MessageSquare,
  Paperclip, Download, Video, File, Link as LinkIcon, Image, Layers
} from 'lucide-react';
import { courseAPI, contentAPI, assignmentAPI, submissionAPI, userAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const TAB_COLORS = ['bg-brand-teal', 'bg-brand-dark', 'bg-brand-orange'];

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = getStoredUser();
  const [course, setCourse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'stream' | 'classwork' | 'people'>('classwork');
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.courseId) fetchAll();
  }, [params.courseId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const cid = params.courseId as string;
      const [courseData, curriculumData, assignmentsData] = await Promise.all([
        courseAPI.getById(cid),
        contentAPI.getCurriculum(cid).catch(() => []),
        assignmentAPI.getAll(cid).catch(() => ({ results: [] })),
      ]);
      setCourse(courseData);
      setCurriculum(curriculumData);
      const assignList = Array.isArray(assignmentsData) ? assignmentsData : (assignmentsData as any).results || [];
      setAssignments(assignList);

      const enrollmentsData = await courseAPI.getEnrollmentsByInstructor(user?.id || '').catch(() => []);
      const allEnrollments = Array.isArray(enrollmentsData) ? enrollmentsData : (enrollmentsData as any).results || [];
      const courseEnrollments = allEnrollments.filter((e: any) =>
        (e.course?.id === cid || e.course_id === cid) && e.completion_status !== 'DROPPED'
      );
      const studentIds = courseEnrollments.map((e: any) => e.student_id).filter(Boolean);
      if (studentIds.length > 0) {
        const usersData = await userAPI.getByIds(studentIds).catch(() => []);
        setStudents(Array.isArray(usersData) ? usersData : []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-3 border-slate-100 border-t-brand-teal animate-spin" />
      </div>
    );
  }

  if (!course) return (
    <div className="text-center py-20 text-slate-400">Course not found</div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-brand-teal" />
          {course.title || course.name}
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">{course.course_code}</p>
      </div>

      {/* Course Banner Card */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-br from-brand-teal to-emerald-700 relative">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative p-6 flex flex-col justify-end h-full">
            <button onClick={() => router.back()} className="absolute top-4 left-4 text-white/70 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {(['stream', 'classwork', 'people'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-6 py-3 text-sm font-medium capitalize relative transition-colors',
                activeTab === tab ? 'text-brand-teal' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {tab === 'stream' ? 'Stream' : tab === 'classwork' ? 'Classwork' : 'People'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-teal rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'stream' && <StreamTab course={course} assignments={assignments} />}
      {activeTab === 'classwork' && <ClassworkTab courseId={params.courseId as string} curriculum={curriculum} assignments={assignments} onRefresh={fetchAll} />}
      {activeTab === 'people' && <PeopleTab students={students} />}
    </div>
  );
}

function StreamTab({ course, assignments }: { course: any; assignments: any[] }) {
  const today = new Date();
  const upcoming = assignments
    .filter((a: any) => a.due_date && new Date(a.due_date) >= today)
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);
  const overdue = assignments.filter((a: any) =>
    a.due_date && new Date(a.due_date) < today && a.status !== 'CLOSED'
  );

  return (
    <div className="space-y-4">
      {/* Upcoming */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-teal" />
          Upcoming
        </h2>
        {upcoming.length === 0 && overdue.length === 0 ? (
          <p className="text-sm text-slate-400">No upcoming assignments.</p>
        ) : (
          <div className="space-y-2">
            {overdue.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-red-700 font-medium flex-1">{a.title}</span>
                <span className="text-red-500 text-xs font-medium">Overdue</span>
              </div>
            ))}
            {upcoming.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-teal-50 transition-colors text-sm">
                <FileText className="w-4 h-4 text-brand-teal shrink-0" />
                <span className="text-slate-700 flex-1 font-medium">{a.title}</span>
                <span className="text-slate-400 text-xs">
                  Due {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-teal" />
          Recent Activity
        </h2>
        {assignments.slice(0, 3).map((a: any) => (
          <div key={a.id} className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Assignment â€¢ {a.due_date
                  ? `Due ${new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'No due date'}
              </p>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="text-sm text-slate-400">No recent activity.</p>
        )}
      </div>
    </div>
  );
}

function ClassworkTab({ courseId, curriculum, assignments, onRefresh }: {
  courseId: string; curriculum: any[]; assignments: any[]; onRefresh: () => void;
}) {
  const router = useRouter();
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', points: 100, due_date: '' });
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateAssignment = async () => {
    if (!newAssignment.title.trim()) return;
    setCreating(true);
    try {
      await assignmentAPI.create({
        course_id: courseId,
        title: newAssignment.title,
        total_marks: newAssignment.points,
        due_date: newAssignment.due_date || undefined,
      });
      toast.success('Assignment created');
      setShowCreateAssignment(false);
      setNewAssignment({ title: '', points: 100, due_date: '' });
      onRefresh();
    } catch (err) {
      toast.error('Failed to create assignment');
    } finally {
      setCreating(false);
    }
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      await contentAPI.createModule({ course_id: courseId, title: newModuleTitle, order: curriculum.length + 1 });
      toast.success('Module created');
      setNewModuleTitle('');
      setShowModuleModal(false);
      onRefresh();
    } catch {
      toast.error('Failed to create module');
    }
  };

  const topics = curriculum.length > 0
    ? curriculum
    : [{ id: 'default', title: 'General', lessons: [], isDefault: true }];

  return (
    <div className="space-y-6">
      {/* Topic-based layout */}
      {topics.map((topic: any, tIdx: number) => (
        <div key={topic.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <button
              onClick={() => !topic.isDefault && router.push(`/teacher/courses/${courseId}/content?module_id=${topic.id}`)}
              className="font-bold text-slate-900 text-sm hover:text-brand-teal transition-colors text-left"
            >
              {topic.title}
              {!topic.isDefault && (
                <span className="ml-2 text-xs font-normal text-slate-400 hover:text-brand-teal">Manage</span>
              )}
            </button>
            {topic.id === 'default' ? (
              <button
                onClick={() => setShowModuleModal(true)}
                className="text-xs font-medium text-brand-teal hover:text-teal-700"
              >
                + Add Topic
              </button>
            ) : (
              <button
                onClick={() => router.push(`/teacher/courses/${courseId}/content?module_id=${topic.id}`)}
                className="text-xs font-medium text-brand-teal hover:text-teal-700"
              >
                + Add Materials
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {/* Assignments in this topic */}
            {assignments
              .filter((a: any) => a.module_id === topic.id || (!a.module_id && topic.isDefault))
              .map((a: any) => {
                const isOverdue = a.due_date && new Date(a.due_date) < new Date();
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/teacher/assignments/${a.id}`)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      isOverdue ? 'bg-red-50' : 'bg-teal-50'
                    )}>
                      <FileText className={cn('w-5 h-5', isOverdue ? 'text-red-500' : 'text-brand-teal')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-teal transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.due_date
                          ? `Due ${new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : 'No due date'}
                        {a.total_marks && ` â€¢ ${a.total_marks} pts`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-teal transition-colors" />
                  </div>
                );
              })}
            {/* Module lessons as materials */}
            {topic.lessons?.map((lesson: any) => (
              <div
                key={lesson.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{lesson.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{lesson.duration_minutes || 0} min</p>
                </div>
              </div>
            ))}
            {assignments.filter((a: any) => a.module_id === topic.id || (!a.module_id && topic.isDefault)).length === 0
              && (!topic.lessons || topic.lessons.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                No items in this topic yet.
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add Assignment Button */}
      {showCreateAssignment ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">New Assignment</h3>
          <input
            type="text"
            placeholder="Title"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
            value={newAssignment.title}
            onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })}
            autoFocus
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Points</label>
              <input
                type="number"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={newAssignment.points}
                onChange={e => setNewAssignment({ ...newAssignment, points: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Due Date</label>
              <input
                type="datetime-local"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={newAssignment.due_date}
                onChange={e => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowCreateAssignment(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreateAssignment}
              disabled={creating || !newAssignment.title.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-teal hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => {
              const firstTopic = topics.find((t: any) => !t.isDefault);
              if (firstTopic) router.push(`/teacher/courses/${courseId}/content?module_id=${firstTopic.id}`);
              else setShowModuleModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-brand-teal bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Materials
          </button>
          <button
            onClick={() => setShowCreateAssignment(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-brand-orange bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Create Assignment
          </button>
        </div>
      )}

      {/* Add Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">New Topic</h3>
            <input
              type="text"
              placeholder="Topic title"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none mb-4"
              value={newModuleTitle}
              onChange={e => setNewModuleTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddModule()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModuleModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleAddModule} className="px-5 py-2 text-sm font-medium text-white bg-brand-teal hover:bg-teal-700 rounded-lg">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleTab({ students }: { students: any[] }) {
  return (
    <div className="space-y-6">
      {/* Teacher Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Teacher</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold text-sm">
              T
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">You (Instructor)</p>
              <p className="text-xs text-slate-400">Course teacher</p>
            </div>
          </div>
        </div>
      </div>

      {/* Students Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Students</h3>
          <span className="text-xs text-slate-400 font-medium">{students.length} enrolled</span>
        </div>
        {students.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No students enrolled yet.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {students.map((s: any) => (
              <div key={s.id || s.user_id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                  {(s.full_name || s.first_name || 'S').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{s.full_name || s.first_name || 'Student'}</p>
                  {s.email && <p className="text-xs text-slate-400 truncate">{s.email}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
