'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Search, Filter, Edit, Trash2,
  Clock, CheckCircle2, X, Loader2, ChevronDown,
  Layers, Users, Activity, BarChart, GraduationCap,
  Calendar, MoreHorizontal
} from 'lucide-react';
import { courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';
import Link from 'next/link';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

type LifecycleStatus = 'upcoming' | 'operational' | 'completed' | 'archived';

function getCourseLifecycleStatus(course: any): LifecycleStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!course.active) return 'archived';

  const admStatus = (course.admission_status || '').toLowerCase();

  if (admStatus === 'coming_soon') return 'upcoming';
  if (admStatus === 'open') return 'operational';

  if (admStatus === 'closed') {
    if (course.course_end_date) {
      const endDate = new Date(course.course_end_date);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) return 'completed';
    }
    return 'operational';
  }

  return 'upcoming';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LIFECYCLE_CONFIG: Record<LifecycleStatus, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  upcoming:    { label: 'Upcoming',    dotClass: 'bg-amber-400',                  textClass: 'text-amber-700',   bgClass: 'bg-amber-50 border-amber-200' },
  operational: { label: 'Operational', dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-200' },
  completed:   { label: 'Completed',   dotClass: 'bg-slate-400',                 textClass: 'text-slate-600',   bgClass: 'bg-slate-50 border-slate-200' },
  archived:    { label: 'Archived',    dotClass: 'bg-rose-400',                  textClass: 'text-rose-600',    bgClass: 'bg-rose-50 border-rose-200' },
};

