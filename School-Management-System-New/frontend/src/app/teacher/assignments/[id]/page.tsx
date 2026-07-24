"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Clock, Download, FileText, User, Users, CheckCircle2, Circle, Eye, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

interface Submission {
  id: number; student_id: number; student_name: string;
  submission_text: string | null; submitted_file_url: string | null;
  grade: number | null; feedback: string | null; status: string;
  submitted_at: string; percentage: number | null;
}
interface Assignment {
  id: number; title: string; subject_name: string; total_marks: number;
  due_date: string | null; description: string | null; instructions: string | null;
  assignment_type: string; classroom_label: string | null; classroom_id: number | null;
  submission_count: number; attachment_url: string | null; quiz_form_url: string | null; quiz_responses_url: string | null;
}

export default function TeacherAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState<number | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<number, { grade: string; feedback: string }>>({});
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"instructions" | "work">("work");
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      const [a, subs] = await Promise.all([
        apiGet<Assignment>(`/api/assignments/${id}/`),
        apiGet<Submission[]>(`/api/assignments/${id}/submissions/`),
      ]);
      setAssignment(a);
      const subList = Array.isArray(subs) ? subs : [];
      setSubmissions(subList);
      const inputs: Record<number, { grade: string; feedback: string }> = {};
      subList.forEach((s: Submission) => {
        inputs[s.id] = { grade: String(s.grade ?? ""), feedback: s.feedback ?? "" };
      });
      setGradeInputs(inputs);
      if (selectedSub) {
        const refreshed = subList.find(s => s.id === selectedSub.id);
        if (refreshed) setSelectedSub(refreshed);
      }
      if (a.classroom_id) {
        try {
          const res = await apiGet<any>(`/api/students/?classroom_id=${a.classroom_id}&page_size=1`);
          setAssignedCount(res.count ?? (Array.isArray(res) ? res.length : null));
        } catch {}
      }
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }

  async function handleGrade(subId: number) {
    const inp = gradeInputs[subId];
    if (!inp?.grade) { toast.error("Enter a grade"); return; }
    setGrading(subId);
    try {
      await apiPatch(`/api/assignments/${id}/submissions/${subId}/grade/`, {
        grade: Number(inp.grade), feedback: inp.feedback, status: "GRADED",
      });
      toast.success("Graded");
      loadData();
    } catch { toast.error("Failed to grade"); }
    finally { setGrading(null); }
  }

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );
  if (!assignment) return null;

  const isMaterial = assignment.assignment_type === "Material";
  const turnedIn = submissions.filter(s => s.status !== "SEEN" && s.grade === null);
  const graded = submissions.filter(s => s.grade !== null);
  const seenList = submissions.filter(s => s.status === "SEEN");

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-[#013a63] truncate">{assignment.title}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span>{assignment.subject_name}</span>
            {assignment.classroom_label && <span>· {assignment.classroom_label}</span>}
            {!isMaterial && <span>· {assignment.total_marks} marks</span>}
            {assignment.due_date && (
              <span className="flex items-center gap-1">
                · <Clock className="h-3 w-3" /> Due {format(new Date(assignment.due_date), "dd MMM yyyy")}
              </span>
            )}
          </div>
        </div>

        {/* Edit button */}
        <button
          onClick={() => router.push(`/teacher/assignments/${id}/edit`)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#013a63] hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>

        {/* Tab switcher */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          <button
            onClick={() => setActiveTab("instructions")}
            className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "instructions" ? "bg-[#013a63] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Instructions
          </button>
          <button
            onClick={() => setActiveTab("work")}
            className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "work" ? "bg-[#013a63] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {isMaterial ? "Seen" : "Student work"}
          </button>
        </div>
      </div>

      {/* Instructions Tab */}
      {activeTab === "instructions" && (
        <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">
          <div className="space-y-4">
            {assignment.assignment_type === "Quiz" && assignment.quiz_form_url && (
              <div className="bg-[#673ab7]/5 border border-[#673ab7]/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#673ab7] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#673ab7] text-sm">Quiz Form</p>
                  <p className="text-xs text-gray-400 truncate">{assignment.quiz_form_url}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <a href={assignment.quiz_form_url} target="_blank" rel="noreferrer"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    Student Link
                  </a>
                  {assignment.quiz_responses_url && (
                    <a href={assignment.quiz_responses_url + '#responses'} target="_blank" rel="noreferrer"
                      className="bg-[#673ab7] hover:bg-[#5e35b1] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Responses
                    </a>
                  )}
                </div>
              </div>
            )}
            {assignment.description && (
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-gray-700">
                <p className="font-semibold text-[#013a63] mb-2">Description</p>
                <div dangerouslySetInnerHTML={{ __html: assignment.description }} />
              </div>
            )}
            {assignment.instructions && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-700 mb-2">Instructions</p>
                <p className="whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
            {assignment.attachment_url && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Attachment</p>
                {/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(assignment.attachment_url) ? (
                  <a href={assignment.attachment_url} target="_blank" rel="noreferrer">
                    <img src={assignment.attachment_url} alt="attachment"
                      className="max-h-64 rounded-lg border border-gray-200 object-contain cursor-pointer hover:opacity-90 transition-opacity" />
                  </a>
                ) : (
                  <a href={assignment.attachment_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-[#274c77] hover:underline">
                    <Download className="h-4 w-4" /> Download attachment
                  </a>
                )}
              </div>
            )}
            {!assignment.description && !assignment.instructions && !assignment.attachment_url && !assignment.quiz_form_url && (
              <div className="text-center py-16 text-gray-400">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No instructions added</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Work / Seen Tab */}
      {activeTab === "work" && (
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel — student list */}
          <div className="w-64 border-r border-gray-200 flex flex-col bg-white overflow-y-auto flex-shrink-0">
            {/* Stats */}
            {isMaterial ? (
              <div className="grid grid-cols-2 border-b border-gray-200">
                {[
                  { label: "Seen", value: seenList.length },
                  { label: "Assigned", value: assignedCount ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center py-3 text-center border-r last:border-r-0 border-gray-200">
                    <span className="text-xl font-bold text-[#013a63]">{value}</span>
                    <span className="text-[11px] text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 border-b border-gray-200">
                {[
                  { label: "Turned in", value: turnedIn.length },
                  { label: "Assigned", value: assignedCount ?? "—" },
                  { label: "Graded", value: graded.length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center py-3 text-center border-r last:border-r-0 border-gray-200">
                    <span className="text-lg font-bold text-[#013a63]">{value}</span>
                    <span className="text-[10px] text-gray-500 leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Student sections */}
            {isMaterial ? (
              <div className="flex-1">
                <SectionHeader label="Seen" count={seenList.length} />
                {seenList.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-3">No students yet</p>
                ) : seenList.map(sub => (
                  <StudentRow key={sub.id} sub={sub} selected={selectedSub?.id === sub.id}
                    onClick={() => setSelectedSub(sub)} isMaterial />
                ))}
              </div>
            ) : (
              <div className="flex-1">
                {turnedIn.length > 0 && (
                  <>
                    <SectionHeader label="Turned in" count={turnedIn.length} />
                    {turnedIn.map(sub => (
                      <StudentRow key={sub.id} sub={sub} selected={selectedSub?.id === sub.id}
                        onClick={() => setSelectedSub(sub)}
                        grade={gradeInputs[sub.id]?.grade}
                        totalMarks={assignment.total_marks} />
                    ))}
                  </>
                )}
                {graded.length > 0 && (
                  <>
                    <SectionHeader label="Graded" count={graded.length} />
                    {graded.map(sub => (
                      <StudentRow key={sub.id} sub={sub} selected={selectedSub?.id === sub.id}
                        onClick={() => setSelectedSub(sub)}
                        grade={gradeInputs[sub.id]?.grade}
                        totalMarks={assignment.total_marks} />
                    ))}
                  </>
                )}
                {submissions.length === 0 && (
                  <p className="text-xs text-gray-400 px-4 py-3">No submissions yet</p>
                )}
              </div>
            )}
          </div>

          {/* Right panel — submission detail */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {!selectedSub ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Users className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Select a student to view their work</p>
              </div>
            ) : (
              <div className="p-6 space-y-4 max-w-xl">
                {/* Student header */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#013a63] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {(selectedSub.student_name || "S")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[#013a63] text-sm">
                      {selectedSub.student_name || `Student #${selectedSub.student_id}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isMaterial
                        ? `Seen ${format(new Date(selectedSub.submitted_at), "dd MMM yyyy, hh:mm a")}`
                        : `Submitted ${format(new Date(selectedSub.submitted_at), "dd MMM yyyy, hh:mm a")}`
                      }
                    </p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${statusColor(selectedSub.status)}`}>
                    {selectedSub.status}
                  </span>
                </div>

                {/* Submission content — Quiz shows Google Forms response link */}
                {assignment.assignment_type === "Quiz" && assignment.quiz_form_url ? (
                  <div className="bg-[#673ab7]/5 border border-[#673ab7]/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#673ab7] flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#673ab7]">Submitted via Google Forms</p>
                        <p className="text-xs text-gray-500">View individual response on Google Forms</p>
                      </div>
                    </div>
                    {assignment.quiz_responses_url ? (
                      <a
                        href={assignment.quiz_responses_url + '#responses'}
                        target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#673ab7] hover:bg-[#5e35b1] text-white text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                        </svg>
                        View Responses on Google Forms
                      </a>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5 text-center">
                        No responses link saved. Edit assignment to add the form edit URL.
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 text-center">Check the Responses tab, then enter the grade below.</p>
                  </div>
                ) : (
                  <>
                    {selectedSub.submission_text && (
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Answer</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedSub.submission_text}</p>
                      </div>
                    )}
                    {selectedSub.submitted_file_url && (
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Submitted File</p>
                        {/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(selectedSub.submitted_file_url) ? (
                          <a href={selectedSub.submitted_file_url} target="_blank" rel="noreferrer">
                            <img src={selectedSub.submitted_file_url} alt="submission"
                              className="max-h-64 rounded-lg border border-gray-200 object-contain cursor-pointer hover:opacity-90" />
                          </a>
                        ) : (
                          <a href={selectedSub.submitted_file_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm text-[#274c77] hover:underline">
                            <Download className="h-4 w-4" /> Download file
                          </a>
                        )}
                      </div>
                    )}
                    {!selectedSub.submission_text && !selectedSub.submitted_file_url && !isMaterial && (
                      <div className="bg-white border border-gray-200 rounded-xl p-4 text-center text-gray-400">
                        <FileText className="h-6 w-6 mx-auto mb-1 opacity-40" />
                        <p className="text-xs">No content submitted</p>
                      </div>
                    )}
                  </>
                )}

                {/* Grading panel (non-material) */}
                {!isMaterial && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Grade</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={assignment.total_marks}
                        value={gradeInputs[selectedSub.id]?.grade ?? ""}
                        onChange={(e) => setGradeInputs(prev => ({
                          ...prev,
                          [selectedSub.id]: { ...prev[selectedSub.id], grade: e.target.value }
                        }))}
                        className="h-9 text-sm w-24"
                        placeholder="Marks"
                      />
                      <span className="text-sm text-gray-500">/ {assignment.total_marks}</span>
                      {selectedSub.percentage != null && (
                        <span className="text-xs text-gray-400 ml-1">({selectedSub.percentage}%)</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Feedback (optional)</label>
                      <Input
                        value={gradeInputs[selectedSub.id]?.feedback ?? ""}
                        onChange={(e) => setGradeInputs(prev => ({
                          ...prev,
                          [selectedSub.id]: { ...prev[selectedSub.id], feedback: e.target.value }
                        }))}
                        className="h-9 text-sm"
                        placeholder="Add feedback..."
                      />
                    </div>
                    <Button
                      onClick={() => handleGrade(selectedSub.id)}
                      disabled={grading === selectedSub.id}
                      className="w-full bg-[#013a63] hover:bg-[#012d4e] h-9"
                    >
                      {grading === selectedSub.id
                        ? "Saving..."
                        : selectedSub.grade !== null ? "Update Grade" : "Save Grade"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-y border-gray-100">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label} · {count}
      </span>
    </div>
  );
}

function StudentRow({
  sub, selected, onClick, isMaterial, grade, totalMarks
}: {
  sub: Submission; selected: boolean; onClick: () => void;
  isMaterial?: boolean; grade?: string; totalMarks?: number;
}) {
  const isGraded = sub.grade !== null;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 border-b border-gray-100 ${selected ? "bg-blue-50 border-l-2 border-l-[#013a63]" : ""}`}
    >
      <div className="w-7 h-7 rounded-full bg-[#013a63] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {(sub.student_name || "S")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">
          {sub.student_name || `Student #${sub.student_id}`}
        </p>
        {isMaterial ? (
          <p className="text-[11px] text-teal-600">Seen</p>
        ) : isGraded ? (
          <p className="text-[11px] text-green-600 font-medium">{sub.grade}/{totalMarks}</p>
        ) : (
          <p className="text-[11px] text-blue-600">Turned in</p>
        )}
      </div>
      {isGraded && !isMaterial && (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      )}
      {isMaterial && (
        <Eye className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />
      )}
    </button>
  );
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: "bg-blue-50 text-blue-700",
    GRADED: "bg-green-50 text-green-700",
    LATE: "bg-orange-50 text-orange-700",
    RETURNED: "bg-gray-100 text-gray-700",
    SEEN: "bg-teal-50 text-teal-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}
