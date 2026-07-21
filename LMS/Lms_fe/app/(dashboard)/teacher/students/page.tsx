'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, Search, Mail, User, Phone, Clock, CheckCircle, Award, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { courseAPI, userAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const user = getStoredUser();
  const router = useRouter();

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    studentId: string;
    courseId: string;
    studentName: string;
    courseName: string;
  }>({
    open: false,
    studentId: '',
    courseId: '',
    studentName: '',
    courseName: '',
  });

  const [completingKey, setCompletingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get teacher's courses
      const coursesData = await courseAPI.getMyCourses();
      const coursesList = Array.isArray(coursesData)
        ? coursesData
        : (coursesData.results || coursesData || []);

      setCourses(coursesList);

      let teacherEnrollments: any[] = [];
      if (user?.id) {
        try {
          const enrollmentsData: any = await courseAPI.getEnrollmentsByInstructor(user.id).catch(() => []);
          const allEnrollments = Array.isArray(enrollmentsData)
            ? enrollmentsData
            : (enrollmentsData.results || enrollmentsData || []);

          teacherEnrollments = allEnrollments.filter((e: any) =>
            e.completion_status !== 'DROPPED'
          );
        } catch (error) {
          console.error('Error fetching enrollments:', error);
        }
      }

      const studentsMap = new Map<string, any>();
      teacherEnrollments.forEach((enrollment: any) => {
        const studentId = enrollment.student_id;
        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, {
            id: studentId,
            enrollments: [],
            totalCourses: 0,
            totalProgress: 0,
          });
        }
        const student = studentsMap.get(studentId)!;
        student.enrollments.push(enrollment);
        student.totalCourses += 1;
        student.totalProgress += enrollment.progress || 0;
      });

      const studentIds = Array.from(studentsMap.keys()).filter(Boolean);
      let studentDetails: Record<string, any> = {};

      if (studentIds.length > 0) {
        try {
          const users = await userAPI.getByIds(studentIds);
          users.forEach((u: any) => {
            studentDetails[String(u.id).toLowerCase()] = u;
          });
        } catch (error) {
          console.error('Error fetching student names:', error);
        }
      }

      const studentsList = Array.from(studentsMap.values()).map((student: any) => {
        const studentIdLower = String(student.id).toLowerCase();
        const details = studentDetails[studentIdLower];

        return {
          ...student,
          full_name: details?.full_name || student.enrollments[0]?.student_name || `Student #${student.id}`,
          email: details?.email,
          phone: details?.phone_number || details?.phone,
          averageProgress: student.totalCourses > 0
            ? Math.round(student.totalProgress / student.totalCourses)
            : 0,
          courses: student.enrollments.map((e: any) => {
            // Smart Course Code logic (same as Student ID Card)
            let cCode = e.course?.course_code;
            if (!cCode || cCode.trim() === '') {
              const bracketMatch = (e.course?.name || '').match(/\(([^)]+)\)/);
              if (bracketMatch && bracketMatch[1]) {
                cCode = bracketMatch[1].split(' ')[0].toUpperCase();
              } else {
                cCode = (e.course?.name || 'CRS').split(' ').map((w: string) => w[0]).join('').toUpperCase().substring(0, 3);
              }
            }

            return {
              id: e.course?.id || e.course_id,
              enrollmentId: e.id,
              title: e.course?.name || e.course?.title || 'Unknown Course',
              course_code: cCode,
              progress: e.progress || 0,
              enrolled_at: e.enrolled_at || e.created_at,
            };
          }),
        };
      });

      studentsList.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const executeMarkComplete = async () => {
    const { studentId, courseId, studentName } = confirmModal;
    const key = `${studentId}-${courseId}`;
    
    setConfirmModal(prev => ({ ...prev, open: false }));
    setCompletingKey(key);
    
    try {
      const student = students.find(s => s.id === studentId);
      const course = student?.courses?.find((c: any) => c.id === courseId);
      const enrollmentId = course?.enrollmentId;

      if (!enrollmentId) {
        throw new Error('Enrollment not found');
      }

      await courseAPI.updateEnrollment(enrollmentId, { status: 'completed' });
      toast.success(`Success! Certificate issued for ${studentName}`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to issue certificate');
    } finally {
      setCompletingKey(null);
    }
  };

  const filteredStudents = students.filter((student: any) => {
    const matchesCourse = selectedCourse === 'all' || student.courses.some((c: any) => c.id === selectedCourse);
    const matchesSearch = !searchQuery || 
      String(student.id).includes(searchQuery) ||
      student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.courses.some((c: any) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.course_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCourse && matchesSearch;
  });

  const { sortedData, sortConfig, requestSort } = useSortableData(filteredStudents);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Loading students...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-brand-teal" />
          Students
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Track student progress and issue certificates.</p>
      </div>

      {/* Filters & Search */}
      <div className="ui-card p-4 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input-sm !pl-11"
          />
        </div>
        <div className="relative min-w-[300px] w-full lg:w-auto">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="form-input-sm appearance-none cursor-pointer pr-10"
          >
            <option value="all">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.course_code} | {course.title}</option>
            ))}
          </select>
          <BookOpen className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Main Table Interface */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No Students Found</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-sm px-6">No students match your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <SortableTableHeader label="Student" sortKey="full_name" currentSort={sortConfig} onSort={requestSort} />
                  <th className="ui-table-head">Contact</th>
                  <th className="ui-table-head">Courses</th>
                  <SortableTableHeader label="Status" sortKey="averageProgress" currentSort={sortConfig} onSort={requestSort} className="text-center" align="center" />
                  <SortableTableHeader label="Progress" sortKey="averageProgress" currentSort={sortConfig} onSort={requestSort} className="text-center" align="center" />
                  <th className="ui-table-head text-right">Certification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((student: any, idx: number) => (
                  <tr key={student.id || `student-${idx}`} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="ui-table-cell">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-teal group-hover:text-white transition-all font-bold">
                          {student.full_name?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-brand-teal transition-colors">
                            {student.full_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            ID: #{student.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="ui-table-cell">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-brand-teal/60" />
                          <span className="text-[11px] font-medium transition-colors group-hover:text-slate-900">
                            {student.email || 'â€”'}
                          </span>
                        </div>
                        {student.phone && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-brand-teal/60" />
                            <span className="text-[11px] font-medium">{student.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="ui-table-cell">
                      <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {student.courses.map((course: any, cIdx: number) => (
                          <span 
                            key={course.id || `course-${cIdx}`}
                            title={`${course.title} â€” ${course.progress}%`}
                            className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:border-brand-teal/40 transition-colors"
                          >
                            {course.course_code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="ui-table-cell text-center">
                      <span className={cn(
                        "badge",
                        student.averageProgress === 100 ? "badge-teal" : "badge-orange"
                      )}>
                        {student.averageProgress === 100 ? 'Completed' : 'Active'}
                      </span>
                    </td>
                    <td className="ui-table-cell">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-teal h-full rounded-full transition-all duration-700"
                            style={{ width: `${student.averageProgress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{student.averageProgress}%</span>
                      </div>
                    </td>
                    <td className="ui-table-cell text-right">
                      <div className="flex flex-col items-end gap-2">
                        {student.courses.map((course: any) => {
                          const key = `${student.id}-${course.id}`;
                          const isCompleting = completingKey === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setConfirmModal({
                                open: true,
                                studentId: student.id,
                                courseId: course.id,
                                studentName: student.full_name,
                                courseName: course.title
                              })}
                              disabled={isCompleting}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-brand-teal uppercase tracking-widest hover:bg-brand-teal hover:text-white transition-all disabled:opacity-50"
                            >
                              {isCompleting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Award className="w-3 h-3" />
                              )}
                              Issue {course.course_code} Certificate
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[300] p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-orange">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Issue?</h3>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                Are you sure you want to mark <span className="font-bold text-slate-900">"{confirmModal.studentName}"</span> as done for <span className="font-bold text-slate-900">"{confirmModal.courseName}"</span>?
                <br /><br />
                This will give the student their certificate.
              </p>
            </div>

            <div className="p-8 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={executeMarkComplete}
                className="btn-primary flex-1 !bg-brand-teal hover:!bg-teal-600"
              >
                Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
