'use client';

import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { ArrowLeft, MapPin, Clock, ShieldCheck, GraduationCap, Info, CheckCircle2, XCircle, Sparkles, Wallet, BookOpen } from 'lucide-react';
import Footer from '@/components/mainComponent/Footer';
import Navbar from '@/components/mainComponent/Navbar';

interface Branch {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface Session {
  id: string;
  section?: string;
  days: string[];
  start_time?: string;
  end_time?: string;
  room_name?: string;
  teacher_name?: string;
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  strength_status?: string;
  admission_open_date?: string;
  course_start_date?: string;
  total_students?: number;
  room_capacity?: number;
  seats_available?: number;
}

interface CourseData {
  id: string;
  name: string;
  description: string;
  additional_description?: string;
  image: string | null;
  specialization_id: string;
  specialization: { id: string; name: string } | string;
  level: number;
  duration: number;
  admission_status: string;
  admission_open_date?: string;
  course_start_date?: string;
  course_end_date?: string;
  branches: Branch[];
  sessions: Session[];
  sessions_count: number;
  prerequisite_course?: { id: string; name: string } | null;
  next_level_course?: { id: string; name: string } | null;
}

interface FeeInfo {
  monthly_maintenance_fee: number;
  one_time_fee: number;
  payment_plan: string;
  deposit_amount: number;
  bag_fee: number;
  id_card_fee: number;
  certificate_fee: number;
}

const CourseDetail = () => {
  const searchParams = useSearchParams();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const defaultImage = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800';

  useEffect(() => {
    const fetchData = async () => {
      const id = searchParams?.get('id');
      if (!id) { setIsLoading(false); return; }

      try {
        const [courseRes, feeRes] = await Promise.all([
          fetch(`/proxy/get?url=/api/courses/courses/${id}/`),
          fetch(`/proxy/get?url=/api/courses/courses/${id}/fee-info/`),
        ]);

        if (courseRes.ok) {
          const cd = await courseRes.json();
          const data = Array.isArray(cd) ? cd[0] : (cd.data || cd);
          setCourse({
            ...data,
            branches: Array.isArray(data.branches) ? data.branches : [],
            sessions: Array.isArray(data.sessions) ? data.sessions : [],
            sessions_count: data.sessions_count || 0,
          });
        }

        if (feeRes.ok) {
          const fd = await feeRes.json();
          setFeeInfo(fd.data || fd);
        }
      } catch (err) {
        console.error('Failed to fetch course details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-Black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-SeaGrean dark:border-Orange mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading Course Details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-cream dark:bg-Black flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-cream mb-4">Course Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">The course details you are looking for are not available.</p>
        <Link href="/courses" className="px-6 py-2 bg-SeaGrean dark:bg-Orange text-cream rounded-full hover:opacity-90 transition-all font-medium">
          Back to Courses
        </Link>
      </div>
    );
  }

  const specName = typeof course.specialization === 'object' && course.specialization !== null
    ? (course.specialization as any).name || ''
    : (searchParams?.get('specialization_name') || '');

  return (
    <div>
      <Navbar />
      <main className="container mx-auto px-4 py-12 min-h-screen bg-cream dark:bg-Black mt-10">
        <Link
          href="/courses"
          className="inline-flex items-center px-4 py-2 bg-SeaGrean/10 dark:bg-Orange/10 text-SeaGrean dark:text-Orange hover:bg-SeaGrean hover:text-cream dark:hover:bg-Orange dark:hover:text-cream transition-all duration-300 transform hover:scale-105 mb-6 group rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transform group-hover:-translate-x-1 transition-transform duration-300 rounded-full" />
          Back to Courses
        </Link>

        <div className="bg-cream dark:bg-Blue/80 rounded-2xl overflow-hidden border-2 border-SeaGrean dark:border-SeaGrean hover:border-SeaGrean dark:hover:border-Orange shadow-lg hover:shadow-xl transition-all duration-500 hover:shadow-SeaGrean/30 dark:hover:shadow-Orange/30">
          <div className="relative w-full h-[300px] md:h-[400px]">
            <Image
              src={course.image ? `${process.env.NEXT_PUBLIC_API_URL || ''}${course.image}` : defaultImage}
              alt={course.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-Black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <h1 className="text-3xl md:text-4xl font-[400] text-cream mb-2">{course.name}</h1>
              <p className="text-cream/80 text-base md:text-lg line-clamp-2">{course.description}</p>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-[300] text-Black dark:text-SeaGrean border-b border-SeaGrean/20 pb-2">Course Details</h2>

                {course.description && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-SeaGrean/10">
                    <h3 className="text-lg font-bold text-Black dark:text-SeaGrean mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Course Overview
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">{course.description}</p>
                    {course.additional_description && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-line">{course.additional_description}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-SeaGrean/5 dark:bg-Orange/5 p-6 rounded-2xl border border-SeaGrean/20 dark:border-Orange/20 space-y-4">
                  <h3 className="text-xl font-bold text-SeaGrean dark:text-Orange flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Admission Status
                  </h3>
                  {course.admission_status?.toLowerCase() === 'open' ? (
                    <div className="flex flex-col gap-3">
                      <span className="bg-green-500 text-white px-4 py-1.5 rounded-full text-sm font-bold w-fit animate-pulse">ADMISSION OPEN</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-2">
                        <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <span className="text-gray-500 text-xs font-semibold uppercase">Open Date</span>
                          <span className="text-Black dark:text-cream font-medium">{course.admission_open_date || 'TBA'}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <span className="text-gray-500 text-xs font-semibold uppercase">Start Date</span>
                          <span className="text-Black dark:text-cream font-medium">{course.course_start_date || 'TBA'}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <span className="text-gray-500 text-xs font-semibold uppercase">End Date</span>
                          <span className="text-Black dark:text-cream font-medium">{course.course_end_date || 'TBA'}</span>
                        </div>
                      </div>
                    </div>
                  ) : course.admission_status?.toLowerCase() === 'coming_soon' ? (
                    <div className="flex flex-col gap-2">
                      <span className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-bold w-fit">COMING SOON</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Opens: <span className="font-bold">{course.admission_open_date || 'TBA'}</span></p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-bold w-fit">ADMISSION CLOSED</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300 italic">Stay tuned for the next batch updates!</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10">
                    <span className="text-gray-500 text-xs font-semibold uppercase">Duration</span>
                    <span className="text-Black dark:text-cream font-bold flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-SeaGrean" />
                      {course.duration} Months
                    </span>
                  </div>
                  <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10">
                    <span className="text-gray-500 text-xs font-semibold uppercase">Level</span>
                    <span className="text-Black dark:text-cream font-bold flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-Orange" />
                      {course.level == 1 ? 'Beginner' : course.level == 2 ? 'Advanced' : `Level ${course.level}`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10">
                  <span className="text-gray-500 text-xs font-semibold uppercase">Specialization</span>
                  <span className="text-SeaGrean dark:text-Orange font-bold mt-1">{specName || 'N/A'}</span>
                </div>

              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-SeaGrean/20 pb-2">
                  <h2 className="text-2xl font-[300] text-Black dark:text-SeaGrean">Class Schedule</h2>
                  {course.sessions_count > 0 && (
                    <span className="text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full">
                      {course.sessions_count} Open Section{course.sessions_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {course.sessions && course.sessions.length > 0 ? (
                  <div className="space-y-3">
                    {course.sessions.map((s) => (
                      <div key={s.id} className="bg-SeaGrean/5 dark:bg-Orange/5 p-4 rounded-2xl border border-SeaGrean/20 dark:border-Orange/20">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {s.section && (
                            <span className="text-xs font-bold bg-SeaGrean/10 dark:bg-Orange/10 text-SeaGrean dark:text-Orange px-2 py-0.5 rounded-full">
                              Section {s.section}
                            </span>
                          )}
                          {s.branch_name && (
                            <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {s.branch_name} ({s.branch_code})
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3">
                          <div className="flex flex-col">
                            <span className="text-gray-500 text-xs font-semibold uppercase">Days</span>
                            <span className="text-Black dark:text-cream font-bold mt-0.5">
                              {s.days?.map((d) => d.charAt(0) + d.slice(1).toLowerCase()).join(', ') || 'TBA'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 text-xs font-semibold uppercase">Time</span>
                            <span className="text-Black dark:text-cream font-bold mt-0.5 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-SeaGrean" />
                              {s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : 'TBA'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 text-xs font-semibold uppercase">Room</span>
                            <span className="text-Black dark:text-cream font-medium mt-0.5">{s.room_name || 'TBA'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 text-xs font-semibold uppercase">Instructor</span>
                            <span className="text-Black dark:text-cream font-medium mt-0.5">{s.teacher_name || 'TBA'}</span>
                          </div>
                        </div>
                        {s.seats_available != null && (
                          <div className="mt-2 pt-2 border-t border-SeaGrean/10 dark:border-Orange/10">
                            <span className={`text-xs font-bold ${s.seats_available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {s.seats_available > 0 ? `${s.seats_available} seat${s.seats_available > 1 ? 's' : ''} available` : 'Full'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No open admission sections available. Check back later.</p>
                )}

                <h2 className="text-2xl font-[300] text-Black dark:text-SeaGrean border-b border-SeaGrean/20 pb-2">Fee Structure</h2>

                <div className="bg-SeaGrean/5 dark:bg-Orange/5 p-6 rounded-2xl border border-SeaGrean/20 dark:border-Orange/20 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-SeaGrean" />
                      Monthly Fee
                    </span>
                    <span className="font-bold text-Black dark:text-cream">PKR {feeInfo?.monthly_maintenance_fee?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-SeaGrean" />
                      Security Deposit
                    </span>
                    <span className="font-bold text-Black dark:text-cream">PKR {feeInfo?.deposit_amount?.toLocaleString() || '3,000'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-SeaGrean" />
                      Bag Fee
                    </span>
                    <span className="font-bold text-Black dark:text-cream">PKR {feeInfo?.bag_fee?.toLocaleString() || '800'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-SeaGrean" />
                      ID Card Fee
                    </span>
                    <span className="font-bold text-Black dark:text-cream">PKR {feeInfo?.id_card_fee?.toLocaleString() || '200'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-SeaGrean" />
                      Certificate Fee
                    </span>
                    <span className="font-bold text-Black dark:text-cream">PKR {feeInfo?.certificate_fee?.toLocaleString() || '200'}</span>
                  </div>
                  {feeInfo?.payment_plan && (
                    <div className="pt-2 text-xs text-gray-500 italic">
                      Payment Plan: {feeInfo.payment_plan === 'monthly' ? 'Monthly' : 'One Time'}
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-[300] text-Black dark:text-SeaGrean border-b border-SeaGrean/20 pb-2 mt-6">Prerequisites & Next Level</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-SeaGrean" />
                      Prerequisite
                    </h3>
                    {course.prerequisite_course ? (
                      <p className="text-Black dark:text-cream font-medium">{course.prerequisite_course.name}</p>
                    ) : (
                      <p className="text-gray-400 text-sm">None required</p>
                    )}
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-Orange" />
                      Next Level
                    </h3>
                    {course.next_level_course ? (
                      <p className="text-Black dark:text-cream font-medium">{course.next_level_course.name}</p>
                    ) : (
                      <p className="text-gray-400 text-sm">No advanced course</p>
                    )}
                  </div>
                </div>

                <h2 className="text-2xl font-[300] text-Black dark:text-SeaGrean border-b border-SeaGrean/20 pb-2 mt-6">Available Branches</h2>
                {course.branches && course.branches.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {course.branches.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-SeaGrean/10 hover:border-SeaGrean/40 transition-all">
                        <div className="w-10 h-10 rounded-full bg-SeaGrean/10 dark:bg-Orange/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-SeaGrean dark:text-Orange" />
                        </div>
                        <div>
                          <p className="font-bold text-Black dark:text-cream text-sm">{b.name}</p>
                          <p className="text-xs text-gray-500">{b.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Not assigned to any branch yet</p>
                )}
              </div>
            </div>

            <div className="flex justify-start pt-4 border-t border-SeaGrean/20">
              {course.admission_status?.toLowerCase() === 'open' ? (
                <Link
                  href={{
                    pathname: '/register',
                    query: {
                      course_id: course.id,
                      specialization_id: course.specialization_id,
                    },
                  }}
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium bg-SeaGrean dark:bg-Orange text-cream rounded-full relative overflow-hidden transform hover:scale-105 hover:-translate-y-1 transition-all duration-500 ease-out shadow-lg hover:shadow-xl shadow-SeaGrean/20 dark:shadow-Orange/20"
                >
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Enroll Now
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium bg-gray-300 text-gray-500 rounded-full cursor-not-allowed"
                >
                  Enrollment {course.admission_status === 'coming_soon' ? 'Opening Soon' : 'Closed'}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const CourseDetailPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream dark:bg-Black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-SeaGrean dark:border-Orange mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    }>
      <CourseDetail />
    </Suspense>
  );
};

export default CourseDetailPage;
