"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar, Users, CheckCircle2, XCircle, Clock, Plane, HelpCircle,
  Search, RefreshCw, Filter, Building2, Fingerprint, PenLine,
  TrendingUp, AlertCircle, Link2, Link2Off, Plus, Trash2, MonitorCheck, Save,
  ScanFace,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getCurrentUser, getCurrentUserRole } from "@/lib/permissions";
import {
  getBiometricDevices, getBiometricMappings, getBiometricUnmappedStaff, createBiometricMapping, updateBiometricMapping, deleteBiometricMapping, createBiometricDevice,
  syncBiometricDeviceUsers, autoLinkBiometricMappings,
  getStaffAttendanceList, markStaffAttendance, getEmployeeTimings, saveEmployeeTimings,
  getCampusDefaultTiming, saveCampusDefaultTiming, recalculateStaffLate,
} from "@/lib/api";
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────
type AttendanceStatus = "present" | "absent" | "late" | "leave" | "not_marked" | "half_day";
type AttendanceSource = "biometric" | "manual" | null;
type StaffRole = "teacher" | "coordinator" | "principal" | "org_admin" | "admin" | "superadmin" | "accounts_officer" | "admissions_counselor" | "compliance_officer" | "staff";
type ActiveTab = "attendance" | "device_mapping" | "shift_timings";

interface StaffAttendanceRecord {
  id: number; user_id: number; full_name: string; employee_code: string; staff_role: string;
  campus: string; campus_id: number; check_in_time: string | null;
  check_out_time: string | null; status: AttendanceStatus; source: AttendanceSource;
  late_minutes: number; late_formatted?: string;
  early_departure_minutes: number; early_departure_formatted?: string;
  remarks: string; photo: string | null;
  db_id?: number | null;
  marked_by_name?: string | null;
}
interface SummaryStats { total: number; present: number; absent: number; late: number; on_leave: number; not_marked: number; }

interface BiometricDevice { id: number; name: string; device_type: string; ip_address: string; serial_number: string; device_model: string; campus_name: string | null; is_active: boolean; is_online: boolean | null; last_status_check: string | null; last_sync: string | null; mapping_count: number; }
interface BiometricMapping { id: number; device: number; device_name: string; device_user_id: string; device_user_name: string; user: number | null; staff_name: string | null; staff_role: string | null; employee_code: string; is_active: boolean; }
interface UnmappedStaff { id: number; full_name: string; employee_code: string; current_campus__campus_name: string | null; }



// ─── Helpers ──────────────────────────────────────────────────────────────────
const getTodayString = () => new Date().toISOString().split("T")[0];

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = getTodayString();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (dateStr === today) return "Today — " + d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" });
  if (dateStr === yest.toISOString().split("T")[0]) return "Yesterday — " + d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" });
  return d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(t: string | null) {
  if (!t) return null;
  // strip seconds: "09:06:00" → "09:06"
  return t.length > 5 ? t.slice(0, 5) : t;
}

