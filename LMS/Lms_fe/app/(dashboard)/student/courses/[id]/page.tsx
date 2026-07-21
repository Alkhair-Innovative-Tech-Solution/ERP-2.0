'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  Video,
  Download,
  Clock,
  Users,
  ChevronRight,
  Play,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Layout,
  ExternalLink,
  Flag,
  Zap,
  Target,
  MapPin
} from 'lucide-react';
import { courseAPI, assignmentAPI, getFileUrl, contentAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      
      const courseData = await courseAPI.getById(courseId);
      setCourse(courseData);

      const assignmentsData = await assignmentAPI.getAll(courseId) as any;
      const assignmentsList = Array.isArray(assignmentsData) ? assignmentsData : (assignmentsData.results || []);
      setAssignments(assignmentsList);

      const enrollmentsData = await courseAPI.getMyEnrollments() as any;
      const enrollmentsList = Array.isArray(enrollmentsData) ? enrollmentsData : (enrollmentsData.results || []);
      const myEnrollment = enrollmentsList.find((e: any) => e.course?.id === courseId || e.course_id === courseId);
      setEnrollment(myEnrollment);

      try {
        const curriculumData = await contentAPI.getCurriculum(courseId, user?.id) as any;
        setCurriculum(curriculumData);
        if (curriculumData.length > 0) {
          setExpandedModule(curriculumData[0].id);
        }
      } catch (err) { 
        console.error("Error fetching curriculum:", err);
      }

    } catch (error) {
      toast.error('Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProgress = async (lessonId: string, currentStatus: boolean) => {
    try {
      await contentAPI.updateProgress(lessonId, !currentStatus);
      toast.success(currentStatus ? 'Marked as incomplete' : 'Lesson completed!');
      // Refresh curriculum data
      const user = getStoredUser();
      const updatedCurriculum = await contentAPI.getCurriculum(courseId, user?.id);
      setCurriculum(updatedCurriculum);
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-100 animate-spin border-t-brand-teal shadow-xl shadow-brand-teal/10" />
            <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
              <Zap className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Querying Knowledge Base...</p>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const progress = enrollment?.progress || 0;
  const totalLessons = curriculum.reduce((acc, mod) => acc + mod.lessons.length, 0);
  const completedLessons = curriculum.reduce((acc, mod) => acc + mod.lessons.filter((l: any) => l.is_completed).length, 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-20 animate-fadeIn">

      <div className="space-y-4">
        <button onClick={() => router.back()} className="group flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-brand-teal transition-colors">
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-brand-teal" />
            {course.title}
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Course details and learning materials</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 px-2">
        <div className="lg:col-span-3 space-y-8">

          {/* Course Overview Module */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all">
            <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-inner">
                <Layout className="w-5 h-5" />
              </div>
              Curriculum Intelligence
            </h2>
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Strategy Overview</h3>
              <p className="text-[17px] text-slate-600 leading-relaxed font-medium max-w-4xl">
                {course.description || "Synthesizing core foundations and advanced execution frameworks to ensure competitive dominance in this academic field."}
              </p>
            </div>
          </div>

          {/* Learning Materials Module - Hierarchical UI */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-dark/20 text-brand-teal">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Module Repository</h2>
              </div>
              <div className="flex items-center gap-6 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">
                  {completedLessons}/{totalLessons} SYNCED
                </span>
                <div className="w-32 bg-slate-200 rounded-full h-2.5 overflow-hidden p-0.5">
                  <div className="bg-brand-teal h-full rounded-full transition-all duration-1500" style={{ width: `${totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {curriculum.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
                    <Video className="w-10 h-10 text-slate-200" />
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Curriculum Sequence Pending</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {curriculum.map((module: any, mIdx: number) => (
                    <div key={module.id} className="border border-slate-100 rounded-[2rem] overflow-hidden">
                      <button 
                        onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                        className={`w-full flex items-center justify-between p-6 transition-all ${expandedModule === module.id ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'}`}
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className="w-10 h-10 rounded-xl bg-brand-dark text-brand-teal flex items-center justify-center font-black text-xs">
                            {String(mIdx + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">{module.title}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{module.lessons.length} Lessons Available</p>
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedModule === module.id ? 'rotate-90 text-brand-teal' : ''}`} />
                      </button>

                      {expandedModule === module.id && (
                        <div className="p-4 space-y-3 bg-white border-t border-slate-50 animate-slideDown">
                          {module.lessons.map((lesson: any, lIdx: number) => (
                            <div 
                              key={lesson.id}
                              className="group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-[1.5rem] bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/30 border border-transparent hover:border-brand-teal/20 transition-all"
                            >
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => handleToggleProgress(lesson.id, lesson.is_completed)}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${lesson.is_completed ? 'bg-brand-teal text-white border-brand-teal shadow-lg shadow-brand-teal/20' : 'bg-white text-slate-300 border-slate-100 hover:border-brand-teal/50 hover:text-brand-teal'}`}
                                >
                                  <CheckCircle className="w-5 h-5" />
                                </button>
                                <div>
                                  <h5 className="text-[13px] font-black text-slate-800 group-hover:text-brand-teal transition-colors uppercase tracking-tight">
                                    {lesson.title}
                                  </h5>
                                  <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      <Clock className="w-3 h-3" />
                                      {lesson.duration_minutes} MINS
                                    </div>
                                    <div className="w-1 h-1 rounded-full bg-slate-200" />
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {lesson.contents.length} ASSETS
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-4 md:mt-0">
                                {lesson.contents.map((content: any) => (
                                  <button 
                                    key={content.id}
                                    onClick={() => window.open(getFileUrl(content.file_url) || content.url, '_blank')}
                                    className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-brand-teal hover:border-brand-teal/30 hover:shadow-lg transition-all group/asset"
                                    title={content.title}
                                  >
                                    {content.content_type === 'VIDEO' ? <Video className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                  </button>
                                ))}
                                <button className="ml-2 p-3 bg-brand-dark text-brand-teal rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-dark/10">
                                  <Play className="w-4 h-4 fill-brand-teal" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-brand-dark rounded-[2.5rem] p-8 border border-white/5 shadow-2xl shadow-brand-dark/20 text-white">
            <h3 className="text-xs font-black text-brand-teal uppercase tracking-[0.3em] mb-8 border-b border-white/5 pb-4">Protocol Details</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Duration</span>
                </div>
                <span className="text-xs font-black text-white group-hover:text-brand-teal transition-colors">{course.duration} {course.duration_unit || 'Months'}</span>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Activation</span>
                </div>
                <span className="text-xs font-black text-white group-hover:text-brand-teal transition-colors">
                  {enrollment ? new Date(enrollment.enrolled_at).toLocaleDateString() : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Campus</span>
                </div>
                <span className="text-xs font-black text-brand-teal group-hover:text-brand-orange transition-colors">
                  {enrollment?.branch_name || enrollment?.scheduled_class?.branch_name || course?.branches?.[0]?.name || 'Main Campus'}
                </span>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center gap-4 text-slate-400">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                    <Target className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Milestone</span>
                </div>
                <span className="text-xs font-black text-brand-orange">
                  {enrollment ? new Date(new Date(enrollment.enrolled_at).setMonth(new Date(enrollment.enrolled_at).getMonth() + (course.duration || 4))).toLocaleDateString() : 'TBD'}
                </span>
            </div>
          </div>
        </div>

        {/* Session Schedule Card */}
        <div className="bg-brand-dark rounded-[2.5rem] p-8 border border-white/5 shadow-2xl shadow-brand-dark/20 text-white">
          <h3 className="text-xs font-black text-brand-teal uppercase tracking-[0.3em] mb-8 border-b border-white/5 pb-4">Session Schedule</h3>
          {course?.sessions && course.sessions.length > 0 ? (
            <div className="space-y-4">
              {course.sessions.map((session: any, idx: number) => {
                const isEnrolled = enrollment?.scheduled_class?.id === session.id;
                return (
                  <div 
                    key={session.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isEnrolled 
                        ? 'bg-brand-teal/10 border-brand-teal/30 shadow-lg shadow-brand-teal/10' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                          isEnrolled ? 'bg-brand-teal text-white' : 'bg-white/10 text-slate-400'
                        }`}>
                          {session.section ? session.section.replace('Sec ', '').charAt(0) : String(idx + 1)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-wide">
                            {session.section ? `Section ${session.section}` : `Section ${idx + 1}`}
                            {isEnrolled && <span className="ml-2 px-2 py-0.5 text-[8px] font-black bg-brand-teal text-white rounded-full">YOUR SECTION</span>}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {session.days?.join(', ') || 'TBA'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.start_time && session.end_time ? `${session.start_time} â€“ ${session.end_time}` : 'TBA'}
                            </span>
                            {session.room_name && (
                              <span className="flex items-center gap-1">
                                <Layout className="w-3 h-3" />
                                {session.room_name}
                              </span>
                            )}
                            {session.teacher_name && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {session.teacher_name}
                              </span>
                            )}
                            {session.branch_name && (
                              <span className="flex items-center gap-1 text-brand-teal">
                                <MapPin className="w-3 h-3" />
                                {session.branch_name}
                              </span>
                            )}
                          </div>
                          {isEnrolled && (
                            <WhatsAppLinkButton classId={session.id} />
                          )}
                        </div>
                      </div>
                      {session.seats_available !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          session.seats_available > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {session.seats_available > 0 ? `${session.seats_available} seat${session.seats_available > 1 ? 's' : ''} left` : 'Full'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm font-black uppercase tracking-widest">No scheduled sessions available</p>
              <p className="text-[11px] mt-1">Check back later for schedule updates</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl shadow-slate-200/40">
          <h3 className="text-xs font-black text-slate-400 mb-8 border-b border-slate-50 pb-4 uppercase tracking-[0.2em]">Resource Matrix</h3>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl group hover:bg-brand-teal/5 transition-all border border-slate-50 hover:border-brand-teal/20">
                <div className="flex items-center gap-4">
                  <Download className="w-5 h-5 text-brand-teal" />
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest text-left">Academic Protocol.pdf</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-brand-teal transition-transform group-hover:translate-x-1" />
              </button>
              <button className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl group hover:bg-brand-orange/5 transition-all border border-slate-100 hover:border-brand-orange/20">
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-brand-orange" />
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest text-left">Curriculum Schema.json</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-orange transition-all" />
              </button>

              <div className="pt-8 border-t border-slate-50 mt-8">
                <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-brand-orange/10 group transition-all border border-transparent hover:border-brand-orange/20">
                  <div className="flex items-center gap-3">
                    <Flag className="w-4 h-4 text-slate-300 group-hover:text-brand-orange transition-colors" />
                    <span className="text-[10px] font-black text-slate-400 group-hover:text-brand-orange uppercase tracking-widest transition-colors">Signal Discrepancy</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppLinkButton({ classId }: { classId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLink = async () => {
    setLoading(true);
    const res = await courseAPI.getClassWhatsAppLink(classId);
    setLink(res.link);
    setLoading(false);
    if (res.link) {
      window.open(res.link, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('No WhatsApp link available for this section');
    }
  };

  return (
    <button
      onClick={fetchLink}
      disabled={loading}
      className="mt-2 flex items-center gap-2 px-4 py-2 bg-brand-teal/20 hover:bg-brand-teal/30 border border-brand-teal/30 rounded-xl text-[10px] font-black text-brand-teal uppercase tracking-widest transition-all"
    >
      <MessageSquare className="w-3 h-3" />
      {loading ? 'Loading...' : 'Join WhatsApp Group'}
    </button>
  );
}
