"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import AccessDenied from "@/components/AccessDenied";
import { Plus, Search, Edit2, Trash2, X, Briefcase, CheckCircle2, XCircle, Filter,   LayoutGrid } from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

type Designation = {
  id: string;
  position_code: string;
  position_name: string;
  department__dept_code?: string;
  department_code?: string;
  description?: string;
};

type Department = { dept_code: string; dept_name: string; branch_code?: string };

const desigSchema = z.object({
  position_name: z.string().trim().min(2, "Name must be at least 2 characters"),
  position_code: z.string().trim().min(1, "Code is required").max(20, "Code too long"),
  department_code: z.string().min(1, "Select a department"),
  description: z.string().trim().optional().or(z.literal("")),
});
type DesigInput = z.input<typeof desigSchema>;
type DesigOutput = z.output<typeof desigSchema>;

const Skeleton = ({ className, height, width }: any) => (
  <div className={`animate-pulse bg-zinc-100 rounded-lg ${className}`} style={{ height, width }} />
);

const inputCls = (err?: string, extra = "") =>
  `w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm font-bold text-slate-900 outline-none transition uppercase shadow-inner ${err ? "border-rose-400 bg-rose-50/40" : "border-transparent focus:border-indigo-500 focus:bg-white"
  } ${extra}`;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[10px] font-bold text-rose-500 mt-1 ml-1 uppercase tracking-wider">{msg}</p>;
}

type SaveResult = { ok: boolean; fieldErrors?: Record<string, string>; error?: string };

