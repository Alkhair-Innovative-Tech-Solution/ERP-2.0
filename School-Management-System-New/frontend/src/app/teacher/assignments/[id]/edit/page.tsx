"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  X, ClipboardList, Bold, Italic, Underline, List, RemoveFormatting,
  Upload, Link, Paperclip, ExternalLink, Trash2, ChevronDown, Users, Check, Calendar, Loader2
} from "lucide-react";
import { apiGet, apiPatchFormData } from "@/lib/api";
import { toast } from "sonner";

interface ClassroomOption { id: number; label: string; code: string; }
interface SubjectOption   { id: number; name: string; }
interface Student         { id: number; full_name: string; }
interface AttachedFile    { type: "file" | "link"; name: string; file?: File; url?: string; }

interface AssignmentData {
  id: number; title: string; description: string | null; instructions: string | null;
  assignment_type: string; total_marks: number; due_date: string | null;
  classroom_id: number | null; classroom_label: string | null; classroom_code: string | null;
  subject: number; attachment_url: string | null;
  quiz_form_url: string | null; quiz_responses_url: string | null;
}

export default function EditAssignmentPage() {
  const router = useRouter();
  const { id } = useParams();
  const instrRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [title, setTitle] = useState("");
  const [assignmentType, setAssignmentType] = useState("Individual");
  const [points, setPoints] = useState("100");
  const [dueDate, setDueDate] = useState("");
  const [quizFormUrl, setQuizFormUrl] = useState("");
  const [quizResponsesUrl, setQuizResponsesUrl] = useState("");
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, classData] = await Promise.all([
          apiGet<AssignmentData>(`/api/assignments/${id}/`),
          apiGet<any>("/api/subjects/my-classrooms/"),
        ]);

        // Populate classrooms + subjects
        const list = Array.isArray(classData) ? classData : (classData.results ?? []);
        const clsSeen = new Map<number, ClassroomOption>();
        list.forEach((item: any) => {
          if (item.classroom_id && !clsSeen.has(item.classroom_id))
            clsSeen.set(item.classroom_id, { id: item.classroom_id, label: item.classroom_label ?? String(item.classroom_id), code: item.classroom_code ?? "" });
        });
        const cls = Array.from(clsSeen.values());
        setClassrooms(cls);
        const subSeen = new Map<number, string>();
        list.forEach((item: any) => { if (!subSeen.has(item.subject)) subSeen.set(item.subject, item.subject_name); });
        setSubjects(Array.from(subSeen.entries()).map(([id, name]) => ({ id, name })));

        // Fill form fields from existing assignment
        setTitle(a.title);
        setAssignmentType(a.assignment_type);
        setPoints(String(a.total_marks));
        if (a.due_date) setDueDate(a.due_date.slice(0, 16)); // datetime-local format
        setQuizFormUrl(a.quiz_form_url ?? "");
        setQuizResponsesUrl(a.quiz_responses_url ?? "");
        setExistingAttachmentUrl(a.attachment_url);
        if (a.classroom_id) setSelectedClassroom(a.classroom_id);
        if (a.subject) setSelectedSubject(String(a.subject));

        // Set instructions HTML
        if (instrRef.current && a.description) {
          instrRef.current.innerHTML = a.description;
        }

        // Load students for selected classroom
        if (a.classroom_id) loadStudents(a.classroom_id);
      } catch { toast.error("Failed to load assignment"); router.back(); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Set instructions HTML after ref is ready
  useEffect(() => {
    if (!loading && instrRef.current) {
      // already set in the load function, but instrRef might not be ready; this is a fallback
    }
  }, [loading]);

  async function loadStudents(classroomId: number | null) {
    if (!classroomId) return;
    setLoadingStudents(true);
    try {
      const data = await apiGet<any>(`/api/students/?classroom=${classroomId}&page_size=200`);
      const list: Student[] = Array.isArray(data) ? data : (data.results ?? []);
      setStudents(list);
      setSelectedStudents(new Set(list.map(s => s.id)));
    } catch { setStudents([]); }
    finally { setLoadingStudents(false); }
  }

  function execCmd(cmd: string) {
    document.execCommand(cmd, false, undefined);
    instrRef.current?.focus();
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", instrRef.current?.innerHTML || "");
      fd.append("assignment_type", assignmentType);
      fd.append("total_marks", points || "0");
      if (selectedSubject) fd.append("subject", selectedSubject);
      const cls = classrooms.find(c => c.id === selectedClassroom);
      if (cls) {
        fd.append("classroom_id", String(cls.id));
        fd.append("classroom_label", cls.label);
        if (cls.code) fd.append("classroom_code", cls.code);
      }
      if (dueDate) fd.append("due_date", new Date(dueDate).toISOString());
      if (quizFormUrl.trim()) fd.append("quiz_form_url", quizFormUrl.trim());
      if (quizResponsesUrl.trim()) fd.append("quiz_responses_url", quizResponsesUrl.trim());
      if (newFile) fd.append("attachment", newFile);

      await apiPatchFormData(`/api/assignments/${id}/`, fd);
      toast.success("Assignment updated");
      router.push(`/teacher/assignments/${id}`);
    } catch { toast.error("Failed to update assignment"); }
    finally { setPosting(false); }
  }

  const allSelected = students.length > 0 && selectedStudents.size === students.length;
  const someSelected = selectedStudents.size > 0 && selectedStudents.size < students.length;
  const isQuiz = assignmentType === "Quiz";

  if (loading) return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <X className="h-5 w-5 text-gray-600" />
        </button>
        <div className="w-8 h-8 bg-[#274c77] rounded flex items-center justify-center flex-shrink-0">
          <ClipboardList className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-gray-800 flex-1">Edit Assignment</span>
        <button
          onClick={handleSave}
          disabled={posting || !title.trim()}
          className="bg-[#274c77] hover:bg-[#1e3a5f] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-5 py-1.5 rounded-full transition-colors flex items-center gap-2">
          {posting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save"}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-5 items-start">

        {/* Left: content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Title + Instructions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="border-b-2 border-[#274c77] mx-4 mt-4 mb-1">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title*"
                className="w-full pb-1.5 text-base outline-none placeholder-gray-400 text-gray-800"
              />
            </div>
            {!title && <p className="text-[11px] text-gray-400 px-4 mb-3">*Required</p>}

            <div className="px-4 pb-2">
              <div
                ref={instrRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[120px] py-2 text-sm text-gray-700 outline-none empty:before:content-['Instructions_(optional)'] empty:before:text-gray-400"
              />
            </div>

            <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1">
              {[
                { icon: Bold, cmd: "bold" }, { icon: Italic, cmd: "italic" },
                { icon: Underline, cmd: "underline" }, { icon: List, cmd: "insertUnorderedList" },
                { icon: RemoveFormatting, cmd: "removeFormat" },
              ].map(({ icon: Icon, cmd }) => (
                <button key={cmd} onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Quiz URLs */}
          {isQuiz && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded bg-[#673ab7] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#673ab7]">Google Form Quiz</p>
                  <p className="text-xs text-gray-400">Google Forms</p>
                </div>
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#673ab7] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-xs font-semibold text-gray-700">Student link <span className="text-gray-400 font-normal">(Send → Link tab → Copy)</span></p>
                  </div>
                  <input value={quizFormUrl} onChange={e => setQuizFormUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#673ab7]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#673ab7] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-xs font-semibold text-gray-700">Responses link <span className="text-gray-400 font-normal">(copy from browser while editing form)</span></p>
                  </div>
                  <input value={quizResponsesUrl} onChange={e => setQuizResponsesUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/.../edit"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#673ab7]" />
                </div>
              </div>
            </div>
          )}

          {/* Attachment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Attachment</p>

            {existingAttachmentUrl && !newFile && !removeAttachment && (
              <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                <ExternalLink className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate flex-1">Current attachment</span>
                <a href={existingAttachmentUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline flex-shrink-0">View</a>
                <button onClick={() => setRemoveAttachment(true)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {newFile && (
              <div className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate flex-1">{newFile.name}</span>
                <button onClick={() => setNewFile(null)}
                  className="p-1 rounded hover:bg-blue-100 text-gray-400 flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex gap-6 justify-center py-2">
              <button onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1.5 group">
                <div className="w-12 h-12 rounded-full border-2 border-gray-300 group-hover:border-blue-400 flex items-center justify-center transition-colors">
                  <Upload className="h-5 w-5 text-gray-500 group-hover:text-blue-500" />
                </div>
                <span className="text-xs text-gray-500">{newFile ? "Replace" : "Upload"}</span>
              </button>
            </div>
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => { setNewFile(e.target.files?.[0] ?? null); setRemoveAttachment(false); e.target.value = ""; }} />
          </div>
        </div>

        {/* Right: settings */}
        <div className="w-64 flex-shrink-0 space-y-3">

          {/* For + Subject */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">For</p>
              <div className="relative">
                <select value={selectedClassroom ?? ""} onChange={e => { const cid = Number(e.target.value); setSelectedClassroom(cid); loadStudents(cid); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 outline-none focus:border-blue-400">
                  {classrooms.length === 0 && <option value="">No classes</option>}
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subject</p>
              <div className="relative">
                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 outline-none focus:border-blue-400">
                  {subjects.length === 0 && <option value="">No subjects</option>}
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Assign to */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assign to</p>
            <button onClick={() => setShowStudentModal(true)}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Users className="h-4 w-4 text-blue-500" />
              {allSelected ? "All students" : selectedStudents.size === 0 ? "No students" : `${selectedStudents.size} student${selectedStudents.size !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* Points */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Points</p>
            <input type="number" min={0} value={points} onChange={e => setPoints(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>

          {/* Due date */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Due</p>
            <div className="relative">
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400 pr-8" />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {dueDate && (
              <button onClick={() => setDueDate("")} className="text-xs text-gray-400 hover:text-gray-600 mt-1.5">
                Remove due date
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Student picker modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowStudentModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[70vh] flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="font-medium text-gray-800 text-base">Assign to</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <button onClick={() => allSelected ? setSelectedStudents(new Set()) : setSelectedStudents(new Set(students.map(s => s.id)))}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allSelected ? "bg-blue-500 border-blue-500" : someSelected ? "bg-blue-200 border-blue-400" : "border-gray-300"}`}>
                  {(allSelected || someSelected) && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm font-medium text-gray-800">All students</span>
              </button>
              <div className="h-px bg-gray-100 mx-4 mb-1" />
              {loadingStudents && <p className="text-xs text-gray-400 px-5 py-3">Loading…</p>}
              {!loadingStudents && students.length === 0 && <p className="text-xs text-gray-400 px-5 py-3">No students</p>}
              {students.map(s => (
                <button key={s.id} onClick={() => setSelectedStudents(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedStudents.has(s.id) ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                    {selectedStudents.has(s.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-700">{(s.full_name || "?").charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-gray-700 text-left truncate">{s.full_name}</span>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowStudentModal(false)}
                className="bg-[#274c77] text-white text-sm px-6 py-2 rounded-full hover:bg-[#1e3a5f] transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
