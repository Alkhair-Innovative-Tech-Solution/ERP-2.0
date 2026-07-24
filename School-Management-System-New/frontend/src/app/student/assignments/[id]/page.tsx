"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Upload, FileText, Clock, CheckCircle2,
  Star, BookOpen, Eye, Trophy, AlertCircle, Paperclip, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost, apiPostFormData } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

interface Submission {
  id: number; status: string; grade: number | null; feedback: string | null;
  submitted_at: string; submitted_file_url: string | null; submission_text: string | null;
  percentage: number | null;
}
interface Assignment {
  id: number; title: string; description: string | null; instructions: string | null;
  subject_name: string; total_marks: number; due_date: string | null;
  assignment_type: string; classroom_label: string | null;
  attachment_url: string | null; quiz_form_url: string | null; my_submission: Submission | null;
}

export default function StudentAssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await apiGet<Assignment>(`/api/assignments/${id}/`);
        setAssignment(a);
        if (a.assignment_type === "Material" && !a.my_submission) {
          try { await apiPost(`/api/assignments/${id}/seen/`, {}); } catch {}
        }
      } catch { toast.error("Assignment not found"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) { toast.error("Add text or a file"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (text) fd.append("submission_text", text);
      if (file) fd.append("submitted_file", file);
      await apiPostFormData(`/api/assignments/${id}/submit/`, fd);
      toast.success("Assignment submitted!");
      const updated = await apiGet<Assignment>(`/api/assignments/${id}/`);
      setAssignment(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Submission failed");
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
  if (!assignment) return null;

  const sub = assignment.my_submission;
  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
  const isMaterial = assignment.assignment_type === "Material";
  const isGraded = sub?.status === "GRADED";
  const isQuiz = assignment.assignment_type === "Quiz";

  const percentage = isGraded && sub?.grade != null
    ? Math.round((sub.grade / assignment.total_marks) * 100)
    : null;

  const scoreColor = percentage == null ? "" : percentage >= 80 ? "text-emerald-600" : percentage >= 60 ? "text-amber-600" : "text-red-600";
  const scoreBg = percentage == null ? "" : percentage >= 80 ? "bg-emerald-50 border-emerald-200" : percentage >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Back button + header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Assignments
        </button>

        <div className="bg-gradient-to-br from-[#013a63] to-[#01527a] rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              {isMaterial ? <Eye className="h-5 w-5" /> : isQuiz ? <FileText className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-lg font-bold leading-tight">{assignment.title}</h1>
                {isMaterial && <Badge className="bg-teal-400/20 text-teal-100 border-0 text-[10px]">Material</Badge>}
                {isQuiz && <Badge className="bg-purple-400/20 text-purple-100 border-0 text-[10px]">Quiz</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-blue-200">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {assignment.subject_name}
                </span>
                {!isMaterial && <span className="font-semibold text-white">{assignment.total_marks} marks</span>}
                {assignment.classroom_label && <span>{assignment.classroom_label}</span>}
              </div>
              {assignment.due_date && !isMaterial && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs ${isOverdue && !sub ? "text-red-300" : "text-blue-200"}`}>
                  <Clock className="h-3 w-3" />
                  Due {format(new Date(assignment.due_date), "dd MMM yyyy, hh:mm a")}
                  {isOverdue && !sub && <AlertCircle className="h-3 w-3 ml-1" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Form */}
      {isQuiz && assignment.quiz_form_url && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-violet-800">Quiz Form</p>
            <p className="text-xs text-violet-500 mt-0.5">
              {sub ? "You have submitted this quiz" : "Complete the quiz on Google Forms"}
            </p>
          </div>
          <button
            onClick={async () => {
              window.open(assignment.quiz_form_url!, "_blank");
              if (!sub) {
                try {
                  const fd = new FormData();
                  fd.append("submission_text", "Submitted via Google Forms");
                  await apiPostFormData(`/api/assignments/${id}/submit/`, fd);
                  const updated = await apiGet<Assignment>(`/api/assignments/${id}/`);
                  setAssignment(updated);
                } catch {}
              }
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex-shrink-0"
          >
            {sub ? "Open Again" : "Open Quiz"}
          </button>
        </div>
      )}

      {/* Description / Instructions / Attachment */}
      {(assignment.description || assignment.instructions || assignment.attachment_url) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
          {assignment.description && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
              <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: assignment.description }} />
            </div>
          )}
          {assignment.instructions && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Instructions</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{assignment.instructions}</p>
            </div>
          )}
          {assignment.attachment_url && (
            <a
              href={assignment.attachment_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2.5 text-sm text-[#013a63] font-medium hover:bg-blue-50 px-3 py-2.5 rounded-xl transition-colors border border-blue-100"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-[#013a63]" />
              </div>
              Download Assignment File
            </a>
          )}
        </div>
      )}

      {/* Graded Result */}
      {isGraded && !isMaterial && (
        <div className={`border rounded-2xl p-5 ${scoreBg}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
              <Trophy className={`h-6 w-6 ${scoreColor}`} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">Assignment Graded</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Submitted {format(new Date(sub!.submitted_at), "dd MMM yyyy")}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-extrabold ${scoreColor}`}>{sub?.grade}</p>
              <p className="text-xs text-gray-400">out of {assignment.total_marks}</p>
              {percentage != null && (
                <p className={`text-sm font-bold ${scoreColor}`}>{percentage}%</p>
              )}
            </div>
          </div>

          {/* Score bar */}
          {percentage != null && (
            <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all ${percentage >= 80 ? "bg-emerald-500" : percentage >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}

          {sub?.feedback && (
            <div className="bg-white/80 rounded-xl p-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Teacher Feedback</p>
              <p className="text-sm text-gray-700 leading-relaxed">{sub.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Submitted (awaiting grade) */}
      {sub && !isGraded && sub.status !== "SEEN" && !isMaterial && (
        <div className={`border rounded-2xl p-5 ${isQuiz ? "bg-violet-50 border-violet-200" : "bg-cyan-50 border-cyan-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isQuiz ? "bg-violet-100" : "bg-cyan-100"}`}>
              <CheckCircle2 className={`h-5 w-5 ${isQuiz ? "text-violet-600" : "text-cyan-600"}`} />
            </div>
            <div>
              <p className={`font-semibold ${isQuiz ? "text-violet-800" : "text-cyan-800"}`}>
                {isQuiz ? "Quiz Submitted via Google Forms" : "Assignment Submitted"}
              </p>
              <p className={`text-xs mt-0.5 ${isQuiz ? "text-violet-500" : "text-cyan-500"}`}>
                {format(new Date(sub.submitted_at), "dd MMM yyyy, hh:mm a")}
              </p>
            </div>
            <Badge className={`ml-auto border-0 ${isQuiz ? "bg-violet-100 text-violet-700" : "bg-cyan-100 text-cyan-700"}`}>
              Awaiting Grade
            </Badge>
          </div>
          {!isQuiz && sub.submission_text && (
            <div className="mt-3 bg-white rounded-xl p-3.5 text-sm text-gray-700 leading-relaxed border border-cyan-100">
              {sub.submission_text}
            </div>
          )}
          {!isQuiz && sub.submitted_file_url && (
            <a
              href={sub.submitted_file_url} target="_blank" rel="noreferrer"
              className="mt-3 flex items-center gap-2 text-sm text-cyan-700 font-medium hover:underline"
            >
              <FileText className="h-4 w-4" /> View submitted file
            </a>
          )}
        </div>
      )}

      {/* Material: Seen */}
      {isMaterial && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Eye className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-teal-800">Marked as Seen</p>
            <p className="text-xs text-teal-500 mt-0.5">Reading material — no submission required</p>
          </div>
          <Badge className="ml-auto bg-teal-100 text-teal-700 border-0">Material</Badge>
        </div>
      )}

      {/* Submit Form — not for Material or Quiz */}
      {!isMaterial && !isQuiz && !sub && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-[#013a63] mb-4 flex items-center gap-2">
            <div className="w-7 h-7 bg-[#013a63] rounded-lg flex items-center justify-center">
              <Upload className="h-3.5 w-3.5 text-white" />
            </div>
            Submit Assignment
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Your Answer / Notes</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your answer here..."
                rows={5}
                className="resize-none border-gray-200 focus:border-[#013a63] focus:ring-[#013a63]/10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Attach File <span className="text-gray-400 font-normal">(optional)</span></label>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <Paperclip className="h-4 w-4 text-[#013a63] flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-400 hover:border-[#013a63] hover:text-[#013a63] transition-colors flex flex-col items-center gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Click to upload file
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#013a63] hover:bg-[#012d4e] w-full h-11 rounded-xl font-semibold text-sm"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Submit Assignment
                </span>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