function DesignationModal({
  open, onClose, onSave, initial, departments,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: DesigOutput) => Promise<SaveResult>;
  initial?: Designation | null;
  departments: Department[];
}) {
  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<DesigInput, any, DesigOutput>({
    resolver: zodResolver(desigSchema),
    defaultValues: { position_name: "", position_code: "", department_code: "", description: "" },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(initial ? {
      position_name: initial.position_name || "",
      position_code: initial.position_code || "",
      department_code: initial.department__dept_code || initial.department_code || "",
      description: initial.description || "",
    } : { position_name: "", position_code: "", department_code: "", description: "" });
  }, [initial, open, reset]);

  if (!open) return null;

  const submit: SubmitHandler<DesigOutput> = async (data) => {
    setSubmitError(null);
    const res = await onSave(data);
    if (!res.ok) {
      if (res.fieldErrors) {
        Object.entries(res.fieldErrors).forEach(([k, v]) => setError(k as any, { message: v }));
      }
      if (res.error) setSubmitError(res.error);
      return;
    }
    onClose();
  };

  const lockedExtra = "opacity-50 cursor-not-allowed bg-slate-100";
  // Designation form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit(submit)} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-5">
        <div className="flex items-center justify-between px-5 py-4 border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">{initial ? "Update Designation" : "Add New Designation"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define role parameters and authority levels.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {submitError && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
            {submitError}
          </div>
        )}

        <div className="px-8 py-8 space-y-3.5">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Position / Title</label>
            <input type="text" placeholder="e.g. Senior Surgeon, Head Teacher" {...register("position_name")} className={inputCls(errors.position_name?.message)} />
            <FieldError msg={errors.position_name?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Position Code</label>
              <input type="text" placeholder="e.g. SRG, TCH" disabled={!!initial} {...register("position_code")} className={inputCls(errors.position_code?.message, initial ? lockedExtra : "")} />
              <FieldError msg={errors.position_code?.message} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Department</label>
              <select disabled={!!initial} {...register("department_code")} className={inputCls(errors.department_code?.message, initial ? lockedExtra : "")}>
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.dept_code} value={dept.dept_code}>{dept.dept_name} [{dept.dept_code}]</option>
                ))}
              </select>
              <FieldError msg={errors.department_code?.message} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Description</label>
            <textarea rows={3} placeholder="Outline key responsibilities..." {...register("description")} className={`${inputCls(errors.description?.message)} resize-none`} />
            <FieldError msg={errors.description?.message} />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2.5 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest rounded-lg hover:text-slate-600 bg-gray-300 hover:bg-gray-200 transition">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="px-6 py-4 text-[10px] font-black text-white bg-theme-800 rounded-lg  shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50">
            {isSubmitting ? "Saving…" : initial ? "Apply Changes" : "Confirm Entry"}
          </button>
        </div>
      </form>
    </div>
  );

  // ── inputCls helper ──
  function inputCls(err?: string, extra?: string) {
    const base =
      "w-full px-3 py-2.5 h-11 text-sm bg-gray-50 border rounded-lg outline-none transition appearance-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100 disabled:text-slate-400";
    const border = err
      ? "border-rose-300 focus:border-rose-400"
      : "border-slate-200 focus:border-slate-400";
    return [base, border, extra ?? ""].join(" ").trim();
  }
}

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Designation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [desigRes, deptRes] = await Promise.all([
        fetchWithAuth("/employees/designations"),
        fetchWithAuth("/employees/departments"),
      ]);
      if (desigRes.status === 403 || deptRes.status === 403) { setForbidden(true); return; }
      if (desigRes.ok) {
        const data = await desigRes.json();
        setDesignations(Array.isArray(data) ? data : data.designations || []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(Array.isArray(data) ? data : data.departments || []);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setDesignations([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = designations.filter(d =>
    (d.position_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.position_code || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.department__dept_code || d.department_code || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total Designations", value: designations.length, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Roles", value: designations.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Branches", value: new Set(designations.map(d => d.department__dept_code || d.department_code)).size, icon: Filter, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Total Departments", value: departments.length, icon: LayoutGrid, color: "text-blue-600", bg: "bg-blue-50", shadow: "hover:shadow-blue-500/20", blob: "bg-blue-500/5" },
  ];

  async function handleSave(data: DesigOutput): Promise<SaveResult> {
    const payload = editTarget
      ? {
        position_name: data.position_name.trim(),
        description: data.description?.trim() || null,
      }
      : {
        department_code: data.department_code,
        position_code: data.position_code.trim(),
        position_name: data.position_name.trim(),
        description: data.description?.trim() || null,
      };
    const url = editTarget
      ? `/employees/designations/${editTarget.id}`
      : "/employees/designations";
    const method = editTarget ? "PUT" : "POST";
    try {
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        loadData();
        setEditTarget(null);
        if (editTarget) {
          toast.success("Designation Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
        } else {
          toast.success("Designation Added Successfully", { style: { backgroundColor: '#22c55e', color: '#fff' } });
        }
        return { ok: true };
      }
      if (body?.field_errors) return { ok: false, fieldErrors: body.field_errors };
      if (Array.isArray(body?.detail)) {
        return { ok: false, error: body.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ") };
      }
      return { ok: false, error: typeof body?.error === "string" ? body.error : "Operation failed" };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error" };
    }
  }

  async function handleDelete(id: string) {
    setDeleteBusy(true);
    try {
      const res = await fetchWithAuth(`/employees/designations/${id}/`, { method: "DELETE" });
      if (res.ok) {
        loadData();
        toast.success("Designation Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || "Failed to purge node from registry.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteBusy(false);
      setDeleteId(null);
    }
  }

  if (forbidden) return <ProtectedLayout><AccessDenied permission="designation.view" /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-3 p-5 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 size={20} />
            </div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Delete Designation</h3>
            {/* <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Soft-delete — recoverable.</p> */}
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setDeleteId(null)} disabled={deleteBusy}
                className="flex-1 px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 rounded-lg hover:bg-slate-200 transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleteBusy}
                className="flex-1 px-2 py-2 text-[10px] font-black text-white bg-red-400 rounded-lg hover:bg-red-500 transition shadow-md shadow-red-200 disabled:opacity-50">
                {deleteBusy ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DesignationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        departments={departments}
      />
      {/* main  */}
      <div className="p-2 sm:p-4 lg:p-6 max-w-400 mx-auto space-y-6  animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm backdrop-blur-md ">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-theme-800 flex items-center justify-center text-white shadow-lg shadow-theme-800/20">
              <Briefcase size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Designations</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Professional Roles Registry</p>
            </div>
          </div>

          <button
            onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 h-11 px-6 bg-theme-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-theme-800/20"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">Add Designation</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 px-6 p-5 group flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{s.label}</p>
                {loading ? <Skeleton width="44px" height="26px" /> : (
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{s.value}</h3>
                    {/* <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</span> */}
                  </div>
                )}
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.bg} ${s.color} group-hover:scale-110 transition-transform duration-300`}>
                <s.icon size={20} strokeWidth={2.5} />
              </div>
            </div>
          ))}
        </div>


        {/* Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 sm:p-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Quickly search by name, code, or Designation code..."
              className="w-full pl-11 pr-4 py-3 border-0 bg-slate-50 rounded-lg text-xs font-bold uppercase tracking-widest placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-theme-800/20 outline-none transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>


        {/* Table */}
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-left">
              <thead className="bg-zinc-50/20">
                <tr className="bg-zinc-50/20">
                  <th className="py-3 px-4 text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em]">Position / Role</th>
                  <th className="py-3 px-4 text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em]">Registry Code</th>
                  <th className="py-3 px-4 text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em]">Department</th>
                  <th className="py-3 px-4 text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="p-4">
                        <Skeleton height={20} className="w-full rounded-full" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <XCircle size={32} className="mx-auto text-zinc-200 mb-3" />
                      <h4 className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No positions found matching your search.</h4>
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id} className="hover:bg-zinc-50/60 transition-all group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-2xl text-[15px] font-bold bg-[#d6d6e2] flex items-center justify-center text-white shadow-lg group-hover:bg-theme-800 transition-all shrink-0">
                            {d.position_name?.charAt(0)}
                          </div>
                          <div>
                            <h5 className="text-[12px] font-black text-zinc-900 uppercase tracking-tight">{d.position_name}</h5>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Professional Grade Record</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50/60 px-3 py-1.5 rounded-full border border-indigo-100 tracking-[0.18em] font-mono">
                          {d.position_code}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">
                            {departments.find(dept => dept.dept_code === (d.department__dept_code || d.department_code))?.dept_name || "Unassigned"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => { setEditTarget(d); setModalOpen(true); }}
                            className="h-8 w-8 flex items-center justify-center bg-white text-zinc-400 rounded-lg hover:bg-zinc-300 hover:text-white transition-all shadow-sm border border-zinc-100"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteId(d.id)}
                            className="h-8 w-8 flex items-center justify-center bg-white text-zinc-400 rounded-lg hover:bg-red-400 hover:text-white transition-all shadow-sm border border-zinc-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
