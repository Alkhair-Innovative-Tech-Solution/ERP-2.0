'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Calendar, Filter, RefreshCw, Phone, Mail, MessageSquare,
  CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck, ChevronDown,
  PhoneCall, Smartphone, Users, Download, Loader2, X, Check,
  ArrowUpRight
} from 'lucide-react';
import { coordinatorAttendanceAPI, courseAPI, attendanceAPI } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  student_whatsapp: string;
  father_name: string;
  father_phone: string;
  course_id: string;
  course_name: string;
  scheduled_class_id: string | null;
  section: string;
  date: string;
  status: string;
  remarks: string | null;
  is_contacted: boolean;
  last_contact: string | null;
  last_contact_method: string | null;
}

interface Stats {
  total_present: number;
  total_absent: number;
  total_late: number;
  total_excused: number;
  total_records: number;
  today_present: number;
  today_absent: number;
  today_late: number;
  today_excused: number;
}

export default function CoordinatorAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [mode, setMode] = useState<'review' | 'mark'>('review');

  // Filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showFilters, setShowFilters] = useState(false);

  // Contact modal
  const [contactModal, setContactModal] = useState<AttendanceRecord | null>(null);
  const [contactMethod, setContactMethod] = useState('whatsapp');
  const [contactRemarks, setContactRemarks] = useState('');
  const [isContacting, setIsContacting] = useState(false);

  // Mark Attendance state
  const [markCourse, setMarkCourse] = useState('');
  const [markSection, setMarkSection] = useState('');
  const [markSections, setMarkSections] = useState<any[]>([]);
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [markStudents, setMarkStudents] = useState<any[]>([]);
  const [markAttendance, setMarkAttendance] = useState<Record<string, string>>({});
  const [markLoading, setMarkLoading] = useState(false);
  const [markSaving, setMarkSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (mode === 'review') {
      fetchData();
    }
  }, [filterCourse, filterStatus, filterDate, mode]);

  // Fetch sections when course changes in mark mode
  useEffect(() => {
    if (markCourse) {
      courseAPI.getScheduledClasses(markCourse).then(data => {
        const list = Array.isArray(data) ? data : [];
        setMarkSections(list);
        setMarkSection(list.length > 0 ? list[0].id : '');
      }).catch(() => setMarkSections([]));
    } else {
      setMarkSections([]);
      setMarkSection('');
      setMarkStudents([]);
      setMarkAttendance({});
    }
  }, [markCourse]);

  // Fetch students when section changes in mark mode
  useEffect(() => {
    if (markSection && markDate) {
      setMarkLoading(true);
      Promise.all([
        attendanceAPI.getScheduledClassStudents(markSection),
        attendanceAPI.getAttendance(markSection, markDate),
      ]).then(([students, existingRecords]) => {
        const studentList = Array.isArray(students) ? students : [];
        setMarkStudents(studentList);
        const existing: Record<string, string> = {};
        const records = Array.isArray(existingRecords) ? existingRecords : [];
        records.forEach((r: any) => {
          existing[r.student_id] = r.status;
        });
        setMarkAttendance(existing);
      }).catch(() => {
        setMarkStudents([]);
        setMarkAttendance({});
      }).finally(() => setMarkLoading(false));
    } else {
      setMarkStudents([]);
      setMarkAttendance({});
    }
  }, [markSection, markDate]);

  const fetchCourses = async () => {
    try {
      const data = await courseAPI.getAll();
      setCourses(Array.isArray(data) ? data : (data.results || data.data || []));
    } catch {}
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const [recordsData, statsData] = await Promise.all([
        coordinatorAttendanceAPI.getAll({
          course_id: filterCourse || undefined,
          status: filterStatus || undefined,
          date: filterDate || undefined,
          search: debouncedSearchQuery || undefined,
          organization_id: orgId,
        }),
        coordinatorAttendanceAPI.getStats(orgId),
      ]);
      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!markCourse || !markSection) return toast.error('Select a course and section');
    setMarkSaving(true);
    try {
      const records = Object.entries(markAttendance).map(([student_id, status]) => ({
        student_id,
        status,
        remarks: '',
      }));
      await attendanceAPI.markBulk({
        course_id: markCourse,
        scheduled_class_id: markSection,
        date: markDate,
        records,
      });
      toast.success('Attendance marked successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setMarkSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!debouncedSearchQuery) return records;
    const q = debouncedSearchQuery.toLowerCase();
    return records.filter(r =>
      r.student_name?.toLowerCase().includes(q) ||
      r.student_email?.toLowerCase().includes(q) ||
      r.student_phone?.includes(q)
    );
  }, [records, debouncedSearchQuery]);

  const { sortedData, sortConfig, requestSort } = useSortableData(filteredRecords);

  const handleContact = async () => {
    if (!contactModal) return;
    try {
      setIsContacting(true);
      await coordinatorAttendanceAPI.contact({
        attendance_id: contactModal.id,
        method: contactMethod,
        remarks: contactRemarks,
      });
      toast.success('Contact logged successfully');
      setContactModal(null);
      setContactRemarks('');
      fetchData();
    } catch (error) {
      toast.error('Failed to log contact');
    } finally {
      setIsContacting(false);
    }
  };

  const exportCSV = useCallback(() => {
    const headers = ['Student Name', 'Email', 'Phone', 'WhatsApp', 'Course', 'Section', 'Date', 'Status', 'Contacted', 'Father Name', 'Father Phone'];
    const rows = filteredRecords.map(r => [
      r.student_name, r.student_email, r.student_phone, r.student_whatsapp,
      r.course_name, r.section, r.date, r.status, r.is_contacted ? 'Yes' : 'No',
      r.father_name, r.father_phone
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance-${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [filteredRecords, filterDate]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ABSENT: 'bg-rose-50 text-rose-700 border-rose-200',
      LATE: 'bg-amber-50 text-amber-700 border-amber-200',
      EXCUSED: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getContactInfo = (record: AttendanceRecord) => {
    const contacts: { label: string; value: string; icon: any; method: string }[] = [];
    if (record.student_phone) contacts.push({ label: 'Phone', value: record.student_phone, icon: Phone, method: 'call' });
    if (record.student_whatsapp) contacts.push({ label: 'WhatsApp', value: record.student_whatsapp, icon: MessageSquare, method: 'whatsapp' });
    if (record.student_email) contacts.push({ label: 'Email', value: record.student_email, icon: Mail, method: 'email' });
    if (record.father_phone) contacts.push({ label: 'Father Phone', value: record.father_phone, icon: PhoneCall, method: 'call' });
    return contacts;
  };

  return (
    <div className="w-full space-y-6 pb-8 premium-dashboard-scope animate-in fade-in duration-700">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <UserCheck className="w-7 h-7 text-brand-teal" />
            {mode === 'review' ? 'Student Attendance Review' : 'Mark Attendance'}
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Track and manage student attendance records.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-xl p-0.5 mr-2">
            <button onClick={() => setMode('review')} className={cn('px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all', mode === 'review' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Review</button>
            <button onClick={() => setMode('mark')} className={cn('px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all', mode === 'mark' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>Mark</button>
          </div>
          {mode === 'review' && (
            <>
              <Button onClick={() => setShowFilters(!showFilters)} variant="outline" className="rounded-lg h-10 px-4 font-bold text-[10px] border-slate-200">
                <Filter size={14} className="mr-1.5" /> Filters
              </Button>
              <Button onClick={exportCSV} variant="outline" className="rounded-lg h-10 px-4 font-bold text-[10px] border-slate-200">
                <Download size={14} className="mr-1.5" /> Export
              </Button>
              <Button onClick={fetchData} variant="ghost" className="rounded-lg h-10 px-4 font-black text-slate-600 hover:text-brand-teal text-[10px]">
                <RefreshCw size={14} className="mr-1.5" /> Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      {/* â”€â”€ Mark Attendance Mode â”€â”€ */}
      {mode === 'mark' && (
        <div className="animate-in fade-in duration-300">
          <div className="premium-card p-6 border-none shadow-premium bg-white space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Course</label>
                <select value={markCourse} onChange={e => setMarkCourse(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10">
                  <option value="">Select Course</option>
                  {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Section</label>
                <select value={markSection} onChange={e => setMarkSection(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10">
                  <option value="">Select Section</option>
                  {markSections.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.section ? `Section ${s.section}` : s.id?.slice(0, 8)} {s.days ? `(${s.days.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Date</label>
                <input type="date" value={markDate} onChange={e => setMarkDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10" />
              </div>
            </div>

            {markLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-brand-teal" />
                <span className="ml-3 text-xs font-bold text-slate-500">Loading students...</span>
              </div>
            ) : markStudents.length > 0 ? (
              <>
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-slate-700">{markStudents.length} Student{markStudents.length !== 1 ? 's' : ''}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { const all: Record<string, string> = {}; markStudents.forEach((s: any) => { all[s.student_id || s.id] = 'PRESENT'; }); setMarkAttendance(all); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">All Present</button>
                      <button onClick={() => { const all: Record<string, string> = {}; markStudents.forEach((s: any) => { all[s.student_id || s.id] = 'ABSENT'; }); setMarkAttendance(all); }}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors">All Absent</button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {markStudents.map((s: any) => {
                      const sid = s.student_id || s.id;
                      const status = markAttendance[sid] || '';
                      return (
                        <div key={sid} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                          <span className="text-xs font-bold text-slate-700">{s.student_name || 'Unknown'}</span>
                          <div className="flex gap-1.5">
                            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(st => (
                              <button key={st} onClick={() => setMarkAttendance(prev => ({ ...prev, [sid]: prev[sid] === st ? '' : st }))}
                                className={cn('px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all',
                                  status === st
                                    ? st === 'PRESENT' ? 'bg-emerald-500 text-white border-emerald-500'
                                      : st === 'ABSENT' ? 'bg-rose-500 text-white border-rose-500'
                                      : st === 'LATE' ? 'bg-amber-500 text-white border-amber-500'
                                      : 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                )}>
                                {st === 'PRESENT' ? 'P' : st === 'ABSENT' ? 'A' : st === 'LATE' ? 'L' : 'E'}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <Button onClick={handleMarkAttendance} disabled={markSaving}
                    className="h-11 px-8 rounded-xl bg-brand-teal hover:bg-brand-dark text-white font-black shadow-lg text-xs uppercase tracking-widest">
                    {markSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Check size={16} className="mr-2" />}
                    {markSaving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>
              </>
            ) : markCourse && markSection ? (
              <div className="text-center py-12 text-slate-400">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">No students found for this section</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* â”€â”€ Review Mode: Stats Cards â”€â”€ */}
      {mode === 'review' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Present', value: stats.today_present, total: stats.total_records, color: 'emerald', icon: CheckCircle2 },
            { label: 'Absent', value: stats.today_absent, total: stats.total_records, color: 'rose', icon: XCircle },
            { label: 'Late', value: stats.today_late, total: stats.total_records, color: 'amber', icon: Clock },
            { label: 'Excused', value: stats.today_excused, total: stats.total_records, color: 'blue', icon: AlertTriangle },
          ].map((s, i) => (
            <div key={i} className="premium-card p-5 border-none shadow-premium bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  s.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                  s.color === 'rose' ? "bg-rose-50 text-rose-600" :
                  s.color === 'amber' ? "bg-amber-50 text-amber-600" :
                  "bg-blue-50 text-blue-600"
                )}>
                  <s.icon size={16} strokeWidth={2.5} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{s.value}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* â”€â”€ Review Mode â”€â”€ */}
      {mode === 'review' && (<>
      {/* â”€â”€ Filters â”€â”€ */}
      {showFilters && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="premium-card p-5 border-none shadow-premium bg-white flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Date</label>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Course</label>
              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10 min-w-[160px]">
                <option value="">All Courses</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10">
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
                <option value="EXCUSED">Excused</option>
              </select>
            </div>
            <Button onClick={() => { setFilterCourse(''); setFilterStatus(''); setFilterDate(new Date().toISOString().split('T')[0]); }}
              variant="ghost" className="text-[10px] font-bold text-slate-500">
              Reset
            </Button>
          </div>
        </div>
      )}

      {/* â”€â”€ Search â”€â”€ */}
      <div>
        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <input type="text" placeholder="Search student..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/5" />
        </div>
      </div>

      {/* â”€â”€ Attendance Table â”€â”€ */}
      <div>
        <div className="premium-card overflow-x-auto border-none shadow-premium bg-white">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80">
                <SortableTableHeader label="Student" sortKey="student_name" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Course" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Section" sortKey="section" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                <th className="px-3 py-3.5 text-[9px] font-black text-slate-600 uppercase tracking-widest">Contact Info</th>
                <SortableTableHeader label="Contacted" sortKey="is_contacted" currentSort={sortConfig} onSort={requestSort} />
                <th className="px-3 py-3.5 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-brand-teal" />
                    <p className="text-xs font-bold text-slate-400 mt-3">Loading attendance records...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users size={40} className="text-slate-200" />
                      <p className="text-lg font-black text-slate-900 tracking-tight">No Records Found</p>
                      <p className="text-sm text-slate-500">No attendance records match your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-black text-slate-900">{record.student_name || 'Unknown Student'}</p>
                      <p className="text-[9px] font-bold text-slate-500">{record.student_email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold text-slate-700">{record.course_name}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold text-slate-600">{record.section || 'â€”'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold text-slate-700">{record.date}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border", getStatusBadge(record.status))}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        {record.student_phone && <span className="text-[9px] font-medium text-slate-600">ðŸ“ž {record.student_phone}</span>}
                        {record.student_whatsapp && <span className="text-[9px] font-medium text-emerald-600">ðŸ’¬ {record.student_whatsapp}</span>}
                        {!record.student_phone && !record.student_whatsapp && <span className="text-[9px] text-slate-300 italic">No contact</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {record.is_contacted ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          <span className="text-[9px] font-bold text-emerald-600">
                            {record.last_contact_method || 'Contacted'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300">Not contacted</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {record.status !== 'PRESENT' && (
                          <Button onClick={() => { setContactModal(record); setContactMethod('whatsapp'); setContactRemarks(''); }}
                            className="h-7 px-3 rounded-lg bg-brand-teal hover:bg-brand-dark text-white text-[8px] font-black uppercase tracking-widest">
                            Contact
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      {/* â”€â”€ Contact Modal â”€â”€ */}
      {contactModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setContactModal(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="h-2 bg-gradient-to-r from-brand-teal to-brand-dark" />
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">CONTACT STUDENT</p>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{contactModal.student_name || 'Unknown Student'}</h2>
                  <p className="text-slate-500 text-sm mt-1">{contactModal.course_name} Â· {contactModal.date} Â· <span className={cn("font-bold", contactModal.status === 'ABSENT' ? 'text-rose-600' : 'text-amber-600')}>{contactModal.status}</span></p>
                </div>
                <button onClick={() => setContactModal(null)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {getContactInfo(contactModal).map((c, i) => (
                  <button key={i} onClick={() => setContactMethod(c.method)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                      contactMethod === c.method
                        ? "border-brand-teal bg-brand-teal/10"
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    )}>
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
                      contactMethod === c.method ? "bg-brand-teal text-white" : "bg-slate-200 text-slate-600")}>
                      <c.icon size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{c.label}</p>
                      <p className="text-xs font-bold text-slate-900">{c.value}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Remarks */}
              <div className="space-y-2 mb-6">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Remarks</label>
                <textarea value={contactRemarks} onChange={e => setContactRemarks(e.target.value)}
                  placeholder="e.g., Called regarding absence, student will attend tomorrow..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-teal/10 resize-none"
                  rows={3} />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => setContactModal(null)} variant="outline"
                  className="flex-1 h-12 rounded-2xl font-bold text-slate-600 border-slate-200 text-xs uppercase tracking-widest">
                  Cancel
                </Button>
                <Button onClick={handleContact} disabled={isContacting}
                  className="flex-[2] h-12 rounded-2xl bg-brand-teal hover:bg-brand-dark text-white font-black shadow-lg text-xs uppercase tracking-widest">
                  {isContacting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Check size={16} className="mr-2" />}
                  Log Contact
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
