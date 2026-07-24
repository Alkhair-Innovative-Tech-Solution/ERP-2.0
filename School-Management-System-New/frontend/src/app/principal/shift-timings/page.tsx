"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Edit2, Layers, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { getAllCampuses, getShiftTimings, createShiftTiming, updateShiftTiming, deleteShiftTiming, getUserCampusId, getClassrooms, applyShiftToClassrooms } from "@/lib/api";
import { toast } from "sonner";

export default function PrincipalShiftTimingsPage() {
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("morning");

  const availableShifts = (() => {
    const campus = campuses.find((c: any) => c.id?.toString() === selectedCampus);
    const s = campus?.shift_available;
    if (!s || s === 'morning') return [{ value: 'morning', label: 'Morning' }];
    if (s === 'afternoon') return [{ value: 'afternoon', label: 'Afternoon' }];
    return [{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }];
  })();
  const [timetableType, setTimetableType] = useState<string>("class");
  const [shiftTimings, setShiftTimings] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", order: 1, start_time: "", end_time: "", is_break: false, days: [] as string[], timetable_type: "class" });

  const [editId, setEditId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");

  // Quick generate state
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({
    start_time: "08:00",
    period_duration: 45,
    num_periods: 8,
    break_after: 4,
    break_duration: 20,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  });

  // Apply to classrooms state
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState<number[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const filteredTimings = shiftTimings.filter((timing: any) => {
    // If days array is empty or null, assume it applies to all days
    if (!timing.days || timing.days.length === 0) return true;
    return timing.days.includes(selectedDay);
  });

  useEffect(() => {
    document.title = "Manage Shift Timings | Principal";
    fetchCampuses();
  }, []);

  useEffect(() => {
    if (selectedCampus && selectedShift && timetableType) fetchTimings();
  }, [selectedCampus, selectedShift, timetableType]);

  async function fetchCampuses() {
    const all = await getAllCampuses();
    const myCampusId = getUserCampusId();
    const filtered = myCampusId ? all.filter((c: any) => c.id === myCampusId) : all;
    setCampuses(filtered);
    if (filtered.length > 0) {
      setSelectedCampus(filtered[0].id.toString());
      const shift = filtered[0].shift_available;
      setSelectedShift(shift === 'afternoon' ? 'afternoon' : 'morning');
    }
  }

  async function fetchTimings() {
    if (!selectedCampus || !selectedShift || !timetableType) return;
    const timings = await getShiftTimings(Number(selectedCampus), selectedShift);
    const filtered = (timings || []).filter((t: any) => {
      const timingType = t.timetable_type || 'class';
      return timingType === timetableType;
    });
    setShiftTimings(filtered);
  }

  function openDialog(timing?: any) {
    if (timing) {
      setForm({
        name: timing.name,
        order: timing.order,
        start_time: timing.start_time,
        end_time: timing.end_time,
        is_break: timing.is_break,
        days: timing.days || [],
        timetable_type: timing.timetable_type || timetableType,
      });
      setEditId(timing.id);
    } else {
      setForm({ name: "", order: shiftTimings.length + 1, start_time: "", end_time: "", is_break: false, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], timetable_type: timetableType });
      setEditId(null);
    }
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.start_time || !form.end_time) {
      toast.error("Please fill all fields");
      return;
    }

    const timingData = {
      ...form,
      campus: Number(selectedCampus),
      shift: selectedShift,
    };

    try {
      if (editId) {
        await updateShiftTiming(editId, timingData);
      } else {
        await createShiftTiming(timingData);
      }
      setIsDialogOpen(false);
      await fetchTimings();
      toast.success(editId ? "Period updated successfully!" : "Period added successfully!");
    } catch (err: any) {
      console.error('Failed to save timing:', err);

      // Handle specific error messages
      if (err.message && err.message.includes('unique set')) {
        toast.warning(`Period name "${form.name}" is already used for this campus/shift!`, {
          description: "Each period name must be unique within the same campus and shift. Try 'Period 1 (Sat)' or similar."
        });
      } else if (err.message) {
        toast.error(`Failed to save period: ${err.message}`);
      } else {
        toast.error("Failed to save timing. Please try again.");
      }
    }
  }

  async function openApplyDialog() {
    const res = await getClassrooms(undefined, undefined, selectedCampus ? Number(selectedCampus) : undefined, selectedShift);
    const all = Array.isArray(res) ? res : ((res as any)?.results || []);
    setClassrooms(all);
    setSelectedClassrooms([]);
    setOverwrite(false);
    setApplyDialogOpen(true);
  }

  async function handleApply() {
    if (shiftTimings.length === 0) {
      toast.error("No shift timings to apply. Add periods first.");
      return;
    }
    setApplying(true);
    try {
      const result = await applyShiftToClassrooms({
        campus_id: Number(selectedCampus),
        shift: selectedShift,
        timetable_type: timetableType,
        classroom_ids: selectedClassrooms.length > 0 ? selectedClassrooms : undefined,
        overwrite,
      });
      setApplyDialogOpen(false);
      toast.success(`Done! ${(result as any).created} slots created, ${(result as any).skipped} already existed.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply timings");
    } finally {
      setApplying(false);
    }
  }

  async function handleQuickGenerate() {
    if (!selectedCampus) { toast.error("Campus not selected"); return; }
    setGenerating(true);
    try {
      const [h, m] = genForm.start_time.split(":").map(Number);
      let cursor = h * 60 + m;
      const periods: any[] = [];

      for (let i = 1; i <= genForm.num_periods; i++) {
        const startH = String(Math.floor(cursor / 60)).padStart(2, "0");
        const startM = String(cursor % 60).padStart(2, "0");
        cursor += genForm.period_duration;
        const endH = String(Math.floor(cursor / 60)).padStart(2, "0");
        const endM = String(cursor % 60).padStart(2, "0");
        periods.push({
          name: `Period ${i}`,
          order: i * 2 - 1,
          start_time: `${startH}:${startM}`,
          end_time: `${endH}:${endM}`,
          is_break: false,
          days: genForm.days,
          timetable_type: timetableType,
          campus: Number(selectedCampus),
          shift: selectedShift,
        });

        if (genForm.break_after > 0 && i === genForm.break_after && i < genForm.num_periods) {
          const bStartH = String(Math.floor(cursor / 60)).padStart(2, "0");
          const bStartM = String(cursor % 60).padStart(2, "0");
          cursor += genForm.break_duration;
          const bEndH = String(Math.floor(cursor / 60)).padStart(2, "0");
          const bEndM = String(cursor % 60).padStart(2, "0");
          periods.push({
            name: `Break`,
            order: i * 2,
            start_time: `${bStartH}:${bStartM}`,
            end_time: `${bEndH}:${bEndM}`,
            is_break: true,
            days: genForm.days,
            timetable_type: timetableType,
            campus: Number(selectedCampus),
            shift: selectedShift,
          });
        }
      }

      let created = 0;
      const errs: string[] = [];
      for (const p of periods) {
        try { await createShiftTiming(p); created++; }
        catch (e: any) { errs.push(e?.message || p.name); }
      }
      setGenDialogOpen(false);
      await fetchTimings();
      if (created > 0) toast.success(`${created} periods generated!`);
      if (errs.length > 0) toast.warning(`${errs.length} periods skipped (already exist)`);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this period?")) return;
    try {
      await deleteShiftTiming(id);
      await fetchTimings();
    } catch {
      toast.error("Failed to delete period");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-[#1a3050] px-6 py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Manage Shift Timings</h1>
          <p className="text-white/60 mt-1 text-sm md:text-base">Configure time periods for your shift timetables</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Controls Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Campus read-only */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Campus</Label>
              <div className="inline-flex items-center gap-2 h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
                <span className="w-2 h-2 rounded-full bg-[#1a3050] flex-shrink-0" />
                <span className="truncate">{campuses.find(c => c.id.toString() === selectedCampus)?.campus_name || 'Loading...'}</span>
              </div>
            </div>

            {/* Timetable Type */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Timetable Type</Label>
              <Select value={timetableType} onValueChange={setTimetableType}>
                <SelectTrigger className="h-10 text-sm border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Class Timetable</SelectItem>
                  <SelectItem value="teacher">Teacher Timetable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shift */}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Shift</Label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger className="h-10 text-sm border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableShifts.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setGenDialogOpen(true)}
                className="flex-1 h-10 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm"
              >
                <Zap className="mr-1.5 h-4 w-4" />
                Quick Generate
              </Button>
              {shiftTimings.length > 0 && (
                <Button
                  onClick={openApplyDialog}
                  className="flex-1 h-10 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm"
                >
                  <Layers className="mr-1.5 h-4 w-4" />
                  Apply to Classes
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
          <div className="flex flex-wrap gap-2">
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  selectedDay === day
                    ? "bg-[#1a3050] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.slice(0, 3)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1a3050] text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide w-14 border-r border-white/10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide border-r border-white/10">Period Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide border-r border-white/10">Start</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide border-r border-white/10">End</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide border-r border-white/10">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTimings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-16 h-16 rounded-full bg-[#1a3050]/8 flex items-center justify-center mb-5">
                        <svg className="w-8 h-8 text-[#1a3050]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">No Time Periods Yet</h3>
                      <p className="text-gray-500 text-sm text-center max-w-sm mb-2">
                        No periods for <span className="font-medium text-[#1a3050]">{timetableType === 'class' ? 'Class' : 'Teacher'} Timetable</span> — <span className="font-medium text-[#1a3050]">{selectedShift === 'morning' ? 'Morning' : 'Afternoon'} Shift</span>
                      </p>
                      <p className="text-amber-600 text-xs font-medium">Use <Zap className="inline h-3.5 w-3.5 mb-0.5" /> Quick Generate above to create periods automatically</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTimings.map((timing: any, idx: number) => (
                  <tr
                    key={timing.id}
                    className={`border-b border-gray-100 transition-colors ${
                      timing.is_break
                        ? "bg-amber-50/60"
                        : idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 border-r border-gray-100 text-gray-400 font-medium text-sm">{idx + 1}</td>
                    <td className="px-4 py-3 border-r border-gray-100">
                      <span className="font-semibold text-gray-800 text-sm">{timing.name}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-100 text-sm text-gray-600 tabular-nums">{timing.start_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 border-r border-gray-100 text-sm text-gray-600 tabular-nums">{timing.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 border-r border-gray-100">
                      {timing.is_break
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Break</span>
                        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Period</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => openDialog(timing)} className="h-8 text-xs border-gray-200 hover:border-[#1a3050] hover:text-[#1a3050]">
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(timing.id)} className="h-8 w-8 p-0">
                          <X size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredTimings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-12 px-4">
              <div className="w-14 h-14 rounded-full bg-[#1a3050]/8 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#1a3050]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-1 text-center">No Time Periods Yet</h3>
              <p className="text-sm text-gray-500 text-center mb-3 px-2">
                No periods for <span className="font-medium text-[#1a3050]">{timetableType === 'class' ? 'Class' : 'Teacher'}</span> — <span className="font-medium text-[#1a3050]">{selectedShift === 'morning' ? 'Morning' : 'Afternoon'}</span>
              </p>
              <p className="text-amber-600 text-xs font-medium text-center"><Zap className="inline h-3.5 w-3.5 mb-0.5" /> Use Quick Generate above</p>
            </div>
          ) : (
            filteredTimings.map((timing: any, idx: number) => (
              <Card key={timing.id} className={`${timing.is_break ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-gray-100'} shadow-sm rounded-xl`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1a3050] text-white text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="font-semibold text-sm text-gray-800">{timing.name}</h3>
                    </div>
                    {timing.is_break && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        Break
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <p className="text-gray-400 mb-0.5 font-medium uppercase tracking-wide text-[10px]">Start</p>
                      <p className="font-semibold text-gray-700 tabular-nums">{timing.start_time.slice(0, 5)}</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <p className="text-gray-400 mb-0.5 font-medium uppercase tracking-wide text-[10px]">End</p>
                      <p className="font-semibold text-gray-700 tabular-nums">{timing.end_time.slice(0, 5)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-gray-200 hover:border-[#1a3050] hover:text-[#1a3050]"
                      onClick={() => openDialog(timing)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(timing.id)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Quick Generate Dialog */}
      <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Quick Generate Periods</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">Auto-create all periods + break in one click</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Start Time</Label>
              <Input type="time" value={genForm.start_time} onChange={e => setGenForm(f => ({ ...f, start_time: e.target.value }))} className="h-10 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Period Duration (min)</Label>
              <Input type="number" min={15} max={120} value={genForm.period_duration} onChange={e => setGenForm(f => ({ ...f, period_duration: Number(e.target.value) }))} className="h-10 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Number of Periods</Label>
              <Input type="number" min={1} max={15} value={genForm.num_periods} onChange={e => setGenForm(f => ({ ...f, num_periods: Number(e.target.value) }))} className="h-10 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Break After Period #</Label>
              <Input type="number" min={0} max={genForm.num_periods} value={genForm.break_after} onChange={e => setGenForm(f => ({ ...f, break_after: Number(e.target.value) }))} className="h-10 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Break Duration (min)</Label>
              <Input type="number" min={5} max={60} value={genForm.break_duration} onChange={e => setGenForm(f => ({ ...f, break_duration: Number(e.target.value) }))} className="h-10 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Apply to Days</Label>
              <div className="flex flex-wrap gap-2">
                {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day => (
                  <label key={day} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${genForm.days.includes(day) ? "bg-[#1a3050] text-white border-[#1a3050]" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                    <input type="checkbox" className="hidden" checked={genForm.days.includes(day)}
                      onChange={e => setGenForm(f => ({ ...f, days: e.target.checked ? [...f.days, day] : f.days.filter(d => d !== day) }))} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGenDialogOpen(false)} className="text-sm h-10">Cancel</Button>
            <Button onClick={handleQuickGenerate} disabled={generating} className="bg-amber-500 hover:bg-amber-600 text-white text-sm h-10">
              {generating ? "Generating..." : `Generate ${genForm.num_periods} Periods`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to Classrooms Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Apply Shift Timings to Classrooms</DialogTitle>
            <p className="text-xs text-gray-600 mt-1">
              {shiftTimings.length} period(s) will be applied as empty slots. Assign subjects/teachers later.
            </p>
          </DialogHeader>
          <div className="py-3 space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Select Classrooms ({selectedClassrooms.length === 0 ? 'All' : selectedClassrooms.length + ' selected'})
              </Label>
              <div className="border rounded-md max-h-52 overflow-y-auto p-2 space-y-2">
                {classrooms.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No classrooms found for this campus/shift</p>
                ) : (
                  classrooms.map((cr: any) => (
                    <label key={cr.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded">
                      <Checkbox
                        checked={selectedClassrooms.includes(cr.id)}
                        onCheckedChange={(checked) => {
                          setSelectedClassrooms(prev =>
                            checked ? [...prev, cr.id] : prev.filter(id => id !== cr.id)
                          );
                        }}
                      />
                      <span className="text-sm">{cr.code || `${cr.grade_name} - ${cr.section}`}</span>
                    </label>
                  ))
                )}
              </div>
              {classrooms.length > 0 && (
                <button
                  className="text-xs text-blue-600 mt-1 hover:underline"
                  onClick={() => setSelectedClassrooms(
                    selectedClassrooms.length === classrooms.length ? [] : classrooms.map((c: any) => c.id)
                  )}
                >
                  {selectedClassrooms.length === classrooms.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
              <span className="text-sm">Overwrite existing slots for same time</span>
            </label>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)} className="w-full sm:w-auto text-sm h-10">
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={applying}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-sm h-10"
            >
              {applying ? 'Applying...' : `Apply to ${selectedClassrooms.length === 0 ? 'All' : selectedClassrooms.length} Class(es)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Period Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{editId ? "Edit Period" : "Add Period"}</DialogTitle>
            <p className="text-xs text-gray-600 mt-1">
              Use unique names (e.g., CT-P1, TT-P1) to avoid conflicts
            </p>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 py-4">
            <div className="md:col-span-1">
              <Label className="text-xs md:text-sm mb-1.5 block">Period Name</Label>
              <Input
                className="h-10 text-sm"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., CT-Period 1"
              />
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs md:text-sm mb-1.5 block">Order</Label>
              <Input
                className="h-10 text-sm"
                type="number"
                value={form.order}
                onChange={e => setForm({ ...form, order: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs md:text-sm mb-1.5 block">Start Time</Label>
              <Input
                className="h-10 text-sm"
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div className="md:col-span-1">
              <Label className="text-xs md:text-sm mb-1.5 block">End Time</Label>
              <Input
                className="h-10 text-sm"
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={form.is_break}
                  onChange={e => setForm({ ...form, is_break: e.target.checked })}
                />
                <span className="text-xs md:text-sm">This is a break period</span>
              </label>
            </div>
            <div className="col-span-1 md:col-span-2">
              <>
                <Label className="text-xs md:text-sm mb-2 block">Apply to specific days (optional)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={form.days.includes(day)}
                        onChange={e => {
                          if (e.target.checked) setForm(f => ({ ...f, days: [...f.days, day] }));
                          else setForm(f => ({ ...f, days: f.days.filter(d => d !== day) }));
                        }}
                      />
                      <span className="text-xs md:text-sm">{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto text-sm h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-sm h-10"
            >
              {editId ? "Update" : "Add"} Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
