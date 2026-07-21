"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer";
import {
  GraduationCap, BookOpen, AlertCircle, CheckCircle2,
  FileText, ArrowRight, RefreshCw, User, Mail, Phone, Hash,
  Edit3, X, Search, Loader2, CreditCard, ClipboardList
} from "lucide-react";

const STATUS_STEPS = [
  { key: "registered", label: "Registered", icon: User },
  { key: "test", label: "Assessment", icon: FileText },
  { key: "passed", label: "Qualified", icon: CheckCircle2 },
  { key: "deposit", label: "Deposit", icon: CreditCard },
  { key: "enrolled", label: "Enrolled", icon: GraduationCap },
];

function getCurrentStep(status: string, hasTestScore: boolean, depositPaid: boolean): number {
  if (status === "enrolled") return 5;
  if (depositPaid) return 4;
  if (status === "passed") return 3;
  if (hasTestScore && status === "failed") return 2;
  if (hasTestScore) return 3;
  return 1;
}

export default function LeadDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [changingCourse, setChangingCourse] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/verify");
        const data = await res.json();
        if (!data.authenticated) { router.push("/register"); return; }
      } catch { router.push("/register"); return; }
    }
    init();
  }, [router]);

  useEffect(() => {
    async function fetchData() {
      try {
        // 🔹 Multi-Tenancy: Get org_id from localStorage
        const orgId = localStorage.getItem('selected_org_id') || '';
        const orgParam = orgId ? `?organization_id=${orgId}` : '';
        const [prof, coursesRes] = await Promise.all([
          fetch("/proxy/get_auth?url=/api/auth/lead/profile/").then(r => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/courses/courses/${orgParam}`)
            .then(r => r.json()).catch(() => []),
        ]);
        setProfile(prof);
        setCourses(Array.isArray(coursesRes) ? coursesRes : coursesRes?.results || []);
      } catch { setError("Network error."); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  const coursesMap = useMemo(() => {
    const m = new Map<string, string>();
    courses.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [courses]);

  const getCourseName = (id: string | null) => id ? coursesMap.get(id) || "Unknown" : "Not assigned";

  const filteredCourses = useMemo(() => {
    const q = courseSearch.toLowerCase();
    if (!q) return courses;
    return courses.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.course_code?.toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  const handleCourseChange = async (newCourse: any) => {
    setChangingCourse(true);
    setChangeError(null);
    try {
      const res = await fetch("/proxy/get_auth?url=/api/auth/lead/change-course/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: newCourse.id, course_name: newCourse.name }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCoursePicker(false);
        setProfile((prev: any) => ({
          ...prev,
          course_id: newCourse.id,
          course_name: newCourse.name,
          course_code: newCourse.course_code,
          course_name_requested: newCourse.name,
          status: "pending",
          test_score: null,
        }));
      } else {
        setChangeError(data.detail || data.message || "Failed to change course.");
      }
    } catch { setChangeError("Network error."); }
    finally { setChangingCourse(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cream p-6 text-Black">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-[#4f46e5] animate-spin" />
        <p className="mt-4 text-sm font-semibold text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cream p-6 text-Black">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-lg font-semibold text-slate-700">{error}</p>
        <button onClick={() => router.push("/")} className="mt-4 px-6 py-2 bg-[#4f46e5] text-white rounded-xl font-bold text-sm hover:bg-[#4338ca] transition-all">
          Go Home
        </button>
      </div>
    );
  }

  const hasTestScore = profile?.test_score != null;
  const depositPaid = profile?.has_paid_deposit || false;
  const currentStep = getCurrentStep(profile?.status || "pending", hasTestScore, depositPaid);
  const leadSeqId = profile?.lead_auto_id;
  const courseName = profile?.course_name || profile?.course_name_requested || "Not assigned";

  return (
    <div className="min-h-screen bg-cream text-Black flex flex-col">
      <Navbar />
      <div className="max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 flex-1">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">

          {/* ─── Header ─── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#4f46e5]/10 text-[#4f46e5] flex items-center justify-center">
                <GraduationCap size={28} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">My Application</h1>
                <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">Track your admission status and manage your application.</p>
              </div>
            </div>
            {leadSeqId && (
              <div className="hidden sm:block text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref No.</p>
                <p className="text-lg font-black text-[#4f46e5]">#{leadSeqId}</p>
              </div>
            )}
          </div>

          {/* ─── Status Timeline ─── */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/60">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <ClipboardList size={18} /> Application Progress
            </h2>
            <div className="flex items-start justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-0 hidden sm:block" />
              <div className="absolute top-5 left-0 h-0.5 bg-emerald-500 -z-0 hidden sm:block" style={{ width: `${((currentStep - 1) / (STATUS_STEPS.length - 1)) * 100}%` }} />
              {STATUS_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i + 1 <= currentStep;
                const isCurrent = i + 1 === currentStep;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 z-10 flex-1">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-all text-sm font-bold
                      ${isActive ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-slate-100 text-slate-400"}
                      ${isCurrent ? "ring-4 ring-emerald-100 scale-110" : ""}
                    `}>
                      {isActive ? <CheckCircle2 size={18} /> : <StepIcon size={18} />}
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight ${isActive ? "text-emerald-700" : "text-slate-400"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Profile Card ─── */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2"><User size={18} /> Personal Info</h2>
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${
                profile?.status === "enrolled" ? "bg-emerald-50 text-emerald-600" :
                profile?.status === "passed" ? "bg-blue-50 text-blue-600" :
                profile?.status === "failed" ? "bg-rose-50 text-rose-600" :
                "bg-amber-50 text-amber-600"
              }`}>
                {profile?.status || "Pending"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <User size={16} className="text-slate-400 shrink-0" />
                <span className="font-semibold truncate">{profile?.full_name || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{profile?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span>{profile?.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Hash size={16} className="text-slate-400 shrink-0" />
                <span>Ref: <span className="font-bold">{leadSeqId || "—"}</span></span>
              </div>
            </div>
          </div>

          {/* ─── Course Card with Change ─── */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18} /> Applied Course</h2>
              {profile?.status !== "enrolled" && !depositPaid && (
                <button
                  onClick={() => setShowCoursePicker(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#4f46e5] bg-[#4f46e5]/5 hover:bg-[#4f46e5]/10 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit3 size={13} /> Change
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <BookOpen size={22} />
              </div>
              <div>
                <p className="font-bold text-slate-800">{courseName}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {profile?.course_code ? `Code: ${profile.course_code}` : "Admission Application"}
                </p>
              </div>
            </div>
            {depositPaid && (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                <AlertCircle size={13} />
                Course change is locked after deposit payment. Contact admin for changes.
              </div>
            )}
          </div>

          {/* ─── Test Card ─── */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText size={18} /> Skill Assessment
            </h2>
            {!profile?.course_id ? (
              <div className="flex items-center gap-3 text-amber-600 bg-amber-50 rounded-2xl p-4">
                <AlertCircle size={20} />
                <div>
                  <p className="text-sm font-semibold">No course selected</p>
                  <p className="text-xs mt-0.5">Select a course above to begin your assessment.</p>
                </div>
              </div>
            ) : hasTestScore ? (
              <div className="space-y-4">
                <div className={`flex items-start gap-4 rounded-2xl p-4 ${
                  profile?.status === "passed" || profile?.status === "enrolled"
                    ? "bg-emerald-50" : "bg-amber-50"
                }`}>
                  <div className={`p-2 rounded-xl ${
                    profile?.status === "passed" || profile?.status === "enrolled"
                      ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  }`}>
                    {profile?.status === "passed" || profile?.status === "enrolled"
                      ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">Assessment Completed</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                      <span className="font-semibold">Score: <span className="text-slate-800">{profile?.test_score}</span></span>
                      {profile?.status && <span>Status: <span className="font-bold">{profile.status}</span></span>}
                      <span>Deposit: {depositPaid ? "Paid" : "Pending"}</span>
                    </div>
                  </div>
                </div>
                {profile?.status === "passed" || profile?.status === "enrolled" ? (
                  <button onClick={() => router.push(`/register?lead_id=${profile?.id || profile?.lead_auto_id || ""}&phase=3`)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg">
                    Continue to Enrollment <ArrowRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => router.push(`/register/entrance-test/?lead_id=${profile?.id || profile?.lead_auto_id || ""}`)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all">
                    Retry Assessment <RefreshCw size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">A skill assessment is required for your selected course.</p>
                <button onClick={() => router.push(`/register/entrance-test/?lead_id=${profile?.id || profile?.lead_auto_id || ""}`)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-[#4f46e5]/20">
                  <FileText size={18} /> Start Assessment <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* ─── Back ─── */}
          <div className="flex justify-center pt-2">
            <button onClick={() => router.push("/")}
              className="px-6 py-3 text-sm font-semibold text-slate-400 hover:text-[#4f46e5] transition-colors">
              ← Back to Home
            </button>
          </div>
        </motion.div>
      </div>

      <Footer />

      {/* ─── Course Change Modal ─── */}
      <AnimatePresence>
        {showCoursePicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowCoursePicker(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg mx-auto shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Change Course</h3>
                <button onClick={() => setShowCoursePicker(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#4f46e5]/5 focus:border-[#4f46e5]/50"
                  />
                </div>

                {changeError && (
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-xl px-3 py-2">
                    <AlertCircle size={13} /> {changeError}
                  </div>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {filteredCourses.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-8 font-medium">No courses found.</p>
                  )}
                  {filteredCourses.map((course: any) => {
                    const isSelected = profile?.course_id === course.id;
                    return (
                      <button
                        key={course.id}
                        disabled={changingCourse}
                        onClick={() => handleCourseChange(course)}
                        className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl transition-all border ${
                          isSelected
                            ? "border-[#4f46e5] bg-[#4f46e5]/5"
                            : "border-transparent hover:bg-slate-50 hover:border-slate-200"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                          isSelected ? "bg-[#4f46e5] text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          <BookOpen size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isSelected ? "text-[#4f46e5]" : "text-slate-700"}`}>
                            {course.name}
                            {isSelected && <span className="ml-2 text-[10px] font-normal opacity-60">(current)</span>}
                          </p>
                          {course.course_code && (
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{course.course_code}</p>
                          )}
                        </div>
                        {changingCourse && isSelected && <Loader2 size={16} className="animate-spin text-[#4f46e5]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[11px] text-slate-400 font-medium text-center">
                  Changing your course will reset your assessment status. You will need to retake the test.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
