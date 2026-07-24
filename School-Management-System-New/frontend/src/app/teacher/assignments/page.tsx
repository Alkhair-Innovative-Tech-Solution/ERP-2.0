"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, FileText, Users, BarChart2, Rss,
  Clock, ChevronRight, ChevronDown, MoreVertical, Trash2, Eye,
  ClipboardList, HelpCircle, BookOpen, RefreshCw, List
} from "lucide-react";
import { apiGet, apiDelete, getStoredUserProfile } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

interface Assignment {
  id: number; title: string; subject_name: string;
  classroom_label: string | null; classroom_id: number | null;
  total_marks: number; due_date: string | null; is_published: boolean;
  assignment_type: string; submission_count: number; created_at: string;
  description: string | null;
}
interface Submission {
  id: number; student_id: number; student_name: string;
  grade: number | null; status: string;
}
interface Student {
  id: number; full_name: string; gr_number?: string;
}

type Tab = "stream" | "classwork" | "people" | "grades";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "stream",    label: "Stream",    icon: Rss },
  { key: "classwork", label: "Classwork", icon: FileText },
  { key: "grades",    label: "Grades",    icon: BarChart2 },
];

const COLORS = ["#274c77","#6096ba","#0f766e","#7c3aed","#d97706","#0891b2","#be123c","#475569"];
function strColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function Av({ name, size = 32, color }: { name: string; size?: number; color?: string }) {
  const bg = color || strColor(name);
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: bg }}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

