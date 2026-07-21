'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle,
  Filter, Save, RefreshCw, Search, ChevronRight
} from 'lucide-react';
import { courseAPI, attendanceAPI, userAPI } from '@/lib/api';
import api from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Student { student_id: string; student_name: string; }

interface AttendanceRecord {
  student_id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

const STATUS_STYLES: Record<string, { active: string; label: string }> = {
  PRESENT: { active: 'bg-emerald-500 text-white border-emerald-500', label: 'P' },
  ABSENT: { active: 'bg-red-500 text-white border-red-500', label: 'A' },
  LATE: { active: 'bg-orange-500 text-white border-orange-500', label: 'L' },
  EXCUSED: { active: 'bg-slate-700 text-white border-slate-700', label: 'E' },
};

export default function TeacherAttendancePage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const user = getStoredUser();
  const router = useRouter();

  useEffect(() => { fetchMyCourses(); }, []);

  useEffect(() => {
    if (selectedCourse) { fetchSessions(); setSelectedSession(''); setStudents([]); }
    else { setSessions([]); setSelectedSession(''); setStudents([]); }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedSession) {
      fetchStudents().then(() => { if (selectedDate) fetchAttendance(); });
    } else {
      setStudents([]);
      setRecords({});
    }
  }, [selectedSession, selectedDate]);

  const fetchMyCourses = async () => {
    try {
      setLoading(true);
      const data: any = await courseAPI.getMyCourses();
      setCourses(Array.isArray(data) ? data : (data.results || []));
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  };

  const fetchSessions = async () => {
    if (!selectedCourse || !user?.id) return;
    try {
      setLoading(true);
      const data = await courseAPI.getScheduledClasses(selectedCourse, user.id);
      setSessions(Array.isArray(data) ? data : (data.results || []));
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  const fetchStudents = async () => {
    if (!selectedSession) return;
    try {
      setLoading(true);
      const data: any = await attendanceAPI.getScheduledClassStudents(selectedSession);
      const enrollmentList = Array.isArray(data) ? data : (data.results || []);
      const studentIds = enrollmentList.map((e: any) => e.student_id);
      let studentDetails: Record<string, any> = {};

      if (studentIds.length > 0) {
        try {
          const users = await userAPI.getByIds(studentIds);
          users.forEach((u: any) => { studentDetails[String(u.id).toLowerCase()] = u; });
        } catch {}
      }

      const list = enrollmentList.map((e: any) => {
        const details = studentDetails[String(e.student_id).toLowerCase()];
        return { student_id: e.student_id, student_name: details?.full_name || `Student #${e.student_id}` };
      });

      setStudents(list);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  const fetchAttendance = async () => {
    if (!selectedSession || !selectedDate) return;
    try {
      const res = await api.get(`/api/courses/attendance/?scheduled_class_id=${selectedSession}&date=${selectedDate}`);
      const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
      const existing: Record<string, AttendanceRecord> = {};
      list.forEach((r: any) => {
        existing[r.student_id] = { student_id: r.student_id, status: r.status, remarks: r.remarks };
      });
      setRecords(existing);
    } catch {}
  };

  const handleSave = async () => {
    if (!selectedCourse || !selectedDate) return toast.error('Select course and date');
    if (students.length === 0) return toast.error('No students');
    setSubmitting(true);
    try {
      await attendanceAPI.markBulk({
        course_id: selectedCourse,
        scheduled_class_id: selectedSession,
        date: selectedDate,
        records: Object.values(records).map(r => ({ student_id: r.student_id, status: r.status, remarks: r.remarks || '' })),
        graded_by_id: user?.id,
      });
      toast.success('Attendance saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally { setSubmitting(false); }
  };

  const isTodayScheduled = (() => {
    if (!selectedSession) return false;
    const session = sessions.find(s => s.id === selectedSession);
    if (!session?.days?.length) return false;
    const todayAbbr = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    return session.days.includes(todayAbbr);
  })();

  const presentCount = Object.values(records).filter(r => r.status === 'PRESENT').length;
  const absentCount = Object.values(records).filter(r => r.status === 'ABSENT').length;
  const lateCount = Object.values(records).filter(r => r.status === 'LATE').length;

  if (loading && courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-3 border-slate-100 border-t-brand-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Calendar className="w-7 h-7 text-brand-teal" />
          Attendance
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Mark attendance for your classes.</p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-brand-teal" />
                  Attendance Filters
                </h3>
                <p className="text-sm text-slate-500 mt-1">Select the course, section, and date before the attendance list below.</p>
              </div>
              <div className="text-xs text-slate-400">Filters above, list below.</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Course</label>
                <select
                  value={selectedCourse}
                  onChange={e => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                >
                  <option value="">Select course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Section</label>
                <select
                  value={selectedSession}
                  onChange={e => setSelectedSession(e.target.value)}
                  disabled={!selectedCourse}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none disabled:bg-slate-50"
                >
                  <option value="">Select section</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.section ? `Section ${s.section}` : s.course?.name || 'Session'}{s.days?.length ? ` — ${s.days.join(', ')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Summary</h3>
            {students.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {[
                  { label: 'Present', count: presentCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Absent', count: absentCount, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Late', count: lateCount, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Total', count: students.length, color: 'text-slate-900', bg: 'bg-slate-50' },
                ].map(s => (
                  <div key={s.label} className={cn('flex items-center justify-between px-3 py-3 rounded-2xl text-sm', s.bg)}>
                    <span className={cn('font-medium', s.color)}>{s.label}</span>
                    <span className="font-bold text-slate-900">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Choose a course and section to load student attendance data.</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div>
          {selectedCourse && selectedSession && selectedDate && !isTodayScheduled ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Calendar className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No session today</h3>
              <p className="text-slate-400 text-sm max-w-sm">This class isn't scheduled on {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}.</p>
            </div>
          ) : selectedCourse && selectedSession && selectedDate ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Users className="w-4 h-4 text-brand-teal" />
                  {students.length} Student{students.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const all: any = {};
                      students.forEach(s => { all[s.student_id] = { student_id: s.student_id, status: 'PRESENT' }; });
                      setRecords(all);
                      toast.success('All marked present');
                    }}
                    className="text-xs font-medium text-brand-teal hover:text-teal-700 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-teal text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Student list */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-6 h-6 text-slate-200 animate-spin" />
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">No students found.</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {students.map(student => {
                    const record = records[student.student_id] || { student_id: student.student_id, status: 'PRESENT' };
                    return (
                      <div key={student.student_id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Student info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                              record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                              record.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                              record.status === 'LATE' ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-200 text-slate-600'
                            )}>
                              {(student.student_name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{student.student_name}</p>
                              <p className="text-xs text-slate-400 truncate">ID: {student.student_id}</p>
                            </div>
                          </div>

                          {/* Status buttons */}
                          <div className="flex gap-1.5">
                            {STATUS_OPTIONS.map(opt => {
                              const active = record.status === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => setRecords(prev => ({
                                    ...prev,
                                    [student.student_id]: { ...prev[student.student_id], student_id: student.student_id, status: opt }
                                  }))}
                                  className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all border',
                                    active
                                      ? STATUS_STYLES[opt].active
                                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                  )}
                                >
                                  {opt === 'EXCUSED' ? 'Excused' : opt.toLowerCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="mt-3">
                          <input
                            type="text"
                            placeholder="Notes (optional)..."
                            value={record.remarks || ''}
                            onChange={e => setRecords(prev => ({
                              ...prev,
                              [student.student_id]: { ...prev[student.student_id], student_id: student.student_id, status: prev[student.student_id]?.status || 'PRESENT', remarks: e.target.value }
                            }))}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none transition-all placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Calendar className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Select Details</h3>
              <p className="text-slate-400 text-sm max-w-sm">Choose a course, date, and section to view and mark attendance.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
