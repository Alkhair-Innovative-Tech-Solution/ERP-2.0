'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, FileText, Calendar, TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import { courseAPI, assignmentAPI, submissionAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function TeacherMyCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseStats, setCourseStats] = useState<Record<string, any>>({});
  const user = getStoredUser();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const coursesData = await courseAPI.getMyCourses();
      const coursesList = Array.isArray(coursesData) 
        ? coursesData 
        : (coursesData.results || coursesData || []);
      
      setCourses(coursesList);

      const statsMap: Record<string, any> = {};
      let allEnrollments: any = [];
      if (user?.id) {
        try {
          const enrollmentsData = await courseAPI.getEnrollmentsByInstructor(user.id).catch(() => []);
          allEnrollments = Array.isArray(enrollmentsData) 
            ? enrollmentsData 
            : ((enrollmentsData as any)?.results || []);
        } catch (error) {
          console.error('Error fetching enrollments:', error);
        }
      }

      for (const course of coursesList) {
        try {
          const courseEnrollments = allEnrollments.filter((e: any) => 
            (e.course?.id === course.id || e.course_id === course.id) && 
            e.completion_status !== 'DROPPED'
          );

          const assignmentsData = await assignmentAPI.getAll(course.id).catch(() => []);
          const assignments = Array.isArray(assignmentsData) 
            ? assignmentsData 
            : ((assignmentsData as any).results || []);

          let pendingSubmissions = 0;
          for (const assignment of assignments) {
            const submissionsData = await submissionAPI.getAll(assignment.id).catch(() => []);
            const submissions = Array.isArray(submissionsData) 
              ? submissionsData 
              : (submissionsData.results || []);
            pendingSubmissions += submissions.filter((s: any) => 
              s.status === 'SUBMITTED' || s.status === 'LATE'
            ).length;
          }

          statsMap[course.id] = {
            students: courseEnrollments.length,
            assignments: assignments.length,
            pendingGrading: pendingSubmissions,
          };
        } catch (error) {
          console.error(`Error fetching stats for course ${course.id}:`, error);
          statsMap[course.id] = {
            students: 0,
            assignments: 0,
            pendingGrading: 0,
          };
        }
      }

      setCourseStats(statsMap);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-brand-teal" />
          My Courses
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">View and manage your courses, students, and assignments.</p>
      </div>

      {courses.length === 0 ? (
        <div className="ui-card-lg text-center py-20">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
            <BookOpen className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">No Courses Found</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium">
            You haven't been assigned any courses yet. Please contact your coordinator to get started.
          </p>
          <div className="inline-flex items-center gap-2 text-brand-teal font-black uppercase tracking-widest text-[10px] bg-brand-teal/5 px-4 py-2 rounded-lg">
            Waiting for assignment...
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Course</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enrolled</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assignments</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {courses.map((course: any) => {
                  const stats = courseStats[course.id] || { students: 0, assignments: 0, pendingGrading: 0 };
                  const isPublished = course.is_published;

                  return (
                    <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-teal/10 transition-colors">
                            <BookOpen className="w-5 h-5 text-slate-400 group-hover:text-brand-teal transition-all" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-slate-900 text-sm tracking-tight">{course.title || course.name || course.course_name || 'Untitled Course'}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-teal font-black">
                              {course.course_code || course.code || 'AIT-LMS'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-slate-900 font-black">{stats.students}</td>
                      <td className="px-6 py-6 text-slate-900 font-black">{stats.assignments}</td>
                      <td className="px-6 py-6">
                        <span className={isPublished ? 'inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wide' : 'inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wide'}>
                          {isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <button
                          onClick={() => router.push(`/teacher/courses/${course.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                        >
                          View
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
