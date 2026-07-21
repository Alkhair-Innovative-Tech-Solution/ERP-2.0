"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import {
  Plus, Search, Edit2, Trash2, X,
  GitBranch, MapPin, CheckCircle2, XCircle, Phone, Mail, Globe,
} from "lucide-react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import PhoneInput from "@/components/PhoneInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

type Branch = {
  id?: string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  institution_code: string;
  status: string;
  address?: string;
  city?: string;
  district?: string;
  postal_code?: string;
  contact_number?: string;
  secondary_contact?: string;
  email?: string;
  branch_head_name?: string;
  branch_head_contact?: string;
  branch_head_email?: string;
  established_year?: number;
  registration_number?: string;
};

type Institution = { inst_code: string; name: string };

const PK_PHONE_RE = /^(\+92|92|0|0092)?3\d{2}-?\d{7}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const branchSchema = z.object({
  branch_name: z.string().trim().min(2, "Name must be at least 2 characters"),
  branch_code: z.string().trim().min(1, "Code is required").max(20, "Code too long"),
  institution_code: z.string().min(1, "Select an institution"),
  status: z.enum(["active", "inactive", "closed", "under_construction"]),
  city: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  branch_head_name: z.string().trim().optional().or(z.literal("")),
  contact_number: z.string().trim().optional().or(z.literal(""))
    .refine(v => !v || PK_PHONE_RE.test(v), "Invalid PK phone (e.g. 03001234567)"),
  email: z.string().trim().optional().or(z.literal(""))
    .refine(v => !v || EMAIL_RE.test(v), "Invalid email"),
});
type BranchInput = z.input<typeof branchSchema>;
type BranchOutput = z.output<typeof branchSchema>;

const Skeleton = ({ className, height, width }: any) => (
  <div className={`animate-pulse bg-zinc-100 rounded-xl ${className}`} style={{ height, width }} />
);

const inputCls = (err?: string) =>
  `w-full px-5 py-3.5 bg-zinc-50 border rounded-lg text-[11px] font-black uppercase tracking-widest outline-none transition-all ${
    err ? "border-rose-400 bg-rose-50/40" : "border-transparent focus:border-indigo-500 focus:bg-white"
  }`;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[10px] font-bold text-rose-500 mt-1.5 ml-1 uppercase tracking-wider">{msg}</p>;
}

type SaveResult = { ok: boolean; fieldErrors?: Record<string, string>; error?: string };

