'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap, Search, Filter, Calendar, Users, 
  BookOpen, Plus, X, Loader2, Trash2, ShieldCheck, 
  ChevronDown, SearchIcon, Activity, Check, UserPlus,
  Edit2, Mail, Smartphone, Fingerprint, Info, BarChart3, DollarSign
} from 'lucide-react';
import { courseAPI, userAPI, branchAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSortableData } from '@/hooks/useSortableData';
import { useDebounce } from '@/hooks/useDebounce';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // needed for portal (SSR-safe)
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [lifecycleFilter, setLifecycleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    student_id: '',
    course_id: '',
    scheduled_class_id: '',
    branch_id: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [studentFormData, setStudentFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    cnic: '',
    gender: '',
    status: 'ACTIVE',
    level: '',
    batch: '',
    specialization: '',
    whatsapp_number: '',
    study_work_status: '',
    study_work_details: '',
    studied_at_idara: false,
    studying_at_idara: false,
    signature: '',
    test_score: 0,
    has_paid_deposit: false
  });

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [currentPage, pageSize, courseFilter, statusFilter, lifecycleFilter, debouncedSearch]);

  // Handle filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [courseFilter, statusFilter, debouncedSearch, lifecycleFilter]);

  // Initial load for static data
  useEffect(() => {
    loadStaticData();
  }, []);

  const loadStaticData = async () => {
    try {
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const [coursesRes, scheduledRes] = await Promise.all([
        courseAPI.getAll({ organization_id: orgId }).catch(() => []),
        courseAPI.getScheduledClasses().catch(() => ({ results: [] }))
      ]);
      setCourses(Array.isArray(coursesRes) ? coursesRes : ((coursesRes as any)?.results || []));
      setScheduledClasses(Array.isArray(scheduledRes) ? scheduledRes : (scheduledRes as any).results || []);
    } catch (error) {
      console.error('Error loading static data:', error);
    }
  };

  const fetchData = async () => {
    try {
      setIsDataLoading(true);
      
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      
      // 1. Fetch paginated enrollments
      let lifecycleStatus: string | undefined;
      let lifecycleClassStatus: string | undefined;
      if (lifecycleFilter !== 'ALL') {
        if (lifecycleFilter === 'active') { lifecycleStatus = 'enrolled'; }
        else if (lifecycleFilter === 'completed') { lifecycleStatus = 'completed'; }
        else if (lifecycleFilter === 'upcoming') { lifecycleClassStatus = 'upcoming'; lifecycleStatus = 'enrolled'; }
      }
      const enrollRes = await courseAPI.getEnrollments({
        page: currentPage,
        limit: pageSize,
        course_id: courseFilter !== 'ALL' ? courseFilter : undefined,
        status: lifecycleStatus || (statusFilter !== 'ALL' ? statusFilter : undefined),
        class_status: lifecycleClassStatus,
        search: debouncedSearch || undefined,
        organization_id: orgId,
      });

      const enrollList = enrollRes.items || [];
      setTotalItems(enrollRes.total || 0);
      setTotalPages(enrollRes.pages || 1);

      // 2. Collect unique student IDs from this page
      const studentIds = [...new Set(enrollList.map((en: any) => en.student_id))].filter(Boolean);
      
      // 3. Fetch details for these specific students
      let studentsMap: any = {};
      if (studentIds.length > 0) {
        const studentsRes = await userAPI.getByIds(studentIds as string[]);
        studentsRes.forEach((s: any) => {
          studentsMap[String(s.id)] = s;
        });
      }

      // 4. Enrich the data
      const enrichedData = enrollList.map((en: any) => {
        const student = studentsMap[String(en.student_id)];
        const studentFound = !!student;
        const ref = en.reference_number || en.roll_number || '';
        return {
          ...en,
          student_name: student ? (student.full_name || `${student.first_name} ${student.last_name}`) : (ref ? `Sync Required (${ref})` : `Orphan #${en.student_id?.slice(0, 8)}`),
          student_email: student?.email || (studentFound ? 'N/A' : '—'),
          student_id_code: student?.student_id || ref || 'N/A',
          test_score: student?.test_score,
          has_paid_deposit: student?.has_paid_deposit,
          course_id: en.course?.id || en.course,
          course_name: en.course?.name || `Course #${en.course}`,
          _orphaned: !studentFound,
          status: en.status?.toUpperCase() === 'ENROLLED' ? 'ACTIVE' : 'COMPLETED',
          section_name: en.scheduled_class?.section ? `Sec ${en.scheduled_class.section}` : null,
          scheduled_class_name: en.scheduled_class?.section ? `Sec ${en.scheduled_class.section}` : 'General',
          branch_name: en.branch_name || en.scheduled_class?.branch_name || null,
          batch: student?.batch || 'Unassigned'
        };
      });

      setEnrollments(enrichedData);
      
      // Load branches for the enroll modal
      if (branches.length === 0) {
        try {
          const branchData = await branchAPI.getAll();
          setBranches(Array.isArray(branchData) ? branchData : []);
        } catch (_) {}
      }
      
      // Load students on-demand for enroll modal (paginated, not all at once)
      if (students.length === 0) {
         const studentsRes = await userAPI.getList({ page: 1, limit: 100, role: 'STUDENT' });
         setStudents(studentsRes.items || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load enrollments');
    } finally {
      setIsDataLoading(false);
      setLoading(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await courseAPI.enrollStudent({
        student_id: formData.student_id,
        course_id: formData.course_id,
        scheduled_class_id: formData.scheduled_class_id || undefined,
        branch_id: formData.branch_id || undefined,
        is_active: true
      } as any);
      toast.success('Student enrolled successfully');
      setIsEnrollModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to enroll student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this enrollment? This action cannot be undone.')) return;
    try {
      await courseAPI.deleteEnrollment(id);
      toast.success('Enrollment deleted successfully');
      setEnrollments(enrollments.filter(e => e.id !== id));
    } catch (error) {
      toast.error('Failed to delete enrollment');
    }
  };

  const resetForm = () => {
    setFormData({ student_id: '', course_id: '', scheduled_class_id: '', branch_id: '' });
  };

  const handleEditClick = async (enroll: any) => {
    try {
      const student = students.find(s => String(s.id) === String(enroll.student_id));
      if (!student) {
        toast.error('Student details not found');
        return;
      }
      
      setEditingStudent(student);
      setEditingEnrollmentId(enroll.id);
      setStudentFormData({
        email: student.email || '',
        full_name: student.full_name || '',
        phone: student.phone || '',
        cnic: student.cnic || '',
        gender: student.gender || '',
        status: enroll.status,
        level: student.level || '',
        batch: student.batch || '',
        specialization: student.specialization || '',
        whatsapp_number: student.whatsapp_number || '',
        study_work_status: student.study_work_status || '',
        study_work_details: student.study_work_details || '',
        studied_at_idara: student.studied_at_idara === true,
        studying_at_idara: student.studying_at_idara === true,
        signature: student.signature || '',
        test_score: student.test_score || 0,
        has_paid_deposit: student.has_paid_deposit === true
      });
      setIsEditModalOpen(true);
    } catch (error) {
      toast.error('Failed to load student details');
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      setIsSubmitting(true);
      await userAPI.update(editingStudent.id, {
        email: studentFormData.email,
        full_name: studentFormData.full_name,
        phone: studentFormData.phone,
        cnic: studentFormData.cnic,
        gender: studentFormData.gender,
        level: studentFormData.level,
        batch: studentFormData.batch,
        specialization: studentFormData.specialization,
        whatsapp_number: studentFormData.whatsapp_number,
        study_work_status: studentFormData.study_work_status,
        study_work_details: studentFormData.study_work_details,
        studied_at_idara: studentFormData.studied_at_idara,
        studying_at_idara: studentFormData.studying_at_idara,
        signature: studentFormData.signature,
        test_score: studentFormData.test_score,
        has_paid_deposit: studentFormData.has_paid_deposit
      });

      // Update enrollment status if we have an enrollment ID
      if (editingEnrollmentId) {
        await courseAPI.updateEnrollment(editingEnrollmentId, {
          status: studentFormData.status
        });
      }
      
      toast.success('Scholar records updated successfully');
      setIsEditModalOpen(false);
      fetchData(); // Refresh all data to show changes
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;
      const errorMessage = typeof errorDetail === 'object' 
        ? JSON.stringify(errorDetail) 
        : (errorDetail || 'Failed to update student profile');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // We now use server-side filtering, so filteredEnrollments is just enrollments
  const { sortedData, sortConfig, requestSort } = useSortableData(enrollments);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Enrollment Registry...</p>
      </div>
    );
  }

  // ── Enroll Scholar Modal (rendered via portal) ──
  const enrollModal = isEnrollModalOpen ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsEnrollModalOpen(false)} />
      <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 border border-white group/modal">        
        <div className="flex items-start justify-between mb-10">
            <div>
                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Admissions Architect</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Enroll Scholar</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Initiate a new curriculum matriculation cycle for a scholar.</p>
            </div>
            <button onClick={() => setIsEnrollModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                <X size={24} />
            </button>
        </div>

        <form onSubmit={handleEnroll} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Scholar Profile</label>
            <div className="relative">
              <select
                required
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>Query Scholar Registry...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Curriculum Assignment</label>
            <div className="relative">
              <select
                required
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value, scheduled_class_id: '' })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>Select Core Program...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
            </div>
          </div>

          {formData.course_id && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Operational Batch Registry (Optional)</label>
              <div className="relative">
                <select
                  value={formData.scheduled_class_id}
                  onChange={(e) => setFormData({ ...formData, scheduled_class_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                >
                  <option value="">Awaiting Batch Assignment</option>
                  {scheduledClasses
                    .filter(sc => String(sc.course_id) === String(formData.course_id))
                    .map(sc => (
                      <option key={sc.id} value={sc.id}>Section {sc.section} — {sc.lab_room || 'Room Assignment Pending'}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Operational Branch (Optional)</label>
            <div className="relative">
              <select
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
              >
                <option value="">Auto (Derive from Session)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
            </div>
          </div>

          <div className="flex gap-4 pt-8">
            <Button type="button" variant="ghost" onClick={() => setIsEnrollModalOpen(false)} 
               className="flex-1 rounded-[24px] h-16 font-black text-slate-400 border-none bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest transition-all">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} 
               className="flex-[1.5] bg-brand-teal hover:bg-brand-dark text-white rounded-[24px] h-16 font-black shadow-2xl shadow-brand-teal/20 transition-all uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <GraduationCap size={20} />}
              {isSubmitting ? 'Validating...' : 'Authorize Admission'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  // ── Student Profile Modification Modal (rendered via portal) ──
  const editModal = isEditModalOpen ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)} />
      <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 border border-white group/edit-modal">
        <div className="absolute inset-x-0 top-0 h-3 bg-brand-teal opacity-20 group-hover/edit-modal:opacity-40 transition-all duration-700" />
        
        <div className="flex items-start justify-between mb-8">
            <div>
                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Identity Protocol</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Modify Scholar Profile</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Updates will reflect immediately across all institutional touchpoints.</p>
            </div>
            <button onClick={() => setIsEditModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                <X size={24} />
            </button>
        </div>

        <form onSubmit={handleUpdateStudent} className="space-y-8 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
          {/* --- Section: Basic Identity --- */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 border-l-2 border-brand-teal ml-1">Identity & Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Email (Login)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required type="email"
                    value={studentFormData.email || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Legal Name</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required type="text"
                    value={studentFormData.full_name || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required type="text"
                    value={studentFormData.phone || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">CNIC / B-Form</label>
                <div className="relative">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required type="text"
                    value={studentFormData.cnic || ''}
                    onChange={(e) => setStudentFormData({ ...studentFormData, cnic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* --- Section: Academic Logistics --- */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 border-l-2 border-brand-teal ml-1">Academic Logistics</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Scholar Level</label>
                <select
                  value={studentFormData.level || 'Level 1'}
                  onChange={(e) => setStudentFormData({ ...studentFormData, level: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all appearance-none"
                >
                  <option value="Level 1">Level 1 (Beginner)</option>
                  <option value="Level 2">Level 2 (Advanced)</option>
                  <option value="Level 3">Level 3 (Specialist)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Operational Batch</label>
                <input
                  placeholder="e.g. Batch 12"
                  value={studentFormData.batch || ''}
                  onChange={(e) => setStudentFormData({ ...studentFormData, batch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Specialization</label>
                <input
                  placeholder="e.g. Web Dev"
                  value={studentFormData.specialization || ''}
                  onChange={(e) => setStudentFormData({ ...studentFormData, specialization: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* --- Section: Entrance & Finance --- */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest pl-1 border-l-2 border-rose-500 ml-1">Entrance & Finance</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Entrance Test Score (%)</label>
                <div className="relative">
                  <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    type="number" min="0" max="100"
                    value={studentFormData.test_score ?? 0}
                    onChange={(e) => setStudentFormData({ ...studentFormData, test_score: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Deposit Verification</label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="has_paid_deposit"
                    checked={studentFormData.has_paid_deposit || false}
                    onChange={(e) => setStudentFormData({ ...studentFormData, has_paid_deposit: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="has_paid_deposit" className="text-[11px] font-bold text-slate-600 cursor-pointer flex items-center gap-2">
                    <DollarSign size={14} className={studentFormData.has_paid_deposit ? 'text-blue-600' : 'text-slate-400'} />
                    Security Deposit Confirmed
                  </label>
                </div>
              </div>
            </div>
          </div>


          {/* --- Section: Lifecycle & Enrollment --- */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 border-l-2 border-brand-teal ml-1">Lifecycle & Enrollment</p>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Enrollment Status</label>
                <select
                  value={studentFormData.status || 'enrolled'}
                  onChange={(e) => setStudentFormData({ ...studentFormData, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all appearance-none"
                >
                  <option value="enrolled">Enrolled (Active)</option>
                  <option value="completed">Completed (Finalized)</option>
                  <option value="dropped">Dropped (Withdrawn)</option>
                  <option value="failed">Failed</option>
                  <option value="transferred">Transferred</option>
                </select>
                <p className="text-[9px] text-slate-400 font-medium pl-1 italic">Updating this will change the student's current status for this specific course.</p>
              </div>
            </div>
          </div>

          {/* --- Section: Institutional History --- */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-1 border-l-2 border-amber-500 ml-1">Institutional History</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input
                  type="checkbox"
                  id="studied_at_idara"
                  checked={!!studentFormData.studied_at_idara}
                  onChange={(e) => setStudentFormData({ ...studentFormData, studied_at_idara: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-teal"
                />
                <label htmlFor="studied_at_idara" className="text-[11px] font-bold text-slate-600 cursor-pointer">Previously Studied at Idara</label>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input
                  type="checkbox"
                  id="studying_at_idara"
                  checked={!!studentFormData.studying_at_idara}
                  onChange={(e) => setStudentFormData({ ...studentFormData, studying_at_idara: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-teal"
                />
                <label htmlFor="studying_at_idara" className="text-[11px] font-bold text-slate-600 cursor-pointer">Currently Studying at Idara</label>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-10 sticky bottom-0 bg-white pb-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} 
               className="flex-1 rounded-2xl h-14 font-black text-slate-400 border-none bg-slate-50 hover:bg-slate-100 uppercase text-[10px] tracking-widest">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} 
               className="flex-[2] bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 font-black shadow-lg shadow-brand-teal/20 transition-all uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Commit Profile Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* ── Header Section ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Admissions Office</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <UserPlus className="w-7 h-7 text-brand-teal" />
              Course Enrollments
          </h1>
          <p className="text-slate-500 font-medium mt-1">Institutional records for scholar matriculation and curriculum distribution.</p>
        </div>
        <Button
            onClick={() => setIsEnrollModalOpen(true)}
            className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group"
        >
            <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Enroll Scholar
        </Button>
      </div>

      {/* ── Lifecycle Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: 'All Enrollments', icon: Users },
          { key: 'active', label: 'Active Learners', icon: Activity },
          { key: 'completed', label: 'Alumni', icon: GraduationCap },
          { key: 'upcoming', label: 'Upcoming', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLifecycleFilter(tab.key)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              lifecycleFilter === tab.key
                ? "bg-brand-teal text-white shadow-lg shadow-brand-teal/20 scale-105"
                : "bg-white text-slate-400 hover:text-slate-700 hover:shadow-sm border border-slate-100"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Intelligence Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Matriculated', value: totalItems, icon: GraduationCap, color: 'teal' },
          { label: lifecycleFilter === 'ALL' ? 'All Records' : lifecycleFilter === 'active' ? 'Active Learners' : lifecycleFilter === 'completed' ? 'Alumni' : 'Upcoming', value: totalItems, icon: lifecycleFilter === 'ALL' ? ShieldCheck : lifecycleFilter === 'active' ? Activity : lifecycleFilter === 'completed' ? Check : Calendar, color: lifecycleFilter === 'ALL' ? 'emerald' : lifecycleFilter === 'active' ? 'emerald' : lifecycleFilter === 'completed' ? 'blue' : 'amber' },
          { label: 'Catalog Volume', value: courses.length, icon: BookOpen, color: 'blue' },
          { label: 'Operational Batches', value: scheduledClasses.length, icon: Users, color: 'indigo' },
        ].map((stat, i) => (
            <div key={i} className="premium-card p-8 flex flex-col group border-none shadow-premium bg-white">
                <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm",
                    stat.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                    stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                    stat.color === 'blue' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                )}>
                    <stat.icon size={22} strokeWidth={2.5} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
            </div>
        ))}
      </div>

      {/* ── Filter Station ── */}
      <div className="premium-card p-4 flex flex-col md:flex-row gap-4 items-center border-none shadow-premium bg-slate-50/50">
        <div className="relative flex-1 group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
          <input
            type="text"
            placeholder="Search by scholar identity, email, or registry identification..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all font-sans"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-2xl px-5 h-11 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] focus:outline-none focus:ring-4 focus:ring-brand-teal/5 transition-all cursor-pointer min-w-[200px]"
          >
            <option value="ALL">Protocol: All Curriculums</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.title}</option>
            ))}
          </select>
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-2xl px-5 h-11 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] focus:outline-none focus:ring-4 focus:ring-brand-teal/5 transition-all cursor-pointer min-w-[160px]"
          >
            <option value="ALL">Lifecycle: All</option>
            <option value="active">Lifecycle: Active</option>
            <option value="completed">Lifecycle: Alumni</option>
            <option value="upcoming">Lifecycle: Upcoming</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-2xl px-5 h-11 text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] focus:outline-none focus:ring-4 focus:ring-brand-teal/5 transition-all cursor-pointer min-w-[160px]"
          >
            <option value="ALL">Status: All</option>
            <option value="enrolled">Status: Enrolled</option>
            <option value="completed">Status: Completed</option>
            <option value="dropped">Status: Dropped</option>
            <option value="failed">Status: Failed</option>
            <option value="transferred">Status: Transferred</option>
          </select>
        </div>
      </div>

      {/* ── Admissions Registry ── */}
      <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <SortableTableHeader label="Validated Scholar" sortKey="student_name" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Course Architecture" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Registration Cycle" sortKey="batch" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Entrance Score" sortKey="test_score" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Security Deposit" sortKey="has_paid_deposit" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {sortedData.length > 0 ? (
                sortedData.map((enroll) => (
                  <tr key={enroll.id} className="hover:bg-brand-teal/5 transition-colors group">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-110",
                          enroll._orphaned ? "bg-amber-100 text-amber-600" : "bg-brand-teal text-white"
                        )}>
                          {enroll._orphaned ? '!' : enroll.student_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "font-black tracking-tight text-sm truncate max-w-[180px]",
                              enroll._orphaned ? "text-amber-700" : "text-slate-900 group-hover:text-brand-teal"
                            )} title={enroll.student_name}>
                               {enroll.student_name}
                            </p>
                            {enroll._orphaned && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[8px] font-black text-amber-700 uppercase tracking-widest">Orphan</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className={cn(
                              "text-[10px] font-bold lowercase truncate max-w-[150px]",
                              enroll._orphaned ? "text-amber-400" : "text-slate-400"
                            )}>{enroll.student_email}</p>
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest",
                              enroll._orphaned ? "text-amber-500" : "text-brand-teal"
                            )}>{enroll.student_id_code}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 uppercase text-[10px] tracking-widest line-clamp-1">{enroll.course_name}</span>
                        {enroll.section_name && (
                          <div className="flex items-center gap-1.5 mt-1">
                             <div className="w-1 h-3 bg-brand-teal rounded-full" />
                             <span className="text-[9px] font-black text-brand-teal uppercase tracking-tighter">
                               {enroll.section_name} Registry
                             </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                          {enroll.batch}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          enroll.test_score ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {enroll.test_score ? `${enroll.test_score}%` : 'Not Required'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        {enroll.has_paid_deposit ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">PAID</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 rounded-full">
                            <span className="text-[10px] font-black uppercase tracking-widest">PENDING</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-1.5">
                        {enroll.scheduled_class?.status === 'active' ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
                            <Activity size={12} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                          </div>
                        ) : enroll.scheduled_class?.status === 'completed' ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-xl w-fit">
                            <Check size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Alumni</span>
                          </div>
                        ) : enroll.scheduled_class?.status === 'upcoming' ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-xl w-fit">
                            <Calendar size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Upcoming</span>
                          </div>
                        ) : null}
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg w-fit text-[8px] font-bold uppercase tracking-wider",
                          enroll.status === 'enrolled' ? "bg-slate-50 text-slate-500" :
                          enroll.status === 'completed' ? "bg-emerald-50/50 text-emerald-500" :
                          enroll.status === 'failed' ? "bg-rose-50 text-rose-500" :
                          enroll.status === 'dropped' ? "bg-amber-50 text-amber-600" :
                          enroll.status === 'transferred' ? "bg-purple-50 text-purple-500" :
                          "bg-slate-50 text-slate-400"
                        )}>
                          {enroll.status}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleEditClick(enroll)}
                          className="w-10 h-10 rounded-xl text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all active:scale-90"
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDelete(enroll.id)}
                          className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-200">
                        <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                           <GraduationCap size={48} strokeWidth={1} />
                        </div>
                        <div>
                           <p className="text-xl font-black text-slate-900 tracking-tighter">Admission Records Void</p>
                           <p className="text-slate-400 font-medium text-sm mt-1">The requested institutional query returned zero matriculated scholars.</p>
                           <Button variant="ghost" onClick={() => setSearchTerm('')} className="mt-4 text-brand-teal font-black uppercase text-[10px] tracking-widest">Reset Registry Query</Button>
                        </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Institutional Registry Pagination ── */}
        <div className="px-6 py-6 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between bg-slate-50/50 rounded-b-[40px] gap-4">
            <div className="flex items-center gap-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-brand-teal rounded-full" />
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} Scholars
                </div>
                {isDataLoading && <Loader2 size={14} className="animate-spin text-brand-teal" />}
            </div>
            
            <div className="flex items-center gap-1.5">
                <Button 
                    variant="ghost" 
                    disabled={currentPage === 1 || isDataLoading}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="rounded-xl h-10 px-4 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-brand-teal hover:bg-white disabled:opacity-30 transition-all active:scale-95"
                >
                    Previous
                </Button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        // Logic to show a limited window of pages
                        if (
                            pageNum === 1 || 
                            pageNum === totalPages || 
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                            return (
                                <Button
                                    key={pageNum}
                                    variant="ghost"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl font-black text-[10px] transition-all active:scale-90",
                                        currentPage === pageNum 
                                            ? "bg-brand-teal text-white shadow-xl shadow-brand-teal/20 scale-110 z-10" 
                                            : "text-slate-400 hover:text-brand-teal hover:bg-white"
                                    )}
                                >
                                    {pageNum}
                                </Button>
                            );
                        }
                        
                        if (
                            (pageNum === currentPage - 2 && pageNum > 1) || 
                            (pageNum === currentPage + 2 && pageNum < totalPages)
                        ) {
                            return <span key={pageNum} className="text-slate-300 px-1 text-xs">•••</span>;
                        }
                        
                        return null;
                    })}
                </div>

                <Button 
                    variant="ghost" 
                    disabled={currentPage === totalPages || isDataLoading}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="rounded-xl h-10 px-4 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-brand-teal hover:bg-white disabled:opacity-30 transition-all active:scale-95"
                >
                    Next
                </Button>
            </div>
        </div>
      </div>

      {/* Modals rendered via portal -> escapes any parent transform/filter/stacking context
          so the blur overlay always covers the FULL viewport including header/sidebar */}
      {mounted && enrollModal && createPortal(enrollModal, document.body)}
      {mounted && editModal && createPortal(editModal, document.body)}
    </div>
  );
}