function getScopeLabel(role: string, campus: string) {
  if (role === "org_admin" || role === "superadmin") return "All Campuses";
  if (role === "principal") return campus || "Your Campus";
  return "Your Staff";
}

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<AttendanceStatus, { label: string; color: string; dot: string }> = {
  present: { label: "Present", color: "bg-emerald-100 text-emerald-800 border border-emerald-200", dot: "bg-emerald-500" },
  absent: { label: "Absent", color: "bg-red-100 text-red-800 border border-red-200", dot: "bg-red-500" },
  late: { label: "Late", color: "bg-orange-100 text-orange-800 border border-orange-200", dot: "bg-orange-500" },
  leave: { label: "On Leave", color: "bg-blue-100 text-blue-800 border border-blue-200", dot: "bg-blue-500" },
  half_day: { label: "Half Day", color: "bg-indigo-100 text-indigo-800 border border-indigo-200", dot: "bg-indigo-500" },
  not_marked: { label: "Not Marked", color: "bg-gray-100 text-gray-600 border border-gray-200", dot: "bg-gray-400" },
};
const SRC_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  biometric: { label: "Biometric", color: "bg-violet-100 text-violet-700 border border-violet-200", icon: <Fingerprint className="h-3 w-3" /> },
  manual: { label: "Manual", color: "bg-teal-100 text-teal-700 border border-teal-200", icon: <PenLine className="h-3 w-3" /> },
};
const ROLE_CFG: Record<StaffRole, { label: string; color: string }> = {
  teacher: { label: "Teacher", color: "bg-[#a3cef1] text-[#274c77] border border-[#6096ba]" },
  coordinator: { label: "Coordinator", color: "bg-amber-100 text-amber-800 border border-amber-200" },
  principal: { label: "Principal", color: "bg-purple-100 text-purple-800 border border-purple-200" },
  org_admin: { label: "Org Admin", color: "bg-red-100 text-red-800 border border-red-200" },
  admin: { label: "Admin", color: "bg-red-100 text-red-800 border border-red-200" },
  accounts_officer: { label: "Accountant", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  compliance_officer: { label: "Auditor", color: "bg-blue-100 text-blue-800 border border-blue-200" },
  admissions_counselor: { label: "Receptionist", color: "bg-pink-100 text-pink-800 border border-pink-200" },
  staff: { label: "Staff", color: "bg-gray-100 text-gray-800 border border-gray-200" },
  superadmin: { label: "Super Admin", color: "bg-gray-900 text-white" },
};

// ─── Small Components ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon, bg }: { label: string; value: number; icon: React.ReactNode; bg: string }) {
  return (
    <Card className={`border-0 shadow-sm ${bg}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white/50">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs font-medium text-gray-600">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffAttendancePage() {
  const user = getCurrentUser();
  const userRole = getCurrentUserRole();
  const userCampus = typeof user?.campus === "object" ? (user?.campus as any)?.campus_name : (user?.campus as string) ?? "";
  const userCampusId = typeof user?.campus === "object" ? (user?.campus as any)?.id : null;
  const isSuperAdmin = userRole === "superadmin";
  const isOrgAdmin = userRole === "org_admin" || userRole === "superadmin";
  const isPrincipal = userRole === "principal";
  const isCoordinator = userRole === "coordinator";
  // Org admin can VIEW devices/mappings; only principals (and superadmin) ADD/EDIT them.
  const canViewDevices = isOrgAdmin || isPrincipal;
  const canManageDevices = isPrincipal || isSuperAdmin;

  // Marking permissions:
  // Coordinator → teachers only
  // Principal   → all staff in campus
  // Org Admin   → Principals
  const canMark = isPrincipal || isCoordinator || isOrgAdmin;

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<ActiveTab>("attendance");
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Attendance state ──
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffAttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<number, { status: string; check_in_time: string; check_out_time: string; remarks: string }>>({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<BiometricMapping[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedStaff[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mappingRow, setMappingRow] = useState<BiometricMapping | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [savingMap, setSavingMap] = useState(false);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: "", device_type: "foxface", ip_address: "", port: 4370, device_model: "FoxFace FQ8i", serial_number: "", is_active: true });
  const [addingDevice, setAddingDevice] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);

  type ShiftKey = 'morning' | 'afternoon' | 'full_day';
  interface ShiftSlot { shift_type: ShiftKey; check_in_time: string; check_out_time: string; grace_minutes: number; is_set: boolean; }
  interface CampusShifts { morning: ShiftSlot; afternoon: ShiftSlot; full_day: ShiftSlot; }
  interface EmpTiming { user_id: number; full_name: string; employee_code: string; campus: string; timing_id: number | null; shift_type: string | null; check_in_time: string; check_out_time: string; grace_minutes: number; }

  const SHIFT_LABELS: Record<ShiftKey, string> = { morning: 'Morning', afternoon: 'Afternoon', full_day: 'Full Day' };
  const DEFAULT_SHIFTS: CampusShifts = {
    morning:   { shift_type: 'morning',   check_in_time: '08:00', check_out_time: '12:00', grace_minutes: 10, is_set: false },
    afternoon: { shift_type: 'afternoon', check_in_time: '12:00', check_out_time: '17:00', grace_minutes: 10, is_set: false },
    full_day:  { shift_type: 'full_day',  check_in_time: '08:00', check_out_time: '17:00', grace_minutes: 10, is_set: false },
  };

  const [empTimings, setEmpTimings] = useState<EmpTiming[]>([]);
  const [campusShifts, setCampusShifts] = useState<CampusShifts>(DEFAULT_SHIFTS);
  const [shiftDrafts, setShiftDrafts] = useState<CampusShifts>(DEFAULT_SHIFTS);
  const [activeShiftTab, setActiveShiftTab] = useState<ShiftKey>('morning');
  const [timingsLoading, setTimingsLoading] = useState(false);
  const [timingsSaving, setTimingsSaving] = useState(false);
  const [timingsSaved, setTimingsSaved] = useState(false);
  const [campusSaving, setCampusSaving] = useState<ShiftKey | null>(null);

  // ── Load attendance ──
  useEffect(() => {
    setLoading(true);
    const params: { date: string; campus_id?: string | number } = { date: selectedDate };
    if (campusFilter !== "all" && isOrgAdmin) params.campus_id = campusFilter;
    else if (userCampusId) params.campus_id = userCampusId;

    getStaffAttendanceList(params)
      .then(data => {
        // Map API response to StaffAttendanceRecord shape
        const mapped: StaffAttendanceRecord[] = data.map((r: any) => ({
          id: r.user, // Use user_id as the unique ID for table and status
          user_id: r.user,
          full_name: r.staff_name,
          employee_code: r.employee_code ?? "",
          staff_role: (r.staff_role || "staff").toLowerCase(),
          campus: r.campus_name ?? "",
          campus_id: r.campus ?? 0,
          shift: "morning",
          check_in_time: r.check_in_time ?? null,
          check_out_time: r.check_out_time ?? null,
          status: (r.status === "not_marked" ? "not_marked" : (r.status || "not_marked").toLowerCase()) as AttendanceStatus,
          source: r.source as AttendanceSource,
          late_minutes: r.late_minutes ?? 0,
          late_formatted: r.late_formatted ?? "",
          early_departure_minutes: r.early_departure_minutes ?? 0,
          early_departure_formatted: r.early_departure_formatted ?? "",
          remarks: r.remarks ?? "",
          photo: r.staff_photo ?? null,
          db_id: r.id,
          marked_by_name: r.marked_by_name ?? null,
        }));
        setStaffList(mapped);
      })
      .catch(e => {
        console.error("Failed to load staff list:", e);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, campusFilter, userCampusId, isOrgAdmin, isPrincipal, userRole, refreshKey]);

  // ── Load devices & mappings (real API) ──
  useEffect(() => {
    if (activeTab !== "device_mapping") return;
    setDevLoading(true);
    Promise.all([getBiometricDevices(), getBiometricMappings()])
      .then(([devs, maps]) => {
        setDevices(devs);
        setMappings(maps);
        if (devs.length > 0) setSelectedDevice(devs[0].id);
      })
      .catch(e => {
        console.error("Failed to load devices/mappings:", e);
      })
      .finally(() => setDevLoading(false));
  }, [activeTab]);

  // ── Load campus shifts + employee timings ──
  useEffect(() => {
    if (activeTab !== "shift_timings") return;
    setTimingsLoading(true);
    Promise.all([
      getCampusDefaultTiming(userCampusId),
      getEmployeeTimings(userCampusId),
    ])
      .then(([shiftsData, empData]: [any, any]) => {
        const merged = {
          morning:   { ...DEFAULT_SHIFTS.morning,   ...(shiftsData?.morning   || {}) },
          afternoon: { ...DEFAULT_SHIFTS.afternoon, ...(shiftsData?.afternoon || {}) },
          full_day:  { ...DEFAULT_SHIFTS.full_day,  ...(shiftsData?.full_day  || {}) },
        };
        setCampusShifts(merged);
        setShiftDrafts(JSON.parse(JSON.stringify(merged)));
        setEmpTimings(empData);
      })
      .catch(() => { })
      .finally(() => setTimingsLoading(false));
  }, [activeTab, userCampusId]);

  const handleSaveShift = async (key: ShiftKey) => {
    const draft = shiftDrafts[key];
    if (!draft.check_in_time || !draft.check_out_time) {
      toast.error("Please set both arrival and departure times.");
      return;
    }
    setCampusSaving(key);
    try {
      await saveCampusDefaultTiming({
        shift_type: key,
        check_in_time: draft.check_in_time,
        check_out_time: draft.check_out_time,
        grace_minutes: draft.grace_minutes,
        campus_id: userCampusId ?? undefined,
      });
      setCampusShifts(prev => ({ ...prev, [key]: { ...draft, is_set: true } }));
      toast.success(`${SHIFT_LABELS[key]} timing saved.`);
    } catch {
      toast.error("Failed to save shift timing.");
    }
    setCampusSaving(null);
  };

  const updateShiftDraft = (key: ShiftKey, field: string, value: string | number) => {
    setShiftDrafts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSaveTimings = async () => {
    setTimingsSaving(true);
    try {
      const toSave = empTimings.filter(t => t.shift_type && t.shift_type !== 'none');
      await saveEmployeeTimings(toSave);
      setTimingsSaved(true);
      setTimeout(() => setTimingsSaved(false), 3000);
      toast.success("Staff shift assignments saved.");
    } catch { toast.error("Failed to save assignments."); }
    setTimingsSaving(false);
  };

  const updateEmpShift = (userId: number, shift_type: string) => {
    setEmpTimings(prev => prev.map(t => t.user_id === userId
      ? { ...t, shift_type, check_in_time: "", check_out_time: "" }
      : t
    ));
  };

  const updateEmpTiming = (userId: number, field: string, value: string | number) => {
    setEmpTimings(prev => prev.map(t => t.user_id === userId ? { ...t, [field]: value, shift_type: 'custom' } : t));
  };

  // ── Filtered attendance ──
  const filteredStaff = useMemo(() => staffList.filter(s => {
    const q = searchQuery.toLowerCase();
    return (!q || s.full_name.toLowerCase().includes(q) || s.employee_code.toLowerCase().includes(q))
      && (statusFilter === "all" || s.status === statusFilter)
      && (campusFilter === "all" || s.campus === campusFilter)
      && (roleFilter === "all" || s.staff_role === roleFilter);
  }), [staffList, searchQuery, statusFilter, campusFilter, roleFilter]);

  const stats: SummaryStats = useMemo(() => ({
    total: filteredStaff.length,
    present: filteredStaff.filter(s => s.status === "present").length,
    absent: filteredStaff.filter(s => s.status === "absent").length,
    late: filteredStaff.filter(s => s.status === "late").length,
    on_leave: filteredStaff.filter(s => s.status === "leave").length,
    not_marked: filteredStaff.filter(s => s.status === "not_marked").length,
  }), [filteredStaff]);

  const attendancePct = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
  const campuses = useMemo(() => [...new Set(staffList.map(s => s.campus))], [staffList]);

  // ── Edit mode helpers ──
  function getPending(userId: number, field: string, fallback: string) {
    return pendingChanges[userId]?.[field as keyof typeof pendingChanges[number]] ?? fallback;
  }

  function setPendingField(userId: number, field: string, value: string) {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { status: "absent", check_in_time: "", check_out_time: "", remarks: "" }), [field]: value },
    }));
  }

  function enterEditMode() {
    const init: typeof pendingChanges = {};
    staffList.forEach(s => {
      init[s.id] = {
        status: s.status === "not_marked" ? "absent" : s.status,
        check_in_time: s.check_in_time ?? "",
        check_out_time: s.check_out_time ?? "",
        remarks: s.remarks ?? "",
      };
    });
    setPendingChanges(init);
    setEditMode(true);
  }

  async function saveAttendance() {
    setSaving(true);
    const records = Object.entries(pendingChanges).map(([uid, vals]) => ({
      staff_id: Number(uid),
      status: vals.status,
      check_in_time: vals.check_in_time || undefined,
      check_out_time: vals.check_out_time || undefined,
      remarks: vals.remarks,
    }));
    try {
      await markStaffAttendance({ date: selectedDate, records });
      setEditMode(false);
      setPendingChanges({});
      setRefreshKey(k => k + 1);
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculateLate() {
    setRecalculating(true);
    try {
      const res = await recalculateStaffLate(selectedDate);
      toast.success(`Recalculated ${res.recalculated} record${res.recalculated !== 1 ? "s" : ""}`);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error("Recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  // ── Load unmapped teachers when device changes ──
  useEffect(() => {
    if (!selectedDevice) return;
    getBiometricUnmappedStaff(selectedDevice)
      .then(setUnmapped)
      .catch(() => { });
  }, [selectedDevice]);

  // ── Device mappings filtered by selected device ──
  const deviceMappings = useMemo(() => mappings.filter(m => m.device === selectedDevice), [mappings, selectedDevice]);
  const mappedCount = deviceMappings.filter(m => m.user !== null).length;
  const unmappedCount = deviceMappings.filter(m => m.user === null).length;

  // ── Map teacher handler ──
  function openMapModal(row: BiometricMapping) { setMappingRow(row); setSelectedTeacher(""); setShowMapModal(true); }

  async function handleSaveMapping() {
    if (!mappingRow || !selectedTeacher) return;
    setSavingMap(true);
    try {
      // The mapping row already exists (placeholder created by the log pull /
      // device-user sync; unique on device+device_user_id), so UPDATE its user —
      // a create would hit the unique constraint and silently fail.
      if (mappingRow.id) {
        await updateBiometricMapping(mappingRow.id, { user: Number(selectedTeacher) });
      } else {
        await createBiometricMapping({
          device: mappingRow.device,
          device_user_id: mappingRow.device_user_id,
          device_user_name: mappingRow.device_user_name,
          user: Number(selectedTeacher),
        });
      }
      await reloadMappings();
      setShowMapModal(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to link staff. Please try again.");
    } finally {
      setSavingMap(false);
    }
  }

  async function handleRemoveMapping(mappingId: number) {
    try {
      await deleteBiometricMapping(mappingId);
      const [maps, unmap] = await Promise.all([
        getBiometricMappings(selectedDevice ?? undefined),
        getBiometricUnmappedStaff(selectedDevice ?? undefined),
      ]);
      setMappings(maps);
      setUnmapped(unmap);
    } catch (e) {
      console.error(e);
    }
  }

  async function reloadMappings() {
    const [maps, unmap] = await Promise.all([
      getBiometricMappings(selectedDevice ?? undefined),
      getBiometricUnmappedStaff(selectedDevice ?? undefined),
    ]);
    setMappings(maps);
    setUnmapped(unmap);
  }

  // Pull enrolled users from the platform for the selected device + auto-link.
  async function handleSyncDeviceUsers() {
    if (!selectedDevice) return;
    setSyncingUsers(true);
    try {
      const res = await syncBiometricDeviceUsers(selectedDevice);
      await reloadMappings();
      toast.success(`Synced ${res.enrolled_users} device users — ${res.linked} linked to staff.`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to sync device users. Is the FoxFace API configured?");
    } finally {
      setSyncingUsers(false);
    }
  }

  // Re-run auto-link (match device user IDs to staff by biometric_id/username).
  async function handleAutoLink() {
    setAutoLinking(true);
    try {
      const res = await autoLinkBiometricMappings();
      await reloadMappings();
      toast.success(res.linked > 0 ? `Auto-linked ${res.linked} staff.` : "No new matches to link.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to auto-link.");
    } finally {
      setAutoLinking(false);
    }
  }

  async function handleAddDevice() {
    setAddingDevice(true);
    try {
      // FoxFace is cloud-pull: no IP. Send null (not "") so the optional field validates.
      const payload = {
        ...newDevice,
        ip_address: newDevice.ip_address.trim() || null,
        serial_number: newDevice.serial_number.trim(),
        campus: userCampusId,
      };
      const added = await createBiometricDevice(payload);
      setDevices(prev => [...prev, added]);
      setShowAddDeviceModal(false);
      setNewDevice({ name: "", device_type: "foxface", ip_address: "", port: 4370, device_model: "FoxFace FQ8i", serial_number: "", is_active: true });
    } catch (e: any) {
      console.error("Failed to add device", e);
      // Surface the backend reason (duplicate serial, permission, validation).
      const data = e?.data ?? {};
      const msg = data.error
        || (data.serial_number && `Serial number: ${data.serial_number[0]}`)
        || (data.ip_address && `IP address: ${data.ip_address[0]}`)
        || "Failed to add device. Please check inputs and try again.";
      toast.error(msg);
    } finally {
      setAddingDevice(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#f0f4f8]">

      {/* ── Header Card (Image 4 style — rounded floating card) ── */}
      <div className=" mx-auto px-4 sm:px-6 pt-5">
        <div className="bg-gradient-to-b from-[#013a63] via-[#01497c] to-[#012a4a] rounded-2xl shadow-lg overflow-hidden">

          {/* Title + actions row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-5 pb-4">
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Staff Attendance</h1>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1.5 text-white/65 text-xs">
                  <Users className="h-3.5 w-3.5" />{getScopeLabel(userRole, userCampus)}
                </span>
                {activeTab === "attendance" && (
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1 border border-white/15">
                    <Calendar className="h-3.5 w-3.5 text-white/60" />
                    <input type="date" value={selectedDate} max={getTodayString()}
                      onChange={e => { setSelectedDate(e.target.value); setEditMode(false); setPendingChanges({}); }}
                      className="bg-transparent text-white text-xs font-medium outline-none cursor-pointer" />
                  </div>
                )}
                {!loading && activeTab === "attendance" && (
                  <span className="text-white/50 text-xs">{staffList.length} staff members</span>
                )}
              </div>
            </div>

            {activeTab === "attendance" && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {canMark && !editMode && (
                  <button onClick={enterEditMode}
                    className="flex items-center gap-1.5 bg-white text-[#274c77] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all shadow-sm">
                    <PenLine className="h-4 w-4" />Mark Attendance
                  </button>
                )}
                {canMark && editMode && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditMode(false); setPendingChanges({}); }}
                      className="text-white/70 text-sm px-3 py-2 rounded-xl border border-white/25 hover:bg-white/10 transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveAttendance} disabled={saving}
                      className="flex items-center gap-1.5 bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-60">
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {saving ? "Saving..." : "Save All"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "device_mapping" && canManageDevices && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowAddDeviceModal(true)}
                  className="flex items-center gap-1.5 bg-white text-[#274c77] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all shadow-sm">
                  <Plus className="h-4 w-4" />Add Device
                </button>
              </div>
            )}
          </div>

          {/* Tab nav — bottom of card, transparent style */}
          <nav className="flex items-end gap-0 px-4 overflow-x-auto">
            {([
              { key: "attendance", label: "Attendance", icon: <Users className="h-4 w-4" />, show: true, count: !loading && staffList.length > 0 ? staffList.length : null },
              { key: "shift_timings", label: "Employee Timings", icon: <Clock className="h-4 w-4" />, show: isOrgAdmin || isPrincipal, count: null },
              { key: "device_mapping", label: "Device Mapping", icon: <Fingerprint className="h-4 w-4" />, show: canViewDevices, count: null },
            ] as const).filter(t => t.show).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as ActiveTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key
                  ? "border-white text-white"
                  : "border-transparent text-white/45 hover:text-white/75 hover:border-white/30"
                  }`}>
                {tab.icon}
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-white/10 text-white/50"
                    }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </nav>

        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ════════════════ TAB 1: ATTENDANCE ════════════════ */}
        {activeTab === "attendance" && (
          <>
            {/* Date label + attendance % */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-gray-600 font-medium text-sm">{formatDateLabel(selectedDate)}</h2>
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-sm border border-[#e7ecef]">
                <TrendingUp className="h-4 w-4 text-[#6096ba]" />
                <span className="text-[#274c77] font-bold text-lg">{attendancePct}%</span>
                <span className="text-gray-500 text-xs">Attendance</span>
              </div>
            </div>

            {/* Stats */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatCard label="Present" value={stats.present} bg="bg-emerald-50" icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
                <StatCard label="Absent" value={stats.absent} bg="bg-red-50" icon={<XCircle className="h-5 w-5 text-red-500" />} />
                <StatCard label="Late" value={stats.late} bg="bg-orange-50" icon={<Clock className="h-5 w-5 text-orange-500" />} />
                <StatCard label="On Leave" value={stats.on_leave} bg="bg-blue-50" icon={<Plane className="h-5 w-5 text-blue-500" />} />
                <StatCard label="Not Marked" value={stats.not_marked} bg="bg-gray-50" icon={<HelpCircle className="h-5 w-5 text-gray-400" />} />
              </div>
            )}

            {/* Filters */}
            <Card className="border border-[#e7ecef] shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search by name or code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 border-[#e7ecef] text-sm" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9 border-[#e7ecef] text-sm">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="leave">On Leave</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="not_marked">Not Marked</SelectItem>
                    </SelectContent>
                  </Select>

                  {(isOrgAdmin || isPrincipal) && (
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-[140px] h-9 border-[#e7ecef] text-sm">
                        <Users className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="teacher">Teachers</SelectItem>
                        <SelectItem value="coordinator">Coordinators</SelectItem>
                        {isOrgAdmin && (
                          <>
                            <SelectItem value="principal">Principals</SelectItem>
                            <SelectItem value="accounts_officer">Accountants</SelectItem>
                            <SelectItem value="admissions_counselor">Receptionists</SelectItem>
                            <SelectItem value="compliance_officer">Auditors</SelectItem>
                            <SelectItem value="staff">Staff Members</SelectItem>
                            <SelectItem value="admin">Administrators</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {isOrgAdmin && campuses.length > 0 && (
                    <Select value={campusFilter} onValueChange={setCampusFilter}>
                      <SelectTrigger className="w-[150px] h-9 border-[#e7ecef] text-sm">
                        <Building2 className="h-3.5 w-3.5 mr-1.5 text-gray-400" /><SelectValue placeholder="Campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Campuses</SelectItem>
                        {campuses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" className="h-9 border-[#e7ecef] text-gray-600"
                    onClick={() => setRefreshKey(k => k + 1)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
                  </Button>
                  <Button variant="outline" size="sm" disabled={recalculating}
                    className="h-9 border-orange-200 text-orange-600 hover:bg-orange-50"
                    onClick={handleRecalculateLate}>
                    {recalculating
                      ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      : <Clock className="h-3.5 w-3.5 mr-1.5" />}
                    Recalculate Late
                  </Button>
                  <p className="text-xs text-gray-400 ml-auto">{filteredStaff.length} / {staffList.length} records</p>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border border-[#e7ecef] shadow-sm overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-[#e7ecef] bg-white">
                <CardTitle className="text-sm font-semibold text-[#274c77] flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-[#6096ba]" />
                  Staff Attendance Detail
                  {!loading && <Badge className="ml-2 bg-[#a3cef1] text-[#274c77] border-0 text-xs">{filteredStaff.length} records</Badge>}
                  {editMode && canMark && <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1"><PenLine className="h-3 w-3" />Edit Mode — changes not saved yet</span>}
                  {isOrgAdmin && <span className="ml-auto text-xs text-gray-400 italic">View Only</span>}
                </CardTitle>
              </CardHeader>

              {loading ? <TableSkeleton /> : filteredStaff.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <AlertCircle className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No records found</p>
                  <p className="text-gray-400 text-sm mt-1">Try changing filters or selecting a different date</p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#e7ecef]">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                          {(isOrgAdmin || isPrincipal) && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>}
                          {isOrgAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campus</th>}
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check In</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check Out</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f4f8]">
                        {filteredStaff.map(rec => {
                          const inEditMode = editMode && canMark;
                          const currentStatus = inEditMode ? getPending(rec.user_id, "status", rec.status === "not_marked" ? "absent" : rec.status) : rec.status;
                          const sc = STATUS_CFG[currentStatus as AttendanceStatus] ?? STATUS_CFG.not_marked;
                          const src = rec.source ? SRC_CFG[rec.source] : null;
                          const rc = ROLE_CFG[rec.staff_role as StaffRole] || ROLE_CFG.staff;
                          return (
                            <tr key={rec.id} className={`transition-colors ${inEditMode ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-[#f8fafc]"}`}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6096ba] to-[#274c77] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {rec.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{rec.full_name}</p>
                                    <p className="text-gray-400 text-xs">{rec.employee_code}</p>
                                  </div>
                                </div>
                              </td>
                              {(isOrgAdmin || isPrincipal) && <td className="px-4 py-3.5"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>{rc.label}</span></td>}
                              {isOrgAdmin && <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-gray-600 text-xs"><Building2 className="h-3.5 w-3.5 text-[#6096ba]" />{rec.campus}</div></td>}
                              {/* Check In */}
                              <td className="px-4 py-3.5">
                                {inEditMode ? (
                                  <input type="time" value={getPending(rec.user_id, "check_in_time", rec.check_in_time ?? "")}
                                    onChange={e => setPendingField(rec.user_id, "check_in_time", e.target.value)}
                                    className="text-xs border border-[#e7ecef] rounded-lg px-2 py-1 w-24 bg-white focus:border-[#6096ba] outline-none" />
                                ) : rec.check_in_time ? (
                                  <div><p className="text-gray-800 font-medium text-sm">{fmtTime(rec.check_in_time)}</p>{rec.late_minutes > 0 && <p className="text-orange-500 text-xs">+{rec.late_formatted || `${rec.late_minutes} min`} late</p>}</div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Check Out */}
                              <td className="px-4 py-3.5">
                                {inEditMode ? (
                                  <input type="time" value={getPending(rec.user_id, "check_out_time", rec.check_out_time ?? "")}
                                    onChange={e => setPendingField(rec.user_id, "check_out_time", e.target.value)}
                                    className="text-xs border border-[#e7ecef] rounded-lg px-2 py-1 w-24 bg-white focus:border-[#6096ba] outline-none" />
                                ) : rec.check_out_time ? (
                                  <div>
                                    <p className="text-gray-800 font-medium text-sm">{fmtTime(rec.check_out_time)}</p>
                                    {rec.early_departure_minutes > 0 && (
                                      <p className="text-blue-500 text-xs">-{rec.early_departure_formatted || `${rec.early_departure_minutes} min`} early</p>
                                    )}
                                  </div>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3.5">
                                {inEditMode ? (
                                  <select value={getPending(rec.user_id, "status", rec.status === "not_marked" ? "absent" : rec.status)}
                                    onChange={e => setPendingField(rec.user_id, "status", e.target.value)}
                                    className="text-xs border border-[#e7ecef] rounded-lg px-2 py-1 bg-white focus:border-[#6096ba] outline-none cursor-pointer">
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="late">Late</option>
                                    <option value="leave">Leave</option>
                                    <option value="half_day">Half Day</option>
                                  </select>
                                ) : (
                                  <div className="flex flex-col items-start gap-0.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />{sc.label}
                                    </span>
                                    {rec.status === "late" && rec.late_minutes > 0 && (
                                      <span className="text-orange-500 text-xs font-medium pl-1">
                                        +{rec.late_formatted || `${rec.late_minutes} min`} late
                                      </span>
                                    )}
                                    {rec.marked_by_name && rec.status !== "not_marked" && (
                                      <span className="text-gray-400 text-[10px] pl-1">by {rec.marked_by_name}</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              {/* Source */}
                              <td className="px-4 py-3.5">
                                {src ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${src.color}`}>{src.icon}{src.label}</span> : <span className="text-gray-300 text-xs">{inEditMode ? <span className="text-blue-400 text-xs italic">manual</span> : "—"}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-[#f0f4f8]">
                    {filteredStaff.map(rec => {
                      const sc = STATUS_CFG[rec.status]; const src = rec.source ? SRC_CFG[rec.source] : null; const rc = ROLE_CFG[rec.staff_role as StaffRole] || ROLE_CFG.staff;
                      return (
                        <div key={rec.id} className="px-4 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6096ba] to-[#274c77] flex items-center justify-center text-white text-xs font-bold">{rec.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
                              <div><p className="font-semibold text-gray-900 text-sm">{rec.full_name}</p><p className="text-gray-400 text-xs">{rec.employee_code}</p></div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}><span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />{sc.label}</span>
                              {rec.status === "late" && rec.late_minutes > 0 && (
                                <span className="text-orange-500 text-xs font-medium">+{rec.late_formatted || `${rec.late_minutes} min`} late</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(isOrgAdmin || isPrincipal) && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>{rc.label}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-500">
                            {rec.check_in_time && <span>In: <span className="text-gray-700 font-medium">{fmtTime(rec.check_in_time)}</span></span>}
                            {rec.check_out_time && <span>Out: <span className="text-gray-700 font-medium">{fmtTime(rec.check_out_time)}</span></span>}
                            {src && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${src.color}`}>{src.icon}{src.label}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {!loading && filteredStaff.length > 0 && (
                <div className="px-5 py-3 border-t border-[#e7ecef] bg-[#f8fafc] flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-gray-400">Showing {filteredStaff.length} record{filteredStaff.length !== 1 ? "s" : ""}</p>
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                      const count = filteredStaff.filter(s => s.status === key).length;
                      if (!count) return null;
                      return <span key={key} className="flex items-center gap-1 text-gray-500"><span className={`h-2 w-2 rounded-full ${cfg.dot}`} />{cfg.label}: <strong className="text-gray-700">{count}</strong></span>;
                    })}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ════════════════ TAB 2: DEVICE MAPPING ════════════════ */}
        {activeTab === "device_mapping" && canViewDevices && (
          <>
            {devLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : (
              <>
                {/* Devices List */}
                {devices.length === 0 ? (
                  <Card className="border border-dashed border-gray-300 shadow-none bg-gray-50">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <MonitorCheck className="h-8 w-8 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Biometric Devices Found</h3>
                      <p className="text-sm text-gray-500 max-w-prose mx-auto">
                        There are no biometric devices configured for your organization or campus. Please add and integrate devices in the system settings before mapping employees.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map(dev => (
                      <Card
                        key={dev.id}
                        onClick={() => setSelectedDevice(dev.id)}
                        className={`cursor-pointer border-2 transition-all shadow-sm ${selectedDevice === dev.id ? "border-[#274c77] bg-[#f0f4f8]" : "border-[#e7ecef] hover:border-[#6096ba]"}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-[#274c77]/10 rounded-lg">
                                {dev.device_type === "foxface" ? <ScanFace className="h-5 w-5 text-[#274c77]" /> : <Fingerprint className="h-5 w-5 text-[#274c77]" />}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{dev.name}</p>
                                <p className="text-gray-400 text-xs">{dev.device_model}</p>
                              </div>
                            </div>
                            {/* Live connectivity mirrored from the platform; falls back to admin flag when unknown */}
                            {dev.is_online === true ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online</span>
                            ) : dev.is_online === false ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Offline</span>
                            ) : (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dev.is_active ? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-400"}`} title="Live status not yet synced from platform">
                                {dev.is_active ? "Active" : "Inactive"}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${dev.device_type === "foxface" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                {dev.device_type === "foxface" ? "FoxFace · Face" : "ZKTeco · Finger/RFID"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{dev.campus_name ?? "—"}</div>
                            <div className="flex items-center gap-1.5">
                              {dev.device_type === "foxface"
                                ? <><MonitorCheck className="h-3.5 w-3.5" />SN: {dev.serial_number || "—"}</>
                                : <><Fingerprint className="h-3.5 w-3.5" />IP: {dev.ip_address}</>}
                            </div>
                            <div className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />{dev.mapping_count} employees linked</div>
                          </div>
                          {dev.last_sync && (
                            <p className="text-xs text-gray-400 mt-2">Last sync: {new Date(dev.last_sync).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Mapping Table */}
                {selectedDevice && (
                  <Card className="border border-[#e7ecef] shadow-sm overflow-hidden">
                    <CardHeader className="px-5 py-4 border-b border-[#e7ecef] bg-white">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm font-semibold text-[#274c77] flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-[#6096ba]" />
                          Employee Mapping — {devices.find(d => d.id === selectedDevice)?.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{mappedCount} linked</span>
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{unmappedCount} unlinked</span>
                          {canManageDevices && (
                            <>
                              {devices.find(d => d.id === selectedDevice)?.device_type === "foxface" && (
                                <button onClick={handleSyncDeviceUsers} disabled={syncingUsers}
                                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-[#6096ba] text-[#274c77] hover:bg-[#f0f4f8] disabled:opacity-50">
                                  <RefreshCw className={`h-3.5 w-3.5 ${syncingUsers ? "animate-spin" : ""}`} />
                                  {syncingUsers ? "Syncing…" : "Sync device users"}
                                </button>
                              )}
                              <button onClick={handleAutoLink} disabled={autoLinking}
                                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#6096ba] text-white hover:bg-[#4a7c9d] disabled:opacity-50">
                                <Link2 className="h-3.5 w-3.5" />
                                {autoLinking ? "Linking…" : "Auto-link"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#f8fafc] border-b border-[#e7ecef]">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device User</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device ID</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Linked To</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee Code</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f4f8]">
                          {deviceMappings.map(m => (
                            <tr key={m.id} className="hover:bg-[#f8fafc] transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#6096ba] to-[#274c77] flex items-center justify-center text-white text-xs font-bold">
                                    {m.device_user_name ? m.device_user_name[0].toUpperCase() : "?"}
                                  </div>
                                  <p className="font-medium text-gray-800 text-sm">{m.device_user_name || "Unknown"}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">#{m.device_user_id}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                {m.staff_name
                                  ? <p className="text-gray-800 font-medium text-sm">{m.staff_name}</p>
                                  : <span className="text-gray-400 text-sm italic">Not linked</span>
                                }
                              </td>
                              <td className="px-4 py-3.5">
                                {m.employee_code
                                  ? <span className="font-mono text-xs bg-[#a3cef1]/40 text-[#274c77] px-2 py-0.5 rounded">{m.employee_code}</span>
                                  : <span className="text-gray-300 text-xs">—</span>
                                }
                              </td>
                              <td className="px-4 py-3.5">
                                {m.user
                                  ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><Link2 className="h-3 w-3" />Linked</span>
                                  : <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full"><Link2Off className="h-3 w-3" />Unlinked</span>
                                }
                              </td>
                              <td className="px-4 py-3.5">
                                {!canManageDevices ? (
                                  <span className="text-gray-300 text-xs">—</span>
                                ) : m.user ? (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveMapping(m.id)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#6096ba] text-[#274c77] hover:bg-[#f0f4f8]"
                                    onClick={() => openMapModal(m)}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />Link
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-5 py-3 border-t border-[#e7ecef] bg-[#f8fafc]">
                      <p className="text-xs text-gray-400">
                        Map each device user ID to the correct employee so attendance is recorded automatically.
                      </p>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════ TAB 3: EMPLOYEE TIMINGS ════════════════ */}
        {activeTab === "shift_timings" && (isOrgAdmin || isPrincipal) && (
          <div className="space-y-5">

            {/* ── Shift Presets Card ── */}
            <Card className="border border-[#e7ecef] shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-5 py-4 bg-[#274c77]">
                <h2 className="text-white font-bold text-sm">Campus Shift Presets</h2>
                <p className="text-white/60 text-xs mt-0.5">Configure timings for each shift — then assign staff to a shift below</p>
              </div>

              {/* Shift tabs */}
              <div className="flex border-b border-[#e7ecef] bg-white">
                {(['morning', 'afternoon', 'full_day'] as ShiftKey[]).map(key => (
                  <button key={key} onClick={() => setActiveShiftTab(key)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeShiftTab === key ? "border-[#274c77] text-[#274c77]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                    {SHIFT_LABELS[key]}
                    {campusShifts[key].is_set && <span className="w-1.5 h-1.5 rounded-full bg-[#274c77]" />}
                  </button>
                ))}
              </div>

              {/* Active shift editor */}
              {timingsLoading ? (
                <div className="px-5 py-5 flex gap-4"><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-36" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-28" /></div>
              ) : (
                <div className="px-5 py-5 bg-white">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Arrival</p>
                      <input type="time" value={shiftDrafts[activeShiftTab].check_in_time || ""}
                        onChange={e => updateShiftDraft(activeShiftTab, "check_in_time", e.target.value)}
                        className="text-sm border border-[#e7ecef] rounded-lg px-3 py-2 bg-[#f8fafc] focus:bg-white focus:border-[#6096ba] outline-none transition-colors w-36" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departure</p>
                      <input type="time" value={shiftDrafts[activeShiftTab].check_out_time || ""}
                        onChange={e => updateShiftDraft(activeShiftTab, "check_out_time", e.target.value)}
                        className="text-sm border border-[#e7ecef] rounded-lg px-3 py-2 bg-[#f8fafc] focus:bg-white focus:border-[#6096ba] outline-none transition-colors w-36" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grace (min)</p>
                      <input type="number" min={0} max={60} value={shiftDrafts[activeShiftTab].grace_minutes}
                        onChange={e => updateShiftDraft(activeShiftTab, "grace_minutes", Number(e.target.value))}
                        className="text-sm border border-[#e7ecef] rounded-lg px-3 py-2 bg-[#f8fafc] focus:bg-white focus:border-[#6096ba] outline-none transition-colors w-24 text-center" />
                    </div>
                    <Button onClick={() => handleSaveShift(activeShiftTab)} disabled={campusSaving === activeShiftTab}
                      className="bg-[#274c77] hover:bg-[#1e3a5f] text-white flex items-center gap-2 px-5 h-[38px]">
                      {campusSaving === activeShiftTab ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {campusSaving === activeShiftTab ? "Saving..." : `Save ${SHIFT_LABELS[activeShiftTab]}`}
                    </Button>
                  </div>
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(['morning', 'afternoon', 'full_day'] as ShiftKey[]).map(key => (
                      <span key={key} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium ${campusShifts[key].is_set ? "bg-[#274c77]/8 border-[#274c77]/20 text-[#274c77]" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                        {SHIFT_LABELS[key]}: {campusShifts[key].check_in_time} – {campusShifts[key].check_out_time}
                        {campusShifts[key].is_set && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* ── Staff Shift Assignment Table ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-gray-800 font-semibold text-sm">Assign Shifts to Staff</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Select a shift for each employee — their late calculation will use that shift's timing</p>
                </div>
                {timingsSaved && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#274c77] font-semibold bg-[#274c77]/10 border border-[#274c77]/20 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>

              <Card className="border border-[#e7ecef] shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr_180px_1fr_1fr_1fr] gap-x-3 px-5 py-2.5 bg-[#f0f4f8] border-b border-[#e7ecef]">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</p>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Shift</p>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Arrival</p>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departure</p>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Grace (min)</p>
                </div>

                {timingsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="grid grid-cols-[2fr_180px_1fr_1fr_1fr] gap-x-3 items-center">
                        <div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-32" /></div>
                        <Skeleton className="h-9 rounded-lg" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-10" />
                      </div>
                    ))}
                  </div>
                ) : empTimings.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No staff found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#f0f4f8]">
                    {empTimings.map((emp, idx) => {
                      const st = emp.shift_type as ShiftKey | 'custom' | null;
                      const shiftPreset = st && st !== 'custom' ? campusShifts[st as ShiftKey] : null;
                      const dispIn  = st === 'custom' ? emp.check_in_time  : (shiftPreset?.check_in_time  || "—");
                      const dispOut = st === 'custom' ? emp.check_out_time : (shiftPreset?.check_out_time || "—");
                      const dispGrace = shiftPreset ? shiftPreset.grace_minutes : emp.grace_minutes;

                      return (
                        <div key={emp.user_id} className={`grid grid-cols-[2fr_180px_1fr_1fr_1fr] gap-x-3 items-center px-5 py-3 ${idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f7ff] transition-colors`}>
                          {/* Employee */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-[#a3cef1] flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-[#274c77]">{emp.full_name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{emp.full_name}</p>
                              <p className="text-xs text-gray-400 font-mono">{emp.employee_code || "—"}</p>
                            </div>
                          </div>

                          {/* Shift dropdown */}
                          <select value={st || "none"}
                            onChange={e => updateEmpShift(emp.user_id, e.target.value)}
                            className="text-sm border border-[#e7ecef] rounded-lg px-3 py-2 bg-[#f8fafc] focus:bg-white focus:border-[#6096ba] outline-none transition-colors w-full">
                            <option value="none">— Not assigned —</option>
                            <option value="morning">Morning ({campusShifts.morning.check_in_time}–{campusShifts.morning.check_out_time})</option>
                            <option value="afternoon">Afternoon ({campusShifts.afternoon.check_in_time}–{campusShifts.afternoon.check_out_time})</option>
                            <option value="full_day">Full Day ({campusShifts.full_day.check_in_time}–{campusShifts.full_day.check_out_time})</option>
                            <option value="custom">Custom (manual)</option>
                          </select>

                          {/* Show resolved times — editable only for custom */}
                          {st === 'custom' ? (
                            <>
                              <input type="time" value={emp.check_in_time || ""}
                                onChange={e => updateEmpTiming(emp.user_id, "check_in_time", e.target.value)}
                                className="text-sm border border-[#6096ba] rounded-lg px-2 py-1.5 bg-white focus:border-[#274c77] outline-none w-full" />
                              <input type="time" value={emp.check_out_time || ""}
                                onChange={e => updateEmpTiming(emp.user_id, "check_out_time", e.target.value)}
                                className="text-sm border border-[#6096ba] rounded-lg px-2 py-1.5 bg-white focus:border-[#274c77] outline-none w-full" />
                              <input type="number" min={0} max={60} value={emp.grace_minutes}
                                onChange={e => updateEmpTiming(emp.user_id, "grace_minutes", Number(e.target.value))}
                                className="text-sm border border-[#6096ba] rounded-lg px-2 py-1.5 bg-white focus:border-[#274c77] outline-none w-full text-center" />
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-gray-500 font-mono">{dispIn}</span>
                              <span className="text-sm text-gray-500 font-mono">{dispOut}</span>
                              <span className="text-sm text-gray-500">{dispGrace} min</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500">{empTimings.filter(t => t.shift_type && t.shift_type !== 'none').length}</span> of {empTimings.length} staff assigned to a shift
                </p>
                <Button onClick={handleSaveTimings} disabled={timingsSaving}
                  className="bg-[#274c77] hover:bg-[#1e3a5f] text-white flex items-center gap-2 px-5">
                  {timingsSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {timingsSaving ? "Saving..." : "Save Assignments"}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── Modals ─── */}
      {/* Map Teacher Modal */}
      {showMapModal && mappingRow && (
        <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
          <DialogContent className="sm:max-w-md bg-white border-[#e7ecef] shadow-lg rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#274c77]">
                <Link2 className="h-5 w-5" />
                Link Employee to Device User
              </DialogTitle>
            </DialogHeader>

            {mappingRow && (
              <div className="space-y-4 py-2">
                <div className="bg-[#f0f4f8] rounded-lg p-3 flex items-center gap-3">
                  <Fingerprint className="h-8 w-8 text-[#6096ba]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{mappingRow.device_user_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">Device ID: <span className="font-mono">#{mappingRow.device_user_id}</span></p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                    Select Employee
                  </label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger className="border-[#e7ecef]">
                      <SelectValue placeholder="Choose employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unmapped.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <div className="flex flex-col">
                            <span className="font-medium">{t.full_name}</span>
                            <span className="text-xs text-gray-400">{t.employee_code} · {t.current_campus__campus_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTeacher && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                    <p className="font-semibold mb-0.5">Mapping Preview</p>
                    <p>Device ID <span className="font-mono">#{mappingRow.device_user_id}</span> → {unmapped.find(t => String(t.id) === selectedTeacher)?.full_name}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMapModal(false)}>Cancel</Button>
              <Button disabled={!selectedTeacher || savingMap} onClick={handleSaveMapping}
                className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
                {savingMap ? "Saving..." : "Save Mapping"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Device Modal */}
      {showAddDeviceModal && (
        <Dialog open={showAddDeviceModal} onOpenChange={setShowAddDeviceModal}>
          <DialogContent className="sm:max-w-md bg-white border-[#e7ecef] shadow-lg rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-[#274c77] flex items-center gap-2">
                <MonitorCheck className="h-5 w-5 text-[#6096ba]" /> Add Device
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 px-2">
              {/* Device type selector */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Device Type</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  {[
                    { key: "foxface", label: "FoxFace (Face)", icon: <ScanFace className="h-4 w-4" />, sub: "Cloud — Foxit FQ8i" },
                    { key: "zkteco", label: "ZKTeco (Finger/RFID)", icon: <Fingerprint className="h-4 w-4" />, sub: "Local network (ADMS)" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setNewDevice({ ...newDevice, device_type: opt.key, device_model: opt.key === "foxface" ? "FoxFace FQ8i" : "TFT" })}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-all ${newDevice.device_type === opt.key ? "border-[#274c77] bg-[#f0f4f8]" : "border-[#e7ecef] hover:border-[#6096ba]"}`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">{opt.icon}{opt.label}</span>
                      <span className="text-[11px] text-gray-400">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Device Name / Location</label>
                <Input type="text" value={newDevice.name} onChange={e => setNewDevice({ ...newDevice, name: e.target.value })} placeholder="e.g. Main Gate Entrance" className="mt-1" />
              </div>

              {/* Serial number — the key field for FoxFace (matches the platform device, e.g. 2385083) */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Serial Number {newDevice.device_type === "foxface" ? <span className="text-red-500">*</span> : "(Optional)"}
                </label>
                <Input type="text" value={newDevice.serial_number} onChange={e => setNewDevice({ ...newDevice, serial_number: e.target.value })} placeholder={newDevice.device_type === "foxface" ? "e.g. 2385083 (device SN)" : "JYM..."} className="mt-1" />
                {newDevice.device_type === "foxface" && (
                  <p className="text-[11px] text-gray-400 mt-1">Yehi SN platform pe device se match hota hai — device screen pe "SN:" ke aage likha hota hai.</p>
                )}
              </div>

              {/* Network fields — only relevant for local ADMS (ZKTeco) devices */}
              {newDevice.device_type === "zkteco" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">IP Address</label>
                    <Input type="text" value={newDevice.ip_address} onChange={e => setNewDevice({ ...newDevice, ip_address: e.target.value })} placeholder="192.168.1.201" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Port</label>
                    <Input type="number" value={newDevice.port} onChange={e => setNewDevice({ ...newDevice, port: Number(e.target.value) })} placeholder="4370" className="mt-1" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Model (Optional)</label>
                <Input type="text" value={newDevice.device_model} onChange={e => setNewDevice({ ...newDevice, device_model: e.target.value })} placeholder={newDevice.device_type === "foxface" ? "FoxFace FQ8i" : "TFT / uFace"} className="mt-1" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowAddDeviceModal(false)}>Cancel</Button>
              <Button onClick={handleAddDevice} disabled={addingDevice || !newDevice.name || (newDevice.device_type === "foxface" ? !newDevice.serial_number : !newDevice.ip_address)} className="bg-[#6096ba] hover:bg-[#4a7c9d] text-white">
                {addingDevice ? "Adding..." : "Add Device"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