function BranchModal({
  open, onClose, onSave, initial, institutions,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: BranchOutput) => Promise<SaveResult>;
  initial?: Branch | null;
  institutions: Institution[];
}) {
  const {
    register, handleSubmit, reset, setError, control,
    formState: { errors, isSubmitting },
  } = useForm<BranchInput, any, BranchOutput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      branch_name: "", branch_code: "", institution_code: "",
      status: "active", city: "", address: "", email: "",
      contact_number: "", branch_head_name: "",
    },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    reset(initial ? {
      branch_name: initial.branch_name || "",
      branch_code: initial.branch_code || "",
      institution_code: initial.institution_code || "",
      status: (initial.status as any) || "active",
      city: initial.city || "",
      address: initial.address || "",
      email: initial.email || "",
      contact_number: initial.contact_number || "",
      branch_head_name: initial.branch_head_name || "",
    } : {
      branch_name: "", branch_code: "", institution_code: "",
      status: "active", city: "", address: "", email: "",
      contact_number: "", branch_head_name: "",
    });
  }, [initial, open, reset]);

  if (!open) return null;

  const submit: SubmitHandler<BranchOutput> = async (data) => {
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

  return (

    
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={handleSubmit(submit)} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 duration-200 overflow-hidden border border-zinc-100">
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-50">
          <div>
            <h2 className="text-lg font-black text-zinc-800 tracking-tighter uppercase">{initial ? "Update Branch" : "Establish New Unit"}</h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Physical Hub & Operational Registry</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-zinc-300 hover:text-zinc-900 rounded-lg transition"><X size={24} /></button>
        </div>

        {submitError && (
          <div className="mx-8 mt-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-black text-rose-700 uppercase tracking-wider">
            {submitError}
          </div>
        )}

        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Branch Full Name</label>
            <input type="text" placeholder="e.g. Lahore Central Campus" {...register("branch_name")} className={inputCls(errors.branch_name?.message)} />
            <FieldError msg={errors.branch_name?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Registry Code</label>
            <input type="text" placeholder="e.g. LHR-01" {...register("branch_code")} className={inputCls(errors.branch_code?.message)} />
            <FieldError msg={errors.branch_code?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Parent Institution</label>
            <select {...register("institution_code")} className={`${inputCls(errors.institution_code?.message)} appearance-none`}>
              <option value="">Select Institution</option>
              {institutions.map(inst => (
                <option key={inst.inst_code} value={inst.inst_code}>{inst.name} [{inst.inst_code}]</option>
              ))}
            </select>
            <FieldError msg={errors.institution_code?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Operational Status</label>
            <select {...register("status")} className={`${inputCls(errors.status?.message)} appearance-none`}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
              <option value="under_construction">Under Construction</option>
            </select>
            <FieldError msg={errors.status?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Base City</label>
            <input type="text" placeholder="e.g. Lahore" {...register("city")} className={inputCls(errors.city?.message)} />
            <FieldError msg={errors.city?.message} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Physical Address</label>
            <input type="text" placeholder="Full street address..." {...register("address")} className={inputCls(errors.address?.message)} />
            <FieldError msg={errors.address?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Branch Head</label>
            <input type="text" placeholder="e.g. Dr. Ali" {...register("branch_head_name")} className={inputCls(errors.branch_head_name?.message)} />
            <FieldError msg={errors.branch_head_name?.message} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Contact Phone</label>
            <Controller name="contact_number" control={control} render={({ field }) => (
              <PhoneInput value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} className={inputCls(errors.contact_number?.message)} />
            )} />
            <FieldError msg={errors.contact_number?.message} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
            <input type="text" placeholder="branch@domain.pk" {...register("email")} className={inputCls(errors.email?.message)} />
            <FieldError msg={errors.email?.message} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-zinc-50 flex justify-end gap-3 bg-zinc-50/30">
          <button type="button" onClick={onClose} className="px-6 py-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-600 transition">Cancel</button>
          <button type="submit" disabled={isSubmitting}
            className="px-10 py-3.5 bg-theme-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-theme-800  shadow-lg transition-all active:scale-95 disabled:opacity-50">
            {isSubmitting ? "Saving…" : initial ? "Confirm Changes" : "Deploy Unit"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [branchRes, instRes] = await Promise.all([
        fetchWithAuth("/employees/branches"),
        fetchWithAuth("/employees/institutions"),
      ]);
      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranches(Array.isArray(data) ? data : data.branches || []);
      }
      if (instRes.ok) {
        const data = await instRes.json();
        setInstitutions(Array.isArray(data) ? data : data.institutions || []);
      }
    } catch (err) {
      console.error("Failed to load registry:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = branches.filter(b =>
    b.branch_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.branch_code?.toLowerCase().includes(search.toLowerCase()) ||
    b.city?.toLowerCase().includes(search.toLowerCase()) ||
    b.institution_code?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total Branches", value: branches.length, icon: GitBranch, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Active Nodes", value: branches.filter(b => b.status === "active").length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Offline Units", value: branches.filter(b => b.status !== "active").length, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Strategic Bases", value: new Set(branches.map(b => b.city).filter(Boolean)).size, icon: Globe, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  async function handleSave(data: BranchOutput): Promise<SaveResult> {
    const payload = {
      branch_name: data.branch_name.trim(),
      branch_code: data.branch_code.trim(),
      institution_code: data.institution_code,
      status: data.status,
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      contact_number: data.contact_number?.trim() || null,
      email: data.email?.trim() || null,
      branch_head_name: data.branch_head_name?.trim() || null,
    };
    const url = editTarget
      ? `/employees/branches/${editTarget.branch_code}`
      : "/employees/branches";
    const method = editTarget ? "PUT" : "POST";
    try {
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        loadData();
        setEditTarget(null);
        if (editTarget) {
          toast.success("Branch Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
        } else {
          toast.success("Branch Added Successfully", { style: { backgroundColor: '#22c55e', color: '#fff' } });
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
      const res = await fetchWithAuth(`/employees/branches/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
        toast.success("Branch Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || "Decommissioning failed.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteBusy(false);
      setDeleteId(null);
    }
  }

  return (
    <ProtectedLayout>
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 animate-in zoom-in-95 duration-200 text-center border border-zinc-100">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner"><Trash2 size={24} /></div>
            <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tighter">Decommission Unit?</h3>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-2 px-4 leading-relaxed">This branch will be marked inactive in the registry (recoverable).</p>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeleteId(null)} disabled={deleteBusy} className="flex-1 px-4 py-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 rounded-xl hover:bg-zinc-100 transition disabled:opacity-50">Standby</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleteBusy} className="flex-1 px-4 py-3 text-[10px] font-black text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-xl shadow-rose-200 disabled:opacity-50">
                {deleteBusy ? "…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BranchModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        institutions={institutions}
      />

      <div className="p-4 sm:p-6 lg:p-10 max-w-400 mx-auto space-y-12 animate-in fade-in duration-1000">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-zinc-100 pb-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Operational Branches</h1>
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.5em] italic opacity-60">Physical Deployment & Station Registry</p>
          </div>
          <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="h-16 px-10 bg-zinc-900 text-white rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-2xl shadow-zinc-900/10">
            <Plus size={20} strokeWidth={3} /> Initialize Unit
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={idx} className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-lg transition-all duration-500 group relative overflow-hidden">
                <div className={`absolute top-6 right-6 p-4 rounded-2xl ${s.bg} ${s.color} group-hover:scale-110 transition-transform`}><Icon size={24} strokeWidth={2.5} /></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{s.label}</p>
                  {loading ? <Skeleton width="40%" height={32} /> : (
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter leading-none">{s.value}</h3>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter opacity-60">HUB</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-2xl shadow-zinc-200/20">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
            <input type="text" placeholder="FILTER BY UNIT NAME, REGISTRY CODE OR CITY BASE..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-5 bg-zinc-50/50 border border-transparent focus:border-zinc-200 focus:bg-white rounded-2xl text-[11px] font-black text-zinc-900 uppercase tracking-widest outline-none transition-all shadow-inner" />
          </div>
        </div>

        <div className="relative pb-20">
          <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-2xl shadow-zinc-200/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-50/50 text-left">
                <thead>
                  <tr className="bg-zinc-50/30">
                    <th className="py-8 px-8 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Operational Unit</th>
                    <th className="py-8 px-8 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Deployment</th>
                    <th className="py-8 px-8 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Contact Node</th>
                    <th className="py-8 px-8 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="py-8 px-8 text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50/50">
                  {loading ? [...Array(4)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="p-8"><Skeleton height={24} className="w-full rounded-full" /></td></tr>
                  )) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="py-24 text-center">
                      <XCircle size={40} className="mx-auto text-zinc-100 mb-6" />
                      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em]">No units found in the current registry.</p>
                    </td></tr>
                  ) : filtered.map(b => (
                    <tr key={b.branch_id} className="hover:bg-zinc-50/40 transition-all group">
                      <td className="p-8">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-sm font-black transition-transform group-hover:scale-110 shadow-lg shadow-zinc-900/10 uppercase">
                            {b.branch_name?.charAt(0)}
                          </div>
                          <div>
                            <h5 className="text-[13px] font-black text-zinc-900 uppercase tracking-tight leading-tight">{b.branch_name}</h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{b.branch_code}</span>
                              <span className="h-1 w-1 rounded-full bg-zinc-200" />
                              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{b.institution_code}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-zinc-900">
                            <MapPin size={12} className="text-rose-400" />
                            <span className="text-[11px] font-black uppercase tracking-tight">{b.city || "Central Base"}</span>
                          </div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase truncate max-w-37.5 ml-5">{b.address}</p>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-6 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400"><Phone size={10} /></div>
                            <span className="text-[10px] font-black text-zinc-700">{b.contact_number || "--"}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-6 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400"><Mail size={10} /></div>
                            <span className="text-[10px] font-black text-zinc-700 lowercase">{b.email || "no-email@registry.pk"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ${b.status === "active" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${b.status === "active" ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
                          {b.status}
                        </span>
                      </td>
                      <td className="p-8 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditTarget(b); setModalOpen(true); }} className="h-11 w-11 flex items-center justify-center bg-white text-zinc-400 rounded-2xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm border border-zinc-100">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => setDeleteId(b.branch_code)} className="h-11 w-11 flex items-center justify-center bg-white text-zinc-400 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-zinc-100">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}

