'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, FileText, CheckCircle, Clock, TrendingUp, Award,
  ArrowRight, Calendar, Star, Zap, GraduationCap, Medal,
  Download, Eye, Sparkles, ExternalLink
} from 'lucide-react';
import { courseAPI, certificateAPI, authAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AlumniDashboard() {
  const [completedEnrollments, setCompletedEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser());
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('lms_token') : null;
      if (!token || !currentUser) { setLoading(false); return; }

      const [freshUser, enrollmentsData] = await Promise.all([
        authAPI.getCurrentUser().catch(() => null),
        courseAPI.getMyEnrollments().catch(() => ({ items: [] })),
      ]);

      if (freshUser) {
        setCurrentUser(freshUser);
      }

      const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : (enrollmentsData.items || enrollmentsData.results || []);
      const completed = enrollments.filter((e: any) =>
        e.status === 'completed'
      ).map((e: any) => ({
        ...e,
        course_name: e.course?.name || e.course?.title || `Course #${e.course}`,
        course_code: e.course?.code || '',
        completed_at: e.completed_at || e.registration_date,
        section: e.scheduled_class?.section,
      }));

      setCompletedEnrollments(completed);

      const certs = await certificateAPI.getAll(currentUser.id).catch(() => []);
      setCertificates(Array.isArray(certs) ? certs : []);
    } catch (error) {
      console.error('Alumni dashboard error:', error);
      toast.error('Failed to load alumni data');
    } finally {
      setLoading(false);
    }
  };

  const certMap = new Map<string, any>();
  certificates.forEach((cert: any) => {
    certMap.set(`${cert.student_id}-${cert.course_id}`, cert);
  });

  const totalCompleted = completedEnrollments.length;
  const totalCertificates = certificates.length;
  const completionRate = totalCompleted > 0
    ? Math.round((totalCertificates / totalCompleted) * 100)
    : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-100 animate-spin border-t-brand-teal shadow-xl shadow-brand-teal/10" />
            <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
              <Medal className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Loading...</p>
            <p className="text-sm font-black text-brand-dark mt-1">Preparing your alumni profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-brand-teal" />
          Alumni
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Track your completed programs and certificates</p>
      </div>

      {/* â”€â”€ Stats Grid â”€â”€ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Programs Completed', value: totalCompleted, icon: GraduationCap, color: 'amber' },
          { label: 'Certificates Earned', value: totalCertificates, icon: Award, color: 'teal' },
          { label: 'Certification Rate', value: `${completionRate}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Membership', value: 'AIT Alumni', icon: Medal, color: 'indigo' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-3xl p-8 flex flex-col group border border-slate-100 shadow-sm hover:shadow-lg transition-all">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
              stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
              stat.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
            )}>
              <stat.icon size={22} strokeWidth={2.5} />
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2">{stat.value}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* â”€â”€ Completed Programs â”€â”€ */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Completed Programs</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Your academic journey at AIT</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-2xl">
            <CheckCircle size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">{totalCompleted} Complete</span>
          </div>
        </div>

        {completedEnrollments.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {completedEnrollments.map((enroll, i) => {
              const cert = certMap.get(`${enroll.student_id}-${enroll.course_id}`);
              return (
                <div key={enroll.id || i} className="px-8 py-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center text-amber-500 shadow-sm">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-base">{enroll.course_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {enroll.section && (
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Section {enroll.section}
                          </span>
                        )}
                        {enroll.completed_at && (
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(enroll.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {cert ? (
                      <button
                        onClick={() => router.push('/student/certificates')}
                        className="px-5 py-2.5 bg-brand-teal text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Download size={12} />
                        Certificate
                      </button>
                    ) : (
                      <span className="px-5 py-2.5 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                    <button
                      onClick={() => router.push(`/student/my-courses`)}
                      className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-teal hover:border-brand-teal/30 transition-all"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-8 py-24 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200 mx-auto mb-6">
              <GraduationCap size={48} strokeWidth={1} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">No Completed Programs Yet</h3>
            <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">
              Complete your first program to see it displayed here along with your certificate.
            </p>
            <Link
              href="/student/my-courses"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-brand-teal text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all"
            >
              <BookOpen size={14} />
              Browse Active Programs
            </Link>
          </div>
        )}
      </div>

      {/* â”€â”€ Recent Certificates â”€â”€ */}
      {certificates.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-8 py-8 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Recent Certificates</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Your latest achievements</p>
            </div>
            <Link
              href="/student/certificates"
              className="text-[10px] font-black text-brand-teal uppercase tracking-widest hover:underline flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-8">
            {certificates.slice(0, 6).map((cert: any) => (
              <div key={cert.id} className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                  <Award size={22} />
                </div>
                <p className="font-black text-slate-900 text-sm mb-1">{cert.course_title || cert.title || 'Certificate'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                  {cert.certificate_number}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {cert.issued_date ? new Date(cert.issued_date).toLocaleDateString() : ''}
                  </span>
                  <button
                    onClick={() => router.push('/student/certificates')}
                    className="w-9 h-9 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center hover:bg-brand-teal hover:text-white transition-all"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ Alumni CTA â”€â”€ */}
      <div className="bg-gradient-to-r from-brand-dark to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white text-center shadow-xl border border-white/5">
        <Medal className="w-16 h-16 mx-auto mb-6 text-amber-400" />
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Stay Connected</h2>
        <p className="text-slate-300 font-medium text-lg max-w-xl mx-auto mb-8">
          You're part of the growing AIT alumni network. Keep learning, stay involved, and inspire the next generation of scholars.
        </p>
        <button
          onClick={() => router.push('/student/my-courses')}
          className="px-8 py-4 bg-amber-500 text-slate-900 text-sm font-black rounded-2xl hover:bg-amber-400 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-amber-500/20 flex items-center gap-2 mx-auto"
        >
          <Sparkles className="w-5 h-5" />
          Explore New Programs
        </button>
      </div>
    </div>
  );
}