export default function CourseManagementPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    imageFile: null as File | null,
    specialization_id: '',
    level: 1,
    duration: 4,
    active: true,
    iq_required: false,
    admission_open_date: '',
    course_start_date: '',
    course_end_date: '',
  });

  useEffect(() => {
    fetchData();
  }, [showArchived]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const courseRes: any = await courseAPI.getAll({ archived: showArchived, organization_id: orgId }).catch(() => []);
      const specRes: any = await courseAPI.getSpecializations(orgId).catch(() => []);

      setCourses(Array.isArray(courseRes) ? courseRes : (courseRes?.results || []));

      let specList = [];
      if (Array.isArray(specRes)) specList = specRes;
      else if (specRes?.results) specList = specRes.results;
      else if (specRes?.data) specList = specRes.data;
      setSpecializations(specList);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      imageFile: null,
      specialization_id: '',
      level: 1,
      duration: 4,
      active: true,
      iq_required: false,
      admission_open_date: '',
      course_start_date: '',
      course_end_date: '',
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (course: any) => {
    setFormData({
      name: course.name || '',
      description: course.description || '',
      image: course.image || '',
      imageFile: null,
      specialization_id: course.specialization_id || course.specialization || '',
      level: course.level || 1,
      duration: course.duration || 4,
      active: course.active ?? true,
      iq_required: course.iq_required ?? false,
      admission_open_date: course.admission_open_date || '',
      course_start_date: course.course_start_date || '',
      course_end_date: course.course_end_date || '',
    });
    setEditingId(course.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload: any = { ...formData };

      if (formData.imageFile) {
        payload.image = formData.imageFile;
      }

      if (payload.specialization_id) {
        payload.specialization = payload.specialization_id;
      }

      // Add new fields
      payload.iq_required = formData.iq_required;
      if (formData.admission_open_date) payload.admission_open_date = formData.admission_open_date;
      if (formData.course_start_date) payload.course_start_date = formData.course_start_date;
      if (formData.course_end_date) payload.course_end_date = formData.course_end_date;

      if (isEditMode && editingId) {
        await courseAPI.update(editingId, payload);
        toast.success('Course updated successfully');
      } else {
        await courseAPI.create(payload);
        toast.success('Course created successfully');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this course (soft-delete)?')) return;
    try {
      await courseAPI.delete(id);
      toast.success('Course archived');
      setCourses(courses.filter(c => c.id !== id));
    } catch (error) {
      toast.error('Failed to archive course');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await courseAPI.restore(id);
      toast.success('Course restored');
      setCourses(courses.filter(c => c.id !== id));
    } catch (error) {
      toast.error('Failed to restore course');
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase());
    const lifecycle = getCourseLifecycleStatus(course);
    const matchesStatus = statusFilter === 'ALL' || lifecycle === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const { sortedData, sortConfig, requestSort } = useSortableData(filteredCourses);

  const activeCoursesCount = courses.filter(c => getCourseLifecycleStatus(c) === 'operational').length;
  const upcomingCoursesCount = courses.filter(c => getCourseLifecycleStatus(c) === 'upcoming').length;
  const completedCoursesCount = courses.filter(c => getCourseLifecycleStatus(c) === 'completed').length;
  const avgDuration = courses.length > 0
    ? Math.round(courses.reduce((acc, curr) => acc + (curr.duration || 0), 0) / courses.length)
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Curricula...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Academic Architecture</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-brand-teal" />
            Course Management
          </h1>
          <p className="text-slate-500 font-medium mt-1">Design curricula, establish specializations, and manage degree hierarchies.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowArchived(!showArchived)}
            variant="outline"
            className={cn(
              "rounded-2xl border-slate-200 h-11 px-5 font-bold transition-all flex gap-2",
              showArchived ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {showArchived ? <Archive className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            {showArchived ? "Viewing Archived" : "View Archived"}
          </Button>
          <Button
            onClick={fetchData}
            variant="outline"
            className="rounded-2xl border-slate-200 h-11 px-5 font-bold text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 px-6 font-bold shadow-lg shadow-brand-teal/20 flex gap-2"
          >
            <Plus className="w-5 h-5" /> Architect New Course
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Catalog', val: courses.length, icon: BookOpen, color: 'blue' },
          { label: 'Operational', val: activeCoursesCount, icon: Activity, color: 'teal' },
          { label: 'Upcoming', val: upcomingCoursesCount, icon: Clock, color: 'orange' },
          { label: 'Completed', val: completedCoursesCount, icon: CheckCircle2, color: 'purple' },
        ].map((s, idx) => (
          <div key={idx} className="premium-card p-6 flex items-center gap-5 group">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 duration-500 shadow-sm",
              s.color === 'blue' ? "bg-blue-50 text-blue-600" :
                s.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                  s.color === 'purple' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
            )}>
              <s.icon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Container ── */}
      <div className="premium-card overflow-hidden flex flex-col border-none shadow-premium">

        {/* Filters TopBar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
            <input
              placeholder="Search curricula by name or course code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all placeholder:text-slate-300"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative min-w-[160px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-2xl py-2.5 pl-4 pr-10 text-xs font-black text-slate-600 uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal"
              >
                <option value="ALL">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="operational">Operational</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <Button variant="outline" className="rounded-2xl h-10 border-slate-200 px-4 flex gap-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
              <Filter className="w-3.5 h-3.5" /> Sector Filter
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] border-b border-slate-100">
              <tr>
                <SortableTableHeader label="Curriculum" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="px-6 py-5 text-[10px]" />
                <SortableTableHeader label="Specialization" sortKey="specialization_id" currentSort={sortConfig} onSort={requestSort} className="px-6 py-5 text-[10px]" />
                <SortableTableHeader label="Duration" sortKey="duration" currentSort={sortConfig} onSort={requestSort} className="px-6 py-5 text-[10px] text-center" align="center" />
                <SortableTableHeader label="Level" sortKey="level" currentSort={sortConfig} onSort={requestSort} className="px-6 py-5 text-[10px] text-center" align="center" />
                <th className="px-5 py-5 text-[10px] uppercase font-black text-slate-400 tracking-[0.15em]">Adm. Open</th>
                <th className="px-5 py-5 text-[10px] uppercase font-black text-slate-400 tracking-[0.15em]">Start Date</th>
                <th className="px-5 py-5 text-[10px] uppercase font-black text-slate-400 tracking-[0.15em]">End Date</th>
                <SortableTableHeader label="Status" sortKey="active" currentSort={sortConfig} onSort={requestSort} className="px-6 py-5 text-[10px]" />
                <th className="px-6 py-5 text-right text-[10px] uppercase font-black text-slate-400 tracking-[0.15em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <BookOpen className="w-16 h-16 text-slate-200" />
                      <div>
                        <p className="text-xl font-black text-slate-800 tracking-tight">No curricula discovered</p>
                        <p className="text-sm font-medium text-slate-400">Try adjusting your filters or search keywords.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((course) => {
                  const spec = specializations.find(s => String(s.id) === String(course.specialization_id || course.specialization));
                  const lifecycle = getCourseLifecycleStatus(course);
                  const lcConfig = LIFECYCLE_CONFIG[lifecycle];

                  return (
                    <tr key={course.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xs shadow-lg shrink-0 transition-transform group-hover:rotate-12 duration-300",
                            course.active ? "bg-gradient-to-br from-brand-teal to-[#0a1b71]" : "bg-slate-300"
                          )}>
                            {course.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 tracking-tight truncate leading-none mb-1.5">{course.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">{course.course_code || 'AIT-MASTER-DEP'}</p>
                            {course.organization_id && (
                              <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                                Org: {course.organization_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 shadow-sm border border-slate-200">
                          <Layers size={12} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{spec?.name || 'GENERIC'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock size={14} className="text-slate-300" />
                          <span className="text-sm font-black text-slate-800">{course.duration}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">mo</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-700 shadow-sm">
                          {course.level}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-300 shrink-0" />
                          <span className={cn("text-xs font-semibold", course.admission_open_date ? "text-slate-700" : "text-slate-300")}>
                            {formatDate(course.admission_open_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-300 shrink-0" />
                          <span className={cn("text-xs font-semibold", course.course_start_date ? "text-slate-700" : "text-slate-300")}>
                            {formatDate(course.course_start_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-300 shrink-0" />
                          <span className={cn("text-xs font-semibold", course.course_end_date ? "text-slate-700" : "text-slate-300")}>
                            {formatDate(course.course_end_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm", lcConfig.bgClass)}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", lcConfig.dotClass)} />
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", lcConfig.textClass)}>
                            {lcConfig.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all">
                              <MoreHorizontal className="w-5 h-5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2 premium-dashboard-scope shadow-xl border-slate-100">
                            <DropdownMenuItem onClick={() => handleOpenEdit(course)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer focus:bg-brand-teal/10 focus:text-brand-teal font-bold text-sm">
                              <Edit size={16} /> Update Specs
                            </DropdownMenuItem>
                            {showArchived ? (
                              <DropdownMenuItem onClick={() => handleRestore(course.id)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 font-bold text-sm">
                                <RefreshCcw size={16} /> Restore Course
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleDelete(course.id)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700 font-bold text-sm">
                                <Trash2 size={16} /> Remove Course
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-5 bg-slate-50/30 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <p className="flex items-center gap-2">
            <Activity size={12} className="text-brand-teal" />
            Architecture Audit Content: {filteredCourses.length} Programs
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl hover:text-brand-teal transition-all font-bold">Previous Page</button>
            <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl hover:text-brand-teal transition-all font-bold">Next Page</button>
          </div>
        </div>
      </div>

      {/* ── Modal (High Fidelity Curriculum Form) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-6 animate-in zoom-in-95 duration-300 border border-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Academic Blueprint</p>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {isEditMode ? 'Modify Curriculum' : 'Architect New Program'}
                </h2>
                <p className="text-slate-500 font-medium text-xs mt-0.5">Define the learning roadmap and degree requirements.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Course Nomenclature</label>
                <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all" placeholder="e.g. Advanced Cybersecurity Engineering" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Program Abstract</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all min-h-[70px] resize-none"
                  placeholder="Define the scope and learning objectives..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Visual Identity (Course Image)</label>
                <div className="flex items-center gap-4">
                  {formData.image && !formData.imageFile && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                      <img src={formData.image.startsWith('http') ? formData.image : `${process.env.NEXT_PUBLIC_API_URL}${formData.image}`} alt="Current" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {formData.imageFile && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-brand-teal bg-slate-100 flex-shrink-0">
                      <img src={URL.createObjectURL(formData.imageFile)} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-1.5 px-3 text-xs font-bold text-slate-500 file:mr-3 file:py-0.5 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between pl-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sector Domain</label>
                    <Link href="/admin/specializations" className="text-[9px] font-black text-brand-teal hover:underline uppercase">Manage Sectors</Link>
                  </div>
                  <div className="relative">
                    <select
                      required
                      value={formData.specialization_id}
                      onChange={(e) => setFormData({ ...formData, specialization_id: e.target.value })}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                    >
                      <option value="" disabled>Select Domain...</option>
                      {specializations.map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Lifecycle Duration (Months)</label>
                  <input type="number" min={1} max={48} required value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hierarchy Level</label>
                  <div className="relative">
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                    >
                      <option value={1}>Tier 1 (Foundational)</option>
                      <option value={2}>Tier 2 (Intermediate)</option>
                      <option value={3}>Tier 3 (Mastery)</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 pl-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="peer w-6 h-6 opacity-0 absolute cursor-pointer"
                      />
                      <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 peer-checked:bg-brand-teal peer-checked:border-brand-teal transition-all flex items-center justify-center">
                        <CheckCircle2 color="white" size={14} className={cn("transition-opacity", formData.active ? "opacity-100" : "opacity-0")} />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest group-hover:text-brand-teal transition-colors">Operational Status</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.iq_required}
                        onChange={(e) => setFormData({ ...formData, iq_required: e.target.checked })}
                        className="peer w-6 h-6 opacity-0 absolute cursor-pointer"
                      />
                      <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center">
                        <Activity color="white" size={14} className={cn("transition-opacity", formData.iq_required ? "opacity-100" : "opacity-0")} />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest group-hover:text-amber-500 transition-colors">IQ Assessment Required</span>
                  </label>
                </div>
              </div>

              {/* Administrative Chronology */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-brand-teal uppercase tracking-[0.2em] mb-2">Administrative Chronology</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Admission Open</label>
                    <input type="date" value={formData.admission_open_date} onChange={(e) => setFormData({ ...formData, admission_open_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-teal" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Course Start</label>
                    <input type="date" value={formData.course_start_date} onChange={(e) => setFormData({ ...formData, course_start_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-teal" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Course End</label>
                    <input type="date" value={formData.course_end_date} onChange={(e) => setFormData({ ...formData, course_end_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-teal" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl h-11 font-bold text-slate-500 border-slate-200 hover:bg-slate-50">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 font-black shadow-lg shadow-brand-teal/20">
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> <span>Publishing...</span>
                    </div>
                  ) : (isEditMode ? 'Commit Sync' : 'Finalize Architecture')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
