'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Calendar, BookOpen, MapPin, Clock,
  AlertTriangle, CheckCircle, XCircle, MessageSquare, ChevronDown,
  Search, Activity, ShieldAlert, Loader2, Ban, Eye, EyeOff
} from 'lucide-react';
import { courseAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Student {
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  roll_number?: string;
  gender?: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_percentage: number;
  warning_count: number;
  last_warning_date?: string;
}

interface Warning {
  id: string;
  student_id: string;
  student_name: string;
  warning_type: string;
  description?: string;
  issued_by_name?: string;
  issued_at: string;
  resolved: boolean;
  resolved_at?: string;
  resolution_notes?: string;
}

export default function SectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.id as string;

  const [section, setSection] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showWarnings, setShowWarnings] = useState(false);
  const [showAtRisk, setShowAtRisk] = useState(false);

  // Warning form
  const [warningForm, setWarningForm] = useState({ student_id: '', warning_type: 'absent', description: '' });
  const [issuingWarning, setIssuingWarning] = useState(false);

  useEffect(() => {
    if (sectionId) fetchData();
  }, [sectionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sectionData, studentsData, warningsData] = await Promise.all([
        courseAPI.getScheduledClassById(sectionId),
        courseAPI.getCoordinatorSectionStudents(sectionId),
        courseAPI.getCoordinatorWarnings({ section_id: sectionId }),
      ]);
      setSection(sectionData);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setWarnings(Array.isArray(warningsData) ? warningsData : []);
    } catch (err) {
      console.error('Failed to fetch section data:', err);
      toast.error('Failed to load section data');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number && s.roll_number.toLowerCase().includes(search.toLowerCase()))
  );

  const atRiskStudents = students.filter(s => s.attendance_percentage < 75);

  const issueWarning = async (studentId: string) => {
    if (!warningForm.warning_type) {
      toast.error('Please select a warning type');
      return;
    }
    setIssuingWarning(true);
    try {
      await courseAPI.createCoordinatorWarning({
        student_id: studentId,
        scheduled_class_id: sectionId,
        warning_type: warningForm.warning_type,
        description: warningForm.description,
      });
      toast.success('Warning issued successfully');
      setWarningForm({ student_id: '', warning_type: 'absent', description: '' });
      const warningsData = await courseAPI.getCoordinatorWarnings({ section_id: sectionId });
      setWarnings(Array.isArray(warningsData) ? warningsData : []);
    } catch (err) {
      toast.error('Failed to issue warning');
    } finally {
      setIssuingWarning(false);
    }
  };

  const resolveWarning = async (warningId: string) => {
    try {
      await courseAPI.resolveCoordinatorWarning(warningId, { resolution_notes: 'Resolved by coordinator' });
      toast.success('Warning resolved');
      const warningsData = await courseAPI.getCoordinatorWarnings({ section_id: sectionId });
      setWarnings(Array.isArray(warningsData) ? warningsData : []);
    } catch (err) {
      toast.error('Failed to resolve warning');
    }
  };

  const getAttColor = (pct: number) => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getAttBg = (pct: number) => {
    if (pct >= 80) return 'bg-green-100 text-green-700 border-green-200';
    if (pct >= 60) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-brand-teal" />
            {section?.course?.name || section?.course_name || 'Section'} {section?.section ? `â€” Section ${section.section}` : ''}
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">
            {section?.course?.course_code || section?.course_code} &middot; {section?.branch_name || 'No branch'} &middot; {section?.teacher_name || 'No teacher'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-100 rounded-xl"><Users className="w-4 h-4 text-blue-600" /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Students</span>
          </div>
          <p className="text-3xl font-black text-slate-800">{students.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-100 rounded-xl"><Activity className="w-4 h-4 text-green-600" /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance</span>
          </div>
          <p className="text-3xl font-black text-slate-800">
            {students.length > 0
              ? Math.round(students.reduce((sum, s) => sum + s.attendance_percentage, 0) / students.length)
              : 0}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-red-100 rounded-xl"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">At Risk</span>
          </div>
          <p className="text-3xl font-black text-red-500">{atRiskStudents.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-orange-100 rounded-xl"><ShieldAlert className="w-4 h-4 text-orange-600" /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warnings</span>
          </div>
          <p className="text-3xl font-black text-slate-800">{warnings.filter(w => !w.resolved).length}</p>
        </div>
      </div>

      {/* At-Risk Students */}
      {atRiskStudents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
          <button
            onClick={() => setShowAtRisk(!showAtRisk)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-black text-red-700">{atRiskStudents.length} student{atRiskStudents.length > 1 ? 's' : ''} below 75% attendance threshold</span>
            </div>
            {showAtRisk ? <EyeOff className="w-4 h-4 text-red-400" /> : <Eye className="w-4 h-4 text-red-400" />}
          </button>
          {showAtRisk && (
            <div className="mt-4 space-y-2">
              {atRiskStudents.map(s => (
                <div key={s.student_id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{s.full_name}</p>
                    <p className="text-[10px] text-slate-500">{s.email} &middot; {s.absent_count} absent, {s.late_count} late</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-black border", getAttBg(s.attendance_percentage))}>
                      {s.attendance_percentage}%
                    </span>
                    <button
                      onClick={() => {
                        setWarningForm({ ...warningForm, student_id: s.student_id, warning_type: 'absent' });
                      }}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black transition-all"
                    >
                      Issue Warning
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student List */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            Students ({filteredStudents.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/10 focus:border-brand-teal transition-all w-56"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-center px-3 py-3">Roll No</th>
                <th className="text-center px-3 py-3">Gender</th>
                <th className="text-center px-3 py-3">Present</th>
                <th className="text-center px-3 py-3">Absent</th>
                <th className="text-center px-3 py-3">Late</th>
                <th className="text-center px-3 py-3">Excused</th>
                <th className="text-center px-3 py-3">%</th>
                <th className="text-center px-3 py-3">Warnings</th>
                <th className="text-center px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => (
                <tr key={s.student_id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{s.full_name}</p>
                      <p className="text-[10px] text-slate-400">{s.email}</p>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 text-xs font-bold text-slate-600">{s.roll_number || '-'}</td>
                  <td className="text-center px-3 py-3">
                    <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", s.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600')}>
                      {s.gender || '-'}
                    </span>
                  </td>
                  <td className="text-center px-3 py-3 text-xs font-bold text-green-600">{s.present_count}</td>
                  <td className="text-center px-3 py-3 text-xs font-bold text-red-500">{s.absent_count}</td>
                  <td className="text-center px-3 py-3 text-xs font-bold text-orange-500">{s.late_count}</td>
                  <td className="text-center px-3 py-3 text-xs font-bold text-slate-500">{s.excused_count}</td>
                  <td className="text-center px-3 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-[10px] font-black", getAttBg(s.attendance_percentage))}>
                      {s.attendance_percentage}%
                    </span>
                  </td>
                  <td className="text-center px-3 py-3">
                    {s.warning_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black">
                        <AlertTriangle className="w-3 h-3" />
                        {s.warning_count}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">None</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setWarningForm({ student_id: s.student_id, warning_type: 'absent', description: '' })}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[9px] font-black transition-all"
                        title="Issue Warning"
                      >
                        <AlertTriangle className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings Section */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <button
          onClick={() => setShowWarnings(!showWarnings)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Student Warnings ({warnings.length})</h2>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showWarnings && "rotate-180")} />
        </button>
        {showWarnings && (
          <div className="mt-4 space-y-3">
            {warnings.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No warnings issued</p>
            ) : (
              warnings.map(w => (
                <div key={w.id} className={cn("p-4 rounded-2xl border", w.resolved ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{w.student_name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {w.warning_type.replace('_', ' ').toUpperCase()} &middot; {new Date(w.issued_at).toLocaleDateString()}
                        {w.issued_by_name ? ` &middot; by ${w.issued_by_name}` : ''}
                      </p>
                      {w.description && <p className="text-xs text-slate-600 mt-2">{w.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {w.resolved ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-black">
                          <CheckCircle className="w-3 h-3" /> Resolved
                        </span>
                      ) : (
                        <>
                          <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-[9px] font-black">Active</span>
                          <button
                            onClick={() => resolveWarning(w.id)}
                            className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[9px] font-black transition-all"
                          >
                            Resolve
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Issue Warning Modal */}
      {warningForm.student_id && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => setWarningForm({ student_id: '', warning_type: 'absent', description: '' })}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 mb-4">Issue Warning</h3>
            <p className="text-sm text-slate-500 mb-4">
              Student: <span className="font-bold text-slate-800">{students.find(s => s.student_id === warningForm.student_id)?.full_name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warning Type</label>
                <select
                  value={warningForm.warning_type}
                  onChange={(e) => setWarningForm({ ...warningForm, warning_type: e.target.value })}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                >
                  <option value="absent">Frequent Absence</option>
                  <option value="late">Frequent Lateness</option>
                  <option value="behavior">Behavioral</option>
                  <option value="academic">Academic Performance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description (optional)</label>
                <textarea
                  value={warningForm.description}
                  onChange={(e) => setWarningForm({ ...warningForm, description: e.target.value })}
                  placeholder="Add details about the warning..."
                  rows={3}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setWarningForm({ student_id: '', warning_type: 'absent', description: '' })}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-black transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => issueWarning(warningForm.student_id)}
                  disabled={issuingWarning}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-sm font-black transition-all disabled:opacity-50"
                >
                  {issuingWarning ? 'Issuing...' : 'Issue Warning'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
