"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X, BookOpen, Bold, Italic, Underline, List, RemoveFormatting,
  Upload, Link, Paperclip, ExternalLink, Trash2, Users, ChevronDown, Check
} from "lucide-react";
import { apiGet, apiPostFormData } from "@/lib/api";
import { toast } from "sonner";

interface AttachedFile {
  type: "file" | "link";
  name: string;
  file?: File;
  url?: string;
}

interface Assignment {
  id: number;
  subject: number;
  subject_name: string;
  classroom_id: number | null;
  classroom_label: string | null;
}

interface ClassroomOption {
  id: number;
  label: string;
  code: string;
}

interface SubjectOption {
  id: number;
  name: string;
}

interface Student {
  id: number;
  full_name: string;
}

export default function MaterialPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkBox, setShowLinkBox] = useState(false);
  const [posting, setPosting] = useState(false);

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
        const data = await apiGet<any>("/api/subjects/my-classrooms/");
        const list: Assignment[] = Array.isArray(data) ? data : (data.results ?? []);

        // Unique classrooms preserving order
        const clsSeen = new Map<number, ClassroomOption>();
        list.forEach(a => {
          if (a.classroom_id && !clsSeen.has(a.classroom_id))
            clsSeen.set(a.classroom_id, {
              id: a.classroom_id,
              label: a.classroom_label ?? String(a.classroom_id),
              code: (a as any).classroom_code ?? "",
            });
        });
        const cls = Array.from(clsSeen.values());
        setClassrooms(cls);

        // Unique subjects preserving order
        const subSeen = new Map<number, string>();
        list.forEach(a => {
          if (!subSeen.has(a.subject))
            subSeen.set(a.subject, a.subject_name);
        });
        const subs = Array.from(subSeen.entries()).map(([id, name]) => ({ id, name }));
        setSubjects(subs);

        if (subs.length > 0) setSelectedSubject(String(subs[0].id));
        if (cls.length > 0) {
          setSelectedClassroom(cls[0].id);
          await loadStudents(cls[0].id);
        }
      } catch {}
    })();
  }, []);

  async function loadStudents(classroomId: number | null) {
    if (!classroomId) return;
    setLoadingStudents(true);
    try {
      const data = await apiGet<any>(`/api/students/?classroom=${classroomId}&page_size=200`);
      const list: Student[] = Array.isArray(data) ? data : (data.results ?? []);
      setStudents(list);
      setSelectedStudents(new Set(list.map(s => s.id)));
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function handleClassroomChange(id: number) {
    setSelectedClassroom(id);
    await loadStudents(id);
  }

  function toggleStudent(id: number) {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedStudents.size === students.length) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map(s => s.id)));
  }

  function execCmd(cmd: string) {
    document.execCommand(cmd, false, undefined);
    descRef.current?.focus();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files || []).forEach(f =>
      setAttachments(prev => [...prev, { type: "file", name: f.name, file: f }])
    );
    e.target.value = "";
  }

  function addLink() {
    if (!linkInput.trim()) return;
    const url = linkInput.startsWith("http") ? linkInput : "https://" + linkInput;
    setAttachments(prev => [...prev, { type: "link", name: url, url }]);
    setLinkInput("");
    setShowLinkBox(false);
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  async function handlePost() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", descRef.current?.innerHTML || "");
      fd.append("assignment_type", "Material");
      fd.append("total_marks", "0");
      fd.append("is_published", "true");
      if (selectedSubject) fd.append("subject", selectedSubject);
      const cls = classrooms.find(c => c.id === selectedClassroom);
      if (cls) {
        fd.append("classroom_id", String(cls.id));
        fd.append("classroom_label", cls.label);
        if (cls.code) fd.append("classroom_code", cls.code);
      }
      const fileAtt = attachments.find(a => a.type === "file" && a.file);
      if (fileAtt?.file) fd.append("attachment", fileAtt.file);
      await apiPostFormData("/api/assignments/", fd);
      toast.success("Material posted");
      router.push("/teacher/assignments");
    } catch {
      toast.error("Failed to post material");
    } finally {
      setPosting(false);
    }
  }

  const allSelected = students.length > 0 && selectedStudents.size === students.length;
  const someSelected = selectedStudents.size > 0 && selectedStudents.size < students.length;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Top bar — no Post button here */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
        <button onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <X className="h-5 w-5 text-gray-600" />
        </button>
        <div className="w-8 h-8 bg-teal-600 rounded flex items-center justify-center ml-3">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-gray-800 ml-3">Material</span>
      </div>

      {/* Two-column layout */}
      <div className="max-w-5xl mx-auto px-4 py-6 flex gap-5 items-start">

        {/* Left: content form */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Title + Description card */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="border-b border-blue-500 mx-4 mt-4 mb-1">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title*"
                className="w-full pb-1.5 text-base outline-none placeholder-gray-400 text-gray-800"
              />
            </div>
            {title === "" && (
              <p className="text-[11px] text-gray-400 px-4 mb-3">*Required</p>
            )}

            <div className="px-4 pb-2">
              <div
                ref={descRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[100px] py-2 text-sm text-gray-700 outline-none empty:before:content-['Description_(optional)'] empty:before:text-gray-400"
              />
            </div>

            <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1">
              {[
                { icon: Bold,             cmd: "bold" },
                { icon: Italic,           cmd: "italic" },
                { icon: Underline,        cmd: "underline" },
                { icon: List,             cmd: "insertUnorderedList" },
                { icon: RemoveFormatting, cmd: "removeFormat" },
              ].map(({ icon: Icon, cmd }) => (
                <button key={cmd} onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Attachments card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-4">Attach</p>

            {attachments.length > 0 && (
              <div className="space-y-2 mb-4">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    {att.type === "file"
                      ? <Paperclip className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      : <ExternalLink className="h-4 w-4 text-green-500 flex-shrink-0" />
                    }
                    <span className="text-sm text-gray-700 truncate flex-1">{att.name}</span>
                    <button onClick={() => removeAttachment(idx)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-6 justify-center py-2">
              <button onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1.5 group">
                <div className="w-12 h-12 rounded-full border-2 border-gray-300 group-hover:border-blue-400 flex items-center justify-center transition-colors">
                  <Upload className="h-5 w-5 text-gray-500 group-hover:text-blue-500" />
                </div>
                <span className="text-xs text-gray-500">Upload</span>
              </button>

              <button onClick={() => setShowLinkBox(v => !v)}
                className="flex flex-col items-center gap-1.5 group">
                <div className="w-12 h-12 rounded-full border-2 border-gray-300 group-hover:border-green-400 flex items-center justify-center transition-colors">
                  <Link className="h-5 w-5 text-gray-500 group-hover:text-green-500" />
                </div>
                <span className="text-xs text-gray-500">Link</span>
              </button>
            </div>

            {showLinkBox && (
              <div className="mt-3 flex gap-2">
                <input
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addLink()}
                  placeholder="Paste link here…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <button onClick={addLink}
                  className="bg-[#274c77] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#1e3a5f] transition-colors">
                  Add
                </button>
              </div>
            )}

            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Right: For + Assign to + Post */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* For — class dropdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">For</p>
            <div className="relative">
              <select
                value={selectedClassroom ?? ""}
                onChange={e => handleClassroomChange(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 outline-none focus:border-blue-400"
              >
                {classrooms.length === 0 && <option value="">No classes</option>}
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Subject dropdown */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Subject</p>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 outline-none focus:border-blue-400"
              >
                {subjects.length === 0 && <option value="">No subjects</option>}
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Assign to + Post */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assign to</p>
            <button
              onClick={() => setShowStudentModal(true)}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-4 w-4 text-blue-500" />
              <span>
                {allSelected
                  ? "All students"
                  : selectedStudents.size === 0
                    ? "No students"
                    : `${selectedStudents.size} student${selectedStudents.size !== 1 ? "s" : ""}`
                }
              </span>
            </button>

            <button
              onClick={handlePost}
              disabled={posting || !title.trim()}
              className="mt-4 w-full bg-[#274c77] hover:bg-[#1e3a5f] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-2 rounded-full transition-colors"
            >
              {posting ? "Posting…" : "Post"}
            </button>
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
              {/* All students toggle */}
              <button onClick={toggleAll}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  allSelected ? "bg-blue-500 border-blue-500" :
                  someSelected ? "bg-blue-200 border-blue-400" : "border-gray-300"
                }`}>
                  {(allSelected || someSelected) && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm font-medium text-gray-800">All students</span>
              </button>

              <div className="h-px bg-gray-100 mx-4 mb-1" />

              {loadingStudents && (
                <p className="text-xs text-gray-400 px-5 py-3">Loading students…</p>
              )}

              {!loadingStudents && students.length === 0 && (
                <p className="text-xs text-gray-400 px-5 py-3">No students in this class</p>
              )}

              {students.map(s => (
                <button key={s.id} onClick={() => toggleStudent(s.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedStudents.has(s.id) ? "bg-blue-500 border-blue-500" : "border-gray-300"
                  }`}>
                    {selectedStudents.has(s.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-700">
                      {(s.full_name || "?").charAt(0).toUpperCase()}
                    </span>
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
