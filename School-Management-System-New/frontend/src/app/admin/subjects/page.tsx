"use client";

import { useState, useEffect } from "react";
import { Plus, BookOpen, GraduationCap, Search, Pencil, X, ChevronDown, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSubjects, createSubject, updateSubject, getLevels, getStoredUserProfile, getUserRole } from "@/lib/api";
import { toast } from "sonner";

const PRESET_SUBJECTS = [
  "English", "Mathematics", "Urdu", "Science", "Social Studies",
  "Islamiat", "Geography", "History", "Computer Science", "Art",
  "Physics", "Chemistry", "Biology", "Economics", "Accounting",
  "Civics", "Pakistan Studies", "Arabic", "Physical Education",
  "General Knowledge", "Environmental Studies", "Sindhi", "Pashto",
];

interface Subject {
  id: number; name: string; code: string;
  level: { id: number; name: string } | null;
  campus_name: string | null; is_active: boolean;
}
interface Level { id: number; name: string; }

export default function AdminSubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [campusId, setCampusId] = useState<number | null>(null);
  const [coordinatorLevels, setCoordinatorLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [subjectName, setSubjectName] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [levelDropOpen, setLevelDropOpen] = useState(false);
  const [mySubjectsDropOpen, setMySubjectsDropOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const user = getStoredUserProfile();
    let cId: number | null = null;
    if (user?.campus && typeof user.campus === "object") {
      cId = (user.campus as any).id;
    } else if (typeof user?.campus === "number") {
      cId = user.campus;
    } else {
      cId = parseInt(localStorage.getItem("sis_campus_id") || "0") || null;
    }
    setCampusId(cId);
    try {
      const [subData, lvlData] = await Promise.all([
        getSubjects(cId ? { campus: cId } : undefined),
        getLevels(cId ?? undefined),
      ]);
      setSubjects(Array.isArray(subData) ? subData : (subData as any)?.results ?? []);
      const allLevels: Level[] = Array.isArray(lvlData) ? lvlData : (lvlData as any)?.results ?? [];
      setLevels(allLevels);

      // Build coordinator-scoped levels
      const role = getUserRole();
      if (role === 'coordinator') {
        const profile = getStoredUserProfile();
        let coordLevels: Level[] = [];
        if (profile?.assigned_levels?.length) {
          coordLevels = profile.assigned_levels.map((l: any) => ({ id: l.id, name: l.name }));
        } else if (profile?.level?.id) {
          coordLevels = [{ id: profile.level.id, name: profile.level.name }];
        }
        setCoordinatorLevels(coordLevels);
      }
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditing(null);
    setSubjectName(""); setCustomInput("");
    const autoLevel = coordinatorLevels.length === 1 ? String(coordinatorLevels[0].id) : "";
    setSelectedLevelId(autoLevel);
    setLevelDropOpen(false); setMySubjectsDropOpen(false);
    setShowModal(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setSubjectName(s.name); setCustomInput(""); setSelectedLevelId(s.level ? String(s.level.id) : "");
    setLevelDropOpen(false); setMySubjectsDropOpen(false);
    setShowModal(true);
  }

  function handleAddCustom() {
    if (customInput.trim()) {
      setSubjectName(customInput.trim());
      setCustomInput("");
    }
  }

  async function handleSave() {
    if (!subjectName.trim()) { toast.error("Subject Name is required"); return; }
    if (!campusId) { toast.error("Campus not found in profile"); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: subjectName.trim(),
        campus: campusId,
        level: selectedLevelId ? Number(selectedLevelId) : undefined,
      };
      if (editing) {
        await updateSubject(editing.id, payload);
        toast.success("Subject updated");
      } else {
        await createSubject(payload);
        toast.success("Subject created");
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      const detail = err?.response?.data?.name?.[0] ?? err?.response?.data?.non_field_errors?.[0] ?? err?.response?.data?.detail ?? "Save failed";
      toast.error(detail);
    } finally { setSaving(false); }
  }

  const selectedLevel = levels.find(l => String(l.id) === selectedLevelId);
  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.level?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#013a63]">Subjects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subjects available in the timetable</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="bg-[#013a63] hover:bg-[#012d4e]">
            <Plus className="h-4 w-4 mr-1" /> Add Subject
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search subjects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Subject</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Level</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No subjects found. Click "Add Subject" to create one.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 rounded"><BookOpen className="h-3.5 w-3.5 text-[#013a63]" /></div>
                      <span className="font-medium text-[#013a63]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.code ?? "—"}</td>
                  <td className="px-5 py-3">
                    {s.level ? (
                      <span className="flex items-center gap-1 text-gray-600">
                        <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> {s.level.name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={s.is_active ? "default" : "secondary"}
                      className={s.is_active ? "bg-green-100 text-green-700" : ""}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-gray-100">
                      <Pencil className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Subject Modal ─────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-white rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  {editing ? "Edit Subject" : "Add Subject"}
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editing ? "Update subject details for your campus." : "Create or select a subject for your campus level."}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Subject Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject Name <span className="text-red-500">*</span>
                </label>

                {/* Custom input + add button */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); } }}
                    placeholder="Type a custom subject name..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013a63]/20 focus:border-[#013a63]"
                  />
                  <button
                    onClick={handleAddCustom}
                    className="w-9 h-9 flex items-center justify-center bg-[#4a90d9] hover:bg-[#357abd] text-white rounded-lg text-lg font-bold transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Selected name display */}
                {subjectName && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-[#013a63]/5 border border-[#013a63]/20 rounded-lg">
                    <Check className="h-3.5 w-3.5 text-[#013a63]" />
                    <span className="text-sm font-medium text-[#013a63]">{subjectName}</span>
                    <button onClick={() => setSubjectName("")} className="ml-auto text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Preset subjects scrollable list */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    {PRESET_SUBJECTS.map((name) => (
                      <button
                        key={name}
                        onClick={() => setSubjectName(name)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-gray-50 last:border-0 ${
                          subjectName === name
                            ? "bg-[#4a90d9] text-white"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select from existing subjects */}
                {subjects.length > 0 && (
                  <div className="relative mt-2">
                    <button
                      onClick={() => setMySubjectsDropOpen(o => !o)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white hover:border-gray-300 transition-colors"
                    >
                      <span>Select from your list...</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${mySubjectsDropOpen ? "rotate-180" : ""}`} />
                    </button>
                    {mySubjectsDropOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
                        {subjects.map(s => (
                          <button
                            key={s.id}
                            onClick={() => { setSubjectName(s.name); setMySubjectsDropOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assign to Level */}
              {(() => {
                const visibleLevels = coordinatorLevels.length > 0 ? coordinatorLevels : levels;
                const isAutoFixed = coordinatorLevels.length === 1;
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Assign to Level
                    </label>
                    {isAutoFixed ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <GraduationCap className="h-4 w-4 text-[#013a63]" />
                        <span className="text-sm font-medium text-[#013a63]">{coordinatorLevels[0].name}</span>
                        <span className="ml-auto text-[10px] text-blue-400">auto-selected</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => setLevelDropOpen(o => !o)}
                          className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 transition-colors"
                        >
                          <span className={selectedLevel ? "text-gray-800" : "text-gray-400"}>
                            {selectedLevel ? selectedLevel.name : "Select Level"}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${levelDropOpen ? "rotate-180" : ""}`} />
                        </button>
                        {levelDropOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                            {coordinatorLevels.length === 0 && (
                              <button
                                onClick={() => { setSelectedLevelId(""); setLevelDropOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-500 border-b border-gray-50"
                              >
                                All grades / Not specified
                              </button>
                            )}
                            {visibleLevels.map(l => (
                              <button
                                key={l.id}
                                onClick={() => { setSelectedLevelId(String(l.id)); setLevelDropOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 ${
                                  selectedLevelId === String(l.id)
                                    ? "bg-[#4a90d9] text-white"
                                    : "hover:bg-gray-50 text-gray-700"
                                }`}
                              >
                                {l.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !subjectName.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-[#4a90d9] hover:bg-[#357abd] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {saving ? "Saving..." : editing ? "Update Subject" : "Create Subject"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
