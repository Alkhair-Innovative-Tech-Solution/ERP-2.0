'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { courseAPI, assignmentAPI, authAPI, userAPI } from '@/lib/api';
import { getStoredUser, setStoredUser } from '@/lib/auth';
import StudentIDCard from '@/components/StudentIDCard';
import { cn } from '@/lib/utils';
import { Award, X, TrendingUp, BookOpen, Clock, FileText, CheckCircle, MapPin } from 'lucide-react';

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIdCard, setShowIdCard] = useState(false);
  const [selectedCourseForId, setSelectedCourseForId] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser());
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Refresh data in parallel
      const [freshUser, teachersList, enrollmentsData] = await Promise.all([
        authAPI.getCurrentUser().catch(() => null),
        userAPI.getTeachers().catch(() => []),
        courseAPI.getMyEnrollments().catch(() => ({ results: [] }))
      ]);

      if (freshUser) {
        setStoredUser(freshUser);
        setCurrentUser(freshUser);
      }
      setTeachers(teachersList);

      const enrollments = Array.isArray(enrollmentsData)
        ? enrollmentsData
        : (enrollmentsData.results || enrollmentsData || []);

      const activeEnrollments = enrollments.filter((enrollment: any) => {
        return enrollment.status === 'enrolled' || enrollment.status === 'Enrolled';
      });

      const coursesWithProgress = activeEnrollments.map((enrollment: any) => {
        const course = enrollment.course || enrollment;
        const instructorId = enrollment.scheduled_class?.instructor_id;
        const instructor = teachersList.find((t: any) => t.id === instructorId);

        return {
          ...course,
          id: course.id || enrollment.course_id,
          enrollment_id: enrollment.id,
          enrolled_at: enrollment.enrolled_at || enrollment.created_at,
          progress: enrollment.progress || 0,
          completion_status: enrollment.completion_status || 'IN_PROGRESS',
          instructor_name: instructor?.full_name || 'Awaiting Selection',
          instructor_specialization: instructor?.specialization || 'Department Specialist',
          scheduled_class: enrollment.scheduled_class
        };
      });

      const enrolledCourseIds = coursesWithProgress.map((c: any) => c.id).filter(Boolean);
      let assignmentsList: any[] = [];

      if (enrolledCourseIds.length > 0) {
        const assignmentPromises = enrolledCourseIds.map((courseId: string) =>
          assignmentAPI.getAll(courseId).catch(() => [])
        );

        const assignmentResults = await Promise.all(assignmentPromises);

        assignmentsList = assignmentResults.flat().filter((a: any, index: number, self: any[]) =>
          index === self.findIndex((t: any) => t.id === a.id)
        );
      }

      setCourses(coursesWithProgress);
      setAssignments(assignmentsList);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCourseAssignments = (courseId: string) => {
    return assignments.filter((a: any) => a.course?.id === courseId || a.course_id === courseId);
  };

  const getUpcomingAssignments = (courseId: string) => {
    const courseAssignments = getCourseAssignments(courseId);
    return courseAssignments
      .filter((a: any) => a.due_date && new Date(a.due_date) > new Date())
      .slice(0, 3);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-teal-100 animate-spin border-t-brand-teal" />
            <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 px-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-brand-teal" />
          My Courses
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Continue your studies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content: Course List */}
        <div className="lg:col-span-2 space-y-6">
          {courses.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-100 shadow-xl shadow-slate-200/40">
              <div className="w-20 h-20 mx-auto mb-6 bg-slate-50 rounded-[2rem] flex items-center justify-center shadow-inner">
                <BookOpen className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No courses found</h3>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">You haven't joined any courses yet. Explore our courses to get started!</p>
              <button onClick={() => router.push('/student/dashboard')} className="btn-primary mx-auto">
                 Return to Dashboard
              </button>
            </div>
          ) : (
            courses.map((course: any) => {
              const courseAssignments = getCourseAssignments(course.id);
              const duration = course.duration ? `${course.duration} ${course.duration_unit || 'months'}` : '4 Months';
              const colors = ['from-brand-teal', 'from-slate-700', 'from-brand-orange'];
              const accent = colors[courses.indexOf(course) % colors.length];

              return (
                <div key={course.id} className="bg-white rounded-[3rem] p-4 shadow-xl shadow-slate-200/40 border border-slate-100 hover:shadow-2xl transition-all group mb-10 overflow-hidden">
                  <div className="flex flex-col xl:flex-row gap-8 p-4">
                    {/* Visual Card */}
                    <div className={cn("w-full xl:w-72 h-48 rounded-[2rem] bg-gradient-to-br text-white p-8 relative overflow-hidden shrink-0 shadow-lg", accent, "to-black/40")}>
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                       <div className="relative z-10 h-full flex flex-col justify-between">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl font-black">
                             {course.title?.[0]}
                          </div>
                          <div>
                             <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-60 mb-1">{course.course_code || 'AIT-CERT'}</p>
                             <h3 className="font-black text-xl leading-tight line-clamp-2">{course.title}</h3>
                          </div>
                       </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 flex flex-col justify-between py-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-6">
                            <div>
                               <h2 className="text-2xl font-black text-slate-900 mb-2">{course.title}</h2>
                               <div className="flex flex-wrap gap-2">
                                  <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">Level {course.level || 1}</span>
                                  <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest">Authorized Access</span>
                               </div>
                            </div>

                            {/* Instructor Profile (NEW) */}
                            <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                               <div className="w-12 h-12 rounded-xl bg-brand-teal text-white flex items-center justify-center text-sm font-black shadow-lg shadow-brand-teal/20">
                                  {course.instructor_name?.[0]}
                               </div>
                               <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lead Instructor</p>
                                  <p className="text-sm font-black text-slate-800">{course.instructor_name}</p>
                                  <p className="text-[11px] font-bold text-brand-teal">{course.instructor_specialization}</p>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6">
                            {/* Mastery Progress */}
                            <div>
                               <div className="flex justify-between items-end mb-3">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Mastery</span>
                                  <span className="text-xl font-black text-slate-900">{course.progress || 0}%</span>
                               </div>
                               <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                                  <div className={cn("h-full rounded-full transition-all duration-1000", accent.replace('from-', 'bg-'))} style={{ width: `${course.progress || 0}%` }} />
                               </div>
                            </div>

                            {/* Schedule Info */}
                            <div className="grid grid-cols-3 gap-4">
                               <div className="space-y-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Schedule</p>
                                  <p className="text-[11px] font-black text-slate-700">{course.scheduled_class?.days?.join(', ') || 'Online Anytime'}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Timings</p>
                                  <p className="text-[11px] font-black text-slate-700">{course.scheduled_class?.start_time?.slice(0, 5) || 'Self-Paced'}</p>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Campus</p>
                                  <p className="text-[11px] font-black text-brand-teal flex items-center gap-1">
                                     <MapPin className="w-3 h-3" />
                                     {course.branch_name || course.scheduled_class?.branch_name || 'Main Campus'}
                                  </p>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                         <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-slate-400 group-hover:text-brand-teal transition-colors">
                               <Clock className="w-4 h-4" />
                               <span className="text-xs font-black uppercase tracking-wider">{duration}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                               <FileText className="w-4 h-4" />
                               <span className="text-xs font-black uppercase tracking-wider">{courseAssignments.length} Assignments</span>
                            </div>
                         </div>

                         <div className="flex gap-3">
                            <button
                               onClick={() => {
                                  setSelectedCourseForId(course);
                                  setShowIdCard(true);
                               }}
                               className="px-6 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest transition-all"
                            >
                               Student ID
                            </button>
                            <button
                               onClick={() => router.push(`/student/courses/${course.id}`)}
                               className={cn("px-10 py-3 rounded-xl text-white text-[11px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95", accent.replace('from-', 'bg-'))}
                            >
                               Continue Study
                            </button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Sidebar: Upcoming Assignments */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 sticky top-10 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                   <Clock className="w-4 h-4" />
                </div>
                Due soon
              </h3>
            </div>

            <div className="divide-y divide-slate-50">
              {assignments.filter(a => new Date(a.due_date) > new Date()).length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                    <CheckCircle className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No pending tasks</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto scrollbar-hide p-2">
                  {assignments
                    .filter(a => new Date(a.due_date) > new Date())
                    .slice(0, 8)
                    .map((assignment: any) => {
                       const daysLeft = Math.ceil((new Date(assignment.due_date).getTime() - Date.now()) / 86400000);
                       const isUrgent = daysLeft <= 2;
                       return (
                        <div key={assignment.id} className="p-6 hover:bg-slate-50/50 transition-all group rounded-2xl mb-1 cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-black text-slate-800 line-clamp-1 group-hover:text-brand-orange transition-colors">{assignment.title}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                  {courses.find(c => c.id === (assignment.course?.id || assignment.course_id))?.title || 'Assignment'}
                               </p>
                            </div>
                            <span className={cn('shrink-0 text-[10px] font-black px-2.5 py-1 rounded-xl border',
                              isUrgent ? 'bg-orange-50 text-brand-orange border-brand-orange/10' : 'bg-slate-50 text-slate-400 border-slate-100'
                            )}>
                              {daysLeft <= 0 ? (daysLeft === 0 ? 'Today!' : 'Overdue') : `${daysLeft}d left`}
                            </span>
                          </div>
                        </div>
                       );
                    })}
                </div>
              )}
            </div>
            
            <button
              onClick={() => router.push('/student/assignments')}
              className="w-full py-5 text-[11px] font-black text-slate-400 hover:text-brand-teal uppercase tracking-[0.2em] bg-slate-50/50 hover:bg-slate-50 transition-all border-t border-slate-50"
            >
              View Assignments
            </button>
          </div>
        </div>
      </div>
      {showIdCard && selectedCourseForId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowIdCard(false)}
              className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:rotate-90 transition-all z-[110] shadow-sm"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-10">
              <h3 className="text-2xl font-black text-slate-900 italic tracking-tight">Your Official <span className="text-brand-teal text-3xl font-black not-italic ml-1">AIT</span> ID Card</h3>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Verified Student Credentials</p>
            </div>

            <div className="flex justify-center scale-110 mb-6">
              <StudentIDCard 
                studentData={{
                  full_name: currentUser?.full_name || '',
                  student_id: (currentUser as any)?.student_id || '001',
                  profile_image: (currentUser as any)?.profile_image || ''
                }}
                courseData={{
                  name: selectedCourseForId.title || selectedCourseForId.name,
                  course_code: selectedCourseForId.course_code || 'CS',
                  level: selectedCourseForId.level || 1,
                  registration_date: selectedCourseForId.registration_date || selectedCourseForId.enrolled_at || new Date().toISOString()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