export default function TeacherClassroomPage() {
  const router = useRouter();
  const profile = getStoredUserProfile();
  const teacherName = profile?.full_name || profile?.username || "Teacher";

  const [tab, setTab] = useState<Tab>("stream");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Record<number, Submission[]>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [assignmentSubs, setAssignmentSubs] = useState<Record<number, Submission[]>>({});
  const [classroomCounts, setClassroomCounts] = useState<Record<number, number>>({});
  const [loadingSubs, setLoadingSubs] = useState<Set<number>>(new Set());

  useEffect(() => { loadAssignments(); }, []);

  useEffect(() => {
    if (tab === "grades" && assignments.length > 0) loadAllSubmissions();
    if (tab === "people") loadStudents();
  }, [tab]);

  async function loadAssignments() {
    setLoading(true);
    try {
      const data = await apiGet<any>("/api/assignments/");
      const list: Assignment[] = Array.isArray(data) ? data : data.results ?? [];
      setAssignments(list);
      const uniqueIds = [...new Set(list.map(a => a.classroom_id).filter(Boolean))] as number[];
      const counts: Record<number, number> = {};
      await Promise.all(uniqueIds.map(async (cid) => {
        try {
          const res = await apiGet<any>(`/api/students/?classroom_id=${cid}&page_size=1`);
          counts[cid] = res.count ?? (Array.isArray(res) ? res.length : 0);
        } catch {}
      }));
      setClassroomCounts(counts);
    } catch { toast.error("Failed to load assignments"); }
    finally { setLoading(false); }
  }

  async function loadAssignmentSubs(assignmentId: number) {
    if (assignmentSubs[assignmentId] !== undefined) return;
    setLoadingSubs(prev => new Set(prev).add(assignmentId));
    try {
      const subs = await apiGet<any>(`/api/assignments/${assignmentId}/submissions/`);
      setAssignmentSubs(prev => ({ ...prev, [assignmentId]: Array.isArray(subs) ? subs : [] }));
    } catch {
      setAssignmentSubs(prev => ({ ...prev, [assignmentId]: [] }));
    } finally {
      setLoadingSubs(prev => { const s = new Set(prev); s.delete(assignmentId); return s; });
    }
  }

  function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadAssignmentSubs(id);
  }

  async function loadAllSubmissions() {
    const result: Record<number, Submission[]> = {};
    await Promise.all(assignments.map(async (a) => {
      try {
        const subs = await apiGet<any>(`/api/assignments/${a.id}/submissions/`);
        result[a.id] = Array.isArray(subs) ? subs : [];
      } catch { result[a.id] = []; }
    }));
    setSubmissions(result);
  }

  async function loadStudents() {
    const classroomId = assignments.find(a => a.classroom_id)?.classroom_id;
    if (!classroomId) return;
    try {
      const data = await apiGet<any>(`/api/students/?classroom_id=${classroomId}&page_size=200`);
      setStudents(Array.isArray(data) ? data : data.results ?? []);
    } catch {}
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this assignment?")) return;
    try {
      await apiDelete(`/api/assignments/${id}/`);
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
    setOpenMenu(null);
  }

  const bySubject = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    const key = a.subject_name || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const allStudents = Array.from(
    new Map(Object.values(submissions).flat().map(s => [s.student_id, s])).values()
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Banner */}
      <div className="relative h-36 rounded-2xl mx-4 mt-2 overflow-hidden"
        style={{ backgroundColor: "#274c77" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="absolute bottom-4 left-6">
          <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">Assignments</p>
          <h1 className="text-white font-bold text-xl leading-tight">{teacherName}</h1>
          <p className="text-white/50 text-xs mt-0.5">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="bg-white border-b border-gray-200 mx-4 mt-3 rounded-t-xl flex overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap
              ${tab === key
                ? "border-[#274c77] text-[#274c77]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mx-4 bg-white rounded-b-xl border-x border-b border-gray-200 min-h-96">

        {/* STREAM */}
        {tab === "stream" && (
          <div className="p-5 flex gap-5 items-start">

            {/* Left: feed */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="border border-gray-200 rounded-xl p-3.5 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => router.push("/teacher/assignments/create")}>
                <Av name={teacherName} size={34} color="#274c77" />
                <span className="text-gray-400 text-sm">Announce something or create an assignment…</span>
              </div>

              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse h-16 bg-gray-50" />
                ))}</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No assignments yet</p>
                </div>
              ) : (
                [...assignments]
                  .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(a => (
                    <div key={a.id}
                      className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow group relative">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
                          style={{ backgroundColor: strColor(a.subject_name) }}
                          onClick={() => router.push(`/teacher/assignments/${a.id}`)}>
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => router.push(`/teacher/assignments/${a.id}`)}>
                          <p className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">{teacherName}</span>
                            {" "}posted · {format(new Date(a.created_at), "MMM d")}
                          </p>
                          <p className="font-medium text-gray-900 text-sm mt-0.5 truncate">{a.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: strColor(a.subject_name) + "20", color: strColor(a.subject_name) }}>
                              {a.subject_name}
                            </span>
                            {a.assignment_type === "Material" ? (
                              <span className="text-[11px] text-teal-600 font-medium">Material</span>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {a.submission_count} turned in
                                {a.classroom_id && classroomCounts[a.classroom_id] !== undefined
                                  ? ` / ${classroomCounts[a.classroom_id]} assigned` : ""}
                              </span>
                            )}
                            {!a.is_published && <span className="text-[11px] text-amber-600 font-medium">Draft</span>}
                          </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id); }}
                          className="p-1.5 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                        {openMenu === a.id && (
                          <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36">
                            <button onClick={() => { router.push(`/teacher/assignments/${a.id}`); setOpenMenu(null); }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full">
                              <Eye className="h-4 w-4" /> View
                            </button>
                            <button onClick={() => handleDelete(a.id)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  ))
              )}
            </div>

            {/* Right: quick actions */}
            <div className="w-60 flex-shrink-0 space-y-3">
              {/* Create */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">Quick Actions</p>
                {[
                  { label: "New Assignment", icon: ClipboardList, href: "/teacher/assignments/create", color: "#274c77" },
                  { label: "New Material",   icon: BookOpen,      href: "/teacher/assignments/material", color: "#0f766e" },
                  { label: "View Classwork", icon: List,          tab: "classwork", color: "#d97706" },
                  { label: "View Grades",    icon: BarChart2,     tab: "grades",    color: "#be123c" },
                ].map(({ label, icon: Icon, href, tab: t, color }) => (
                  <button key={label}
                    onClick={() => t ? setTab(t as Tab) : router.push(href!)}
                    className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color + "18" }}>
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    {label}
                  </button>
                ))}
              </div>

              {/* Summary stats */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Summary</p>
                {[
                  { label: "Total Assignments", value: assignments.filter(a => a.assignment_type !== "Material").length, color: "#274c77" },
                  { label: "Materials",          value: assignments.filter(a => a.assignment_type === "Material").length, color: "#0f766e" },
                  { label: "Pending Review",     value: assignments.reduce((n, a) => n + (a.assignment_type !== "Material" ? a.submission_count : 0), 0), color: "#d97706" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-sm font-semibold" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLASSWORK */}
        {tab === "classwork" && (
          <div className="p-5">
            <div className="flex justify-end mb-5 relative">
              <button onClick={() => setShowCreateMenu(v => !v)}
                className="flex items-center gap-2 bg-[#274c77] hover:bg-[#1e3a5f] text-white text-sm font-medium px-5 py-2 rounded-full shadow transition-colors">
                <Plus className="h-4 w-4" /> Create
              </button>
              {showCreateMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCreateMenu(false)} />
                  <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-52 overflow-hidden">
                    {[
                      { label: "Assignment",      icon: ClipboardList, href: "/teacher/assignments/create" },
                      { label: "Quiz Assignment", icon: FileText,      href: "/teacher/assignments/create?type=quiz" },
                      { label: "Material",        icon: BookOpen,      href: "/teacher/assignments/material" },
                    ].map(({ label, icon: Icon, href }) => (
                      <button key={label}
                        onClick={() => { setShowCreateMenu(false); if (href) router.push(href); }}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Icon className="h-4 w-4 text-gray-500" />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No assignments yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(bySubject).map(([subject, list]) => (
                  <div key={subject}>
                    <div className="flex items-center gap-3 pb-2 border-b border-gray-200 mb-1">
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: strColor(subject) }} />
                      <h3 className="font-medium text-gray-800 text-sm">{subject}</h3>
                      <span className="text-xs text-gray-400 ml-auto">{list.length} item{list.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {list.map(a => {
                        const subs = assignmentSubs[a.id];
                        const isLoading = loadingSubs.has(a.id);
                        const isMaterial = a.assignment_type === "Material";
                        const seen = subs ? subs.filter(s => s.status === "SEEN").length : 0;
                        const graded = subs ? subs.filter(s => s.grade !== null).length : 0;
                        const turnedIn = subs ? subs.filter(s => s.grade === null && s.status !== "SEEN").length : 0;
                        const total = a.classroom_id ? (classroomCounts[a.classroom_id] ?? 0) : 0;
                        const isExpanded = expandedId === a.id;
                        return (
                          <div key={a.id} className="group relative">
                            <div
                              className={`flex items-center gap-3 py-2.5 px-1 cursor-pointer rounded-lg transition-colors ${isExpanded ? "bg-gray-50" : "hover:bg-gray-50"}`}
                              onClick={() => toggleExpand(a.id)}>
                              <FileText className="h-4 w-4 text-[#274c77] flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                                <p className="text-xs text-gray-400">
                                  {isMaterial ? (
                                    <span className="text-teal-600 font-medium">Material</span>
                                  ) : (
                                    <>
                                      {a.due_date ? `Due ${format(new Date(a.due_date), "MMM d")}` : "No due date"}
                                      {" · "}{a.total_marks} marks
                                    </>
                                  )}
                                  {!a.is_published && <span className="text-amber-600 ml-1">Draft</span>}
                                </p>
                              </div>
                              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                                  className="p-1.5 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4 text-gray-500" />
                                </button>
                                {openMenu === a.id && (
                                  <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36">
                                    <button onClick={() => { router.push(`/teacher/assignments/${a.id}`); setOpenMenu(null); }}
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full">
                                      <Eye className="h-4 w-4" /> View
                                    </button>
                                    <button onClick={() => handleDelete(a.id)}
                                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                                      <Trash2 className="h-4 w-4" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Smooth slide-down using CSS grid rows trick */}
                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                              <div className="overflow-hidden min-h-0">
                                <div className="px-2 pb-4 pt-1 space-y-3">
                                  {a.description && (
                                    <div className="text-sm text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-2"
                                      dangerouslySetInnerHTML={{ __html: a.description }} />
                                  )}
                                  {!a.description && (
                                    <p className="text-xs text-gray-400 italic px-1">No description</p>
                                  )}

                                  {isLoading ? (
                                    <div className="grid grid-cols-3 divide-x divide-gray-200 border border-gray-200 rounded-xl overflow-hidden animate-pulse">
                                      {[0,1,2].map(i => <div key={i} className="flex flex-col items-center py-4 bg-gray-50 gap-1"><div className="h-6 w-8 bg-gray-200 rounded" /><div className="h-3 w-16 bg-gray-200 rounded" /></div>)}
                                    </div>
                                  ) : isMaterial ? (
                                    <div className="grid grid-cols-2 divide-x divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                                      {[
                                        { label: "Seen",     value: seen },
                                        { label: "Assigned", value: total > 0 ? total : "—" },
                                      ].map(({ label, value }) => (
                                        <div key={label} className="flex flex-col items-center py-3 bg-gray-50">
                                          <span className="text-xl font-bold text-[#274c77]">{value}</span>
                                          <span className="text-xs text-gray-500 mt-0.5">{label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-3 divide-x divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                                      {[
                                        { label: "Turned in", value: turnedIn },
                                        { label: "Assigned",  value: total > 0 ? total : "—" },
                                        { label: "Graded",    value: graded },
                                      ].map(({ label, value }) => (
                                        <div key={label} className="flex flex-col items-center py-3 bg-gray-50">
                                          <span className="text-xl font-bold text-[#274c77]">{value}</span>
                                          <span className="text-xs text-gray-500 mt-0.5">{label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between pt-0.5">
                                    <button
                                      onClick={() => router.push(`/teacher/assignments/${a.id}`)}
                                      className="text-sm text-[#274c77] hover:underline font-medium">
                                      View instructions
                                    </button>
                                    <button
                                      onClick={() => router.push(`/teacher/assignments/${a.id}`)}
                                      className="flex items-center gap-1 text-sm bg-[#274c77] text-white px-3 py-1.5 rounded-full hover:bg-[#1e3a5f] transition-colors">
                                      Review work <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEOPLE */}
        {tab === "people" && (
          <div className="p-5 max-w-xl">
            <div className="mb-6">
              <div className="border-b border-[#274c77] pb-2 mb-3">
                <h2 className="text-base font-medium text-[#274c77]">Teachers</h2>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Av name={teacherName} size={34} color="#274c77" />
                <span className="text-sm text-gray-800">{teacherName}</span>
              </div>
            </div>

            <div>
              <div className="border-b border-[#274c77] pb-2 mb-3 flex items-center justify-between">
                <h2 className="text-base font-medium text-[#274c77]">Students</h2>
                {students.length > 0 && <span className="text-xs text-gray-400">{students.length} students</span>}
              </div>
              {students.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  Students appear when an assignment is linked to a classroom.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5">
                      <Av name={s.full_name} size={30} />
                      <span className="text-sm text-gray-800">{s.full_name}</span>
                      {s.gr_number && <span className="text-xs text-gray-400 ml-auto">{s.gr_number}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GRADES */}
        {tab === "grades" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : assignments.filter(a => a.assignment_type !== "Material").length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No gradable assignments yet.</div>
            ) : (
              <table className="w-full text-sm border-collapse" style={{ minWidth: 500 }}>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-44 sticky left-0 bg-gray-50">
                      Student
                    </th>
                    {assignments.filter(a => a.assignment_type !== "Material").map(a => (
                      <th key={a.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 min-w-[110px]"
                        style={{ cursor: "pointer" }}
                        onClick={() => router.push(`/teacher/assignments/${a.id}`)}>
                        <div className="truncate max-w-[110px] mx-auto">{a.title}</div>
                        <div className="text-[10px] text-gray-400 font-normal">/{a.total_marks}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allStudents.length === 0 ? (
                    <tr>
                      <td colSpan={assignments.filter(a => a.assignment_type !== "Material").length + 1} className="text-center py-10 text-gray-400 text-xs">
                        No submissions yet.
                      </td>
                    </tr>
                  ) : allStudents.map(student => (
                    <tr key={student.student_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <Av name={student.student_name} size={26} />
                          <span className="text-xs text-gray-800 truncate max-w-[110px]">{student.student_name}</span>
                        </div>
                      </td>
                      {assignments.filter(a => a.assignment_type !== "Material").map(a => {
                        const sub = (submissions[a.id] || []).find(s => s.student_id === student.student_id);
                        return (
                          <td key={a.id} className="px-3 py-3 text-center">
                            {sub ? (
                              sub.grade !== null
                                ? <span className="text-[#0f766e] font-semibold">{sub.grade}</span>
                                : <span className="text-gray-400 text-xs">Submitted</span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {openMenu !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
