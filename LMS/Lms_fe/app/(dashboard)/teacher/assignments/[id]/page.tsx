'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, FileText, CheckCircle, AlertCircle, Clock,
  Download, Save, Search, ChevronRight, Paperclip, Video,
} from 'lucide-react';
import { assignmentAPI, submissionAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function AssignmentGradingPage() {
  const params = useParams();
  const router = useRouter();
  const user = getStoredUser();
  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, { score: number; feedback: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) fetchAll();
  }, [params.id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [assignData, subsData] = await Promise.all([
        assignmentAPI.getById(params.id as string),
        submissionAPI.getAll(params.id as string).catch(() => ({ results: [] })),
      ]);
      setAssignment(assignData);
      const subsList = Array.isArray(subsData) ? subsData : ((subsData as any).results || []);
      setSubmissions(subsList);

      const gradeMap: Record<string, { score: number; feedback: string }> = {};
      subsList.forEach((s: any) => {
        gradeMap[s.student_id] = {
          score: s.score || s.obtained_marks || 0,
          feedback: s.feedback || '',
        };
      });
      setGrades(gradeMap);

      if (subsList.length > 0) setSelectedStudent(subsList[0].student_id);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async (studentId: string) => {
    const g = grades[studentId];
    if (g.score === undefined || g.score === null) return toast.error('Enter a score');

    setSavingId(studentId);
    try {
      const submission = submissions.find(s => s.student_id === studentId);
      if (!submission?.id) {
        toast.error('No submission found for this student');
        setSavingId(null);
        return;
      }
      await submissionAPI.grade(
        submission.id,
        g.score,
        g.feedback,
        user?.id || '',
      );
      toast.success('Grade saved');
    } catch (err) {
      toast.error('Failed to save grade');
    } finally {
      setSavingId(null);
    }
  };

  const isOverdue = assignment?.due_date && new Date(assignment.due_date) < new Date() && assignment?.status !== 'CLOSED';
  const maxMarks = assignment?.total_marks || 100;

  const filtered = submissions.filter(s => {
    if (searchQuery && !s.student_id?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    const hasScore = grades[s.student_id]?.score !== undefined && grades[s.student_id]?.score !== null;
    if (statusFilter === 'graded' && !hasScore) return false;
    if (statusFilter === 'ungraded' && hasScore) return false;
    return true;
  });

  const selectedSubmission = submissions.find(s => s.student_id === selectedStudent);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-3 border-slate-100 border-t-brand-teal animate-spin" />
      </div>
    );
  }

  if (!assignment) return (
    <div className="text-center py-20 text-slate-400">Assignment not found</div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/teacher/assignments')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to assignments
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-brand-teal" />
              {assignment.title}
            </h1>
            <p className="text-sm text-slate-400 font-bold mt-1">
              {assignment.course?.name || assignment.course_name || ''}
              {assignment.due_date && ` â€¢ Due ${new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              {assignment.total_marks && ` â€¢ ${assignment.total_marks} pts`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOverdue && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Overdue
              </span>
            )}
            <span className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              assignment.status === 'ACTIVE' ? 'bg-teal-50 text-brand-teal' : 'bg-slate-100 text-slate-500'
            )}>
              {assignment.status === 'ACTIVE' ? 'Active' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { label: 'Submitted', value: submissions.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'LATE').length, color: 'text-brand-teal' },
            { label: 'Graded', value: submissions.filter((s: any) => s.score !== undefined && s.score !== null && s.score !== '').length, color: 'text-emerald-600' },
            { label: 'Pending', value: submissions.filter((s: any) => s.score === undefined || s.score === null || s.score === '').length, color: 'text-brand-orange' },
            { label: 'Total Students', value: submissions.length, color: 'text-slate-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 text-sm">
              <span className={cn('font-bold', s.color)}>{s.value}</span>
              <span className="text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Student List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              {['all', 'ungraded', 'graded'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-2.5 py-1 rounded text-[10px] font-medium uppercase transition-colors',
                    statusFilter === f ? 'bg-brand-teal text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No submissions</div>
            ) : (
              filtered.map((s: any) => {
                const isSelected = s.student_id === selectedStudent;
                const hasGrade = grades[s.student_id]?.score !== undefined && grades[s.student_id]?.score !== null;
                return (
                  <button
                    key={s.student_id}
                    onClick={() => setSelectedStudent(s.student_id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3',
                      isSelected ? 'bg-teal-50/50 border-l-2 border-brand-teal' : 'border-l-2 border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      hasGrade ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    )}>
                      {(s.student_name || s.student_id || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.student_name || `Student #${s.student_id}`}</p>
                      <p className="text-xs text-slate-400">{s.student_id}</p>
                    </div>
                    {hasGrade ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : s.status === 'SUBMITTED' || s.status === 'LATE' ? (
                      <div className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right - Grading */}
        <div className="lg:col-span-2">
          {selectedSubmission ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Submission header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{selectedSubmission.student_name || `Student #${selectedSubmission.student_id}`}</h3>
                  <p className="text-xs text-slate-400">ID: {selectedSubmission.student_id}</p>
                </div>
                {selectedSubmission.attachment_url && (
                  <a
                    href={selectedSubmission.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-teal bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
              </div>

              {/* Attachment preview */}
              {selectedSubmission.attachment_url && (
                <div className="p-5 border-b border-slate-100">
                  {selectedSubmission.attachment_url.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video controls className="w-full rounded-lg max-h-64">
                      <source src={selectedSubmission.attachment_url} />
                    </video>
                  ) : (
                    <a
                      href={selectedSubmission.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-brand-teal" />
                      <span className="text-sm text-slate-700 flex-1 truncate">View Submission</span>
                      <Download className="w-4 h-4 text-slate-400" />
                    </a>
                  )}
                </div>
              )}

              {/* Status badge */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <span className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded',
                  selectedSubmission.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-600' :
                  selectedSubmission.status === 'LATE' ? 'bg-orange-50 text-brand-orange' :
                  selectedSubmission.status === 'GRADED' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-slate-100 text-slate-500'
                )}>
                  {selectedSubmission.status || 'PENDING'}
                </span>
                {selectedSubmission.submitted_at && (
                  <span className="text-xs text-slate-400 ml-3">
                    Submitted {new Date(selectedSubmission.submitted_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Grade input */}
              <div className="p-5 space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-32">
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Score (out of {maxMarks})</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                      value={grades[selectedSubmission.student_id]?.score ?? ''}
                      onChange={e => setGrades(prev => ({
                        ...prev,
                        [selectedSubmission.student_id]: {
                          score: parseInt(e.target.value) || 0,
                          feedback: prev[selectedSubmission.student_id]?.feedback || '',
                        }
                      }))}
                      max={maxMarks}
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Feedback</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none resize-none"
                    placeholder="Provide feedback to the student..."
                    value={grades[selectedSubmission.student_id]?.feedback || ''}
                    onChange={e => setGrades(prev => ({
                      ...prev,
                      [selectedSubmission.student_id]: {
                        score: prev[selectedSubmission.student_id]?.score || 0,
                        feedback: e.target.value,
                      }
                    }))}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleGrade(selectedSubmission.student_id)}
                    disabled={savingId === selectedSubmission.student_id}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {savingId === selectedSubmission.student_id ? 'Saving...' : 'Save Grade'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Select a student to grade their submission.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
