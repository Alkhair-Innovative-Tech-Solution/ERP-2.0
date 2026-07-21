"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import AccessDenied from "@/components/AccessDenied";
import {
    Plus, Search, Edit2, Trash2, X,
    LayoutGrid, CheckCircle2, XCircle, Users,
    GitBranch, Building2,
} from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

type Department = {
    id: string;
    dept_code: string;
    dept_name: string;
    institution_code?: string;
    branch_code?: string;
    description?: string;
};

type Institution = { inst_code: string; name: string };
type Branch = { branch_code: string; branch_name: string };

const DEPT_COLORS = [
    { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500", shadow: "hover:shadow-indigo-500/10", blob: "bg-indigo-500/5" },
    { bg: "bg-violet-50", text: "text-violet-600", dot: "bg-violet-500", shadow: "hover:shadow-violet-500/10", blob: "bg-violet-500/5" },
    { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500", shadow: "hover:shadow-emerald-500/10", blob: "bg-emerald-500/5" },
    { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500", shadow: "hover:shadow-amber-500/10", blob: "bg-amber-500/5" },
    { bg: "bg-sky-50", text: "text-sky-600", dot: "bg-sky-500", shadow: "hover:shadow-sky-500/10", blob: "bg-sky-500/5" },
    { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500", shadow: "hover:shadow-rose-500/10", blob: "bg-rose-500/5" },
];

const deptSchema = z.object({
    dept_name: z.string().trim().min(2, "Name must be at least 2 characters"),
    dept_code: z.string().trim()
        .min(1, "Code is required")
        .max(6, "Code must be 6 characters or less")
        .regex(/^[A-Za-z0-9]+$/, "Code must be alphanumeric only"),
    institution_code: z.string().optional().or(z.literal("")),
    branch_code: z.string().optional().or(z.literal("")),
    description: z.string().trim().optional().or(z.literal("")),
});

type DeptInput = z.input<typeof deptSchema>;
type DeptOutput = z.output<typeof deptSchema>;

const Skeleton = ({ className, height, width }: any) => (
    <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} style={{ height, width }} />
);

const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 outline-none transition ${err ? "border-rose-400 ring-rose-100" : "border-slate-300 focus:ring-indigo-500"
    }`;

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="text-[10px] font-bold text-rose-500 mt-1 ml-1 uppercase tracking-wider">{msg}</p>;
}

type SaveResult = { ok: boolean; fieldErrors?: Record<string, string>; error?: string };

function DepartmentModal({
    open, onClose, onSave, initial, institutions, branches,
}: {
    open: boolean;
    onClose: () => void;
    onSave: (d: DeptOutput) => Promise<SaveResult>;
    initial?: Department | null;
    institutions: Institution[];
    branches: Branch[];
}) {
    const {
        register, handleSubmit, reset, setError, watch,
        formState: { errors, isSubmitting },
    } = useForm<DeptInput, any, DeptOutput>({
        resolver: zodResolver(deptSchema),
        defaultValues: { dept_name: "", dept_code: "", institution_code: "", branch_code: "", description: "" },
    });
    const [submitError, setSubmitError] = useState<string | null>(null);
    const instVal = watch("institution_code");
    const branchVal = watch("branch_code");

    useEffect(() => {
        if (!open) return;
        setSubmitError(null);
        reset(initial ? {
            dept_name: initial.dept_name || "",
            dept_code: initial.dept_code || "",
            institution_code: initial.institution_code || "",
            branch_code: initial.branch_code || "",
            description: initial.description || "",
        } : { dept_name: "", dept_code: "", institution_code: "", branch_code: "", description: "" });
    }, [initial, open, reset]);

    if (!open) return null;

    const submit: SubmitHandler<DeptOutput> = async (data) => {
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

    // Department Modal Form - Styled like Institution Registry Form
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <form onSubmit={handleSubmit(submit)} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* ━━━ HEADER ━━━ */}
                <div className="px-8 py-6 border-b border-slate-100 bg-linear-to-br from-white to-slate-50/50">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                {initial ? "Edit Department" : "Add Department"}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 mt-2 tracking-widest uppercase">
                                {initial ? "Update department information" : "Fill in the department details"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                {/* ━━━ ERROR MESSAGE ━━━ */}
                {submitError && (
                    <div className="mx-8 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 tracking-wide">
                        {submitError}
                    </div>
                )}

                {/* ━━━ FORM CONTENT ━━━ */}
                <div className="px-8 py-8 space-y-6">

                    {/* Branch */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 mb-2 tracking-widest uppercase">
                            Branch
                        </label>
                        <select
                            {...register("branch_code")}
                            disabled={!!instVal}
                            className={`w-full px-4 py-3 bg-white border rounded-lg text-slate-900 font-medium placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-theme-800/20 focus:border-theme-800 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed ${errors.branch_code ? "border-rose-300" : "border-slate-200"
                                }`}
                        >
                            <option value="">---------</option>
                            {branches.map(b => (
                                <option key={b.branch_code} value={b.branch_code}>
                                    {b.branch_name} ({b.branch_code})
                                </option>
                            ))}
                        </select>
                        <FieldError msg={errors.branch_code?.message} />
                        {!instVal && !branchVal && (
                            <p className="text-xs text-slate-400 mt-2">
                                Pick institution OR branch — not both
                            </p>
                        )}
                    </div>

                    {/* Institution */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 mb-2 tracking-widest uppercase">
                            Institution
                        </label>
                        <select
                            {...register("institution_code")}
                            disabled={!!branchVal}
                            className={`w-full px-4 py-3 bg-white border rounded-lg text-slate-900 font-medium placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-theme-800/20 focus:border-theme-800 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed ${errors.institution_code ? "border-rose-300" : "border-slate-200"
                                }`}
                        >
                            <option value="">---------</option>
                            {institutions.map(inst => (
                                <option key={inst.inst_code} value={inst.inst_code}>
                                    {inst.name} ({inst.inst_code})
                                </option>
                            ))}
                        </select>
                        <FieldError msg={errors.institution_code?.message} />
                    </div>

                    {/* Department Code & Name (2 Column) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-black text-slate-700 mb-2 tracking-widest uppercase">
                                Department Code
                            </label>
                            <input
                                type="text"
                                placeholder="E.G. HR, FIN, ACAD"
                                disabled={!!initial}
                                {...register("dept_code")}
                                className={`w-full px-4 py-3 bg-white border rounded-lg text-slate-900 font-medium placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-theme-800/20 focus:border-theme-800 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed ${errors.dept_code ? "border-rose-300" : "border-slate-200"
                                    }`}
                            />
                            <FieldError msg={errors.dept_code?.message} />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-slate-700 mb-2 tracking-widest uppercase">
                                Department Name
                            </label>
                            <input
                                type="text"
                                placeholder="E.G. ACADEMIC"
                                {...register("dept_name")}
                                className={`w-full px-4 py-3 bg-white border rounded-lg text-slate-900 font-medium placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-theme-800/20 focus:border-theme-800 ${errors.dept_name ? "border-rose-300" : "border-slate-200"
                                    }`}
                            />
                            <FieldError msg={errors.dept_name?.message} />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 mb-2 tracking-widest uppercase">
                            Description
                        </label>
                        <input
                            type="text"
                            placeholder="BRIEF DESCRIPTION"
                            {...register("description")}
                            className={`w-full px-4 py-3 bg-white border rounded-lg text-slate-900 font-medium placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-theme-800/20 focus:border-theme-800 ${errors.description ? "border-rose-300" : "border-slate-200"
                                }`}
                        />
                        <FieldError msg={errors.description?.message} />
                    </div>

                </div>

                {/* ━━━ FOOTER ━━━ */}
                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-black text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 text-sm font-black text-white bg-theme-800 rounded-lg hover:bg-[#5a3558] shadow-lg shadow-theme-800/20 transition active:scale-95 disabled:opacity-60 uppercase tracking-wider"
                    >
                        {isSubmitting ? "Saving…" : initial ? "Save Changes" : "Add Department"}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Department | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);

    async function loadData() {
        try {
            setLoading(true);
            const [deptRes, instRes, brRes] = await Promise.all([
                fetchWithAuth("/employees/departments"),
                fetchWithAuth("/employees/institutions"),
                fetchWithAuth("/employees/branches"),
            ]);
            if (deptRes.status === 403 || instRes.status === 403 || brRes.status === 403) {
                setForbidden(true); return;
            }
            if (deptRes.ok) {
                const data = await deptRes.json();
                setDepartments(Array.isArray(data) ? data : data.departments || []);
            }
            if (instRes.ok) {
                const data = await instRes.json();
                setInstitutions(Array.isArray(data) ? data : data.institutions || []);
            }
            if (brRes.ok) {
                const data = await brRes.json();
                setBranches(Array.isArray(data) ? data : data.branches || []);
            }
        } catch (err) {
            console.error("Failed to load data:", err);
            setDepartments([]);
            setInstitutions([]);
            setBranches([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadData(); }, []);

    const filtered = departments.filter(d =>
        (d.dept_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.dept_code || "").toLowerCase().includes(search.toLowerCase()) ||
        (d.institution_code || "").toLowerCase().includes(search.toLowerCase())
    );

    const stats = [
        { label: "Total Departments", value: departments.length, icon: LayoutGrid, color: "text-blue-600", bg: "bg-blue-50", shadow: "hover:shadow-blue-500/20", blob: "bg-blue-500/5" },
        { label: "Active", value: departments.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", shadow: "hover:shadow-emerald-500/20", blob: "bg-emerald-500/5" },
        { label: "Branches", value: new Set(departments.map(d => d.branch_code).filter(Boolean)).size, icon: GitBranch, color: "text-rose-600", bg: "bg-rose-50", shadow: "hover:shadow-rose-500/20", blob: "bg-rose-500/5" },
        { label: "Institutions", value: new Set(departments.map(d => d.institution_code).filter(Boolean)).size, icon: Building2, color: "text-violet-600", bg: "bg-violet-50", shadow: "hover:shadow-violet-500/20", blob: "bg-violet-500/5" },
    ];

    async function handleSave(data: DeptOutput): Promise<SaveResult> {
        const payload = editTarget
            ? {
                dept_name: data.dept_name.trim(),
                description: data.description?.trim() || null,
                institution_code: data.institution_code || null,
                branch_code: data.branch_code || null,
            }
            : {
                dept_name: data.dept_name.trim(),
                dept_code: data.dept_code.trim().toUpperCase(),
                institution_code: data.institution_code || null,
                branch_code: data.branch_code || null,
                description: data.description?.trim() || null,
            };
        const url = editTarget
            ? `/employees/departments/${editTarget.dept_code}`
            : "/employees/departments";
        const method = editTarget ? "PUT" : "POST";
        try {
            const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
            const body = await res.json().catch(() => ({}));
            if (res.ok) {
                loadData();
                setEditTarget(null);
                if (editTarget) {
                    toast.success("Department Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
                } else {
                    toast.success("Department Added Successfully", { style: { backgroundColor: '#22c55e', color: '#fff' } });
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

    async function handleDelete(deptCode: string) {
        setDeleteBusy(true);
        try {
            const res = await fetchWithAuth(`/employees/departments/${deptCode}/`, { method: "DELETE" });
            if (res.ok) {
                loadData();
                toast.success("Department Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
            } else {
                const body = await res.json().catch(() => ({}));
                alert(body?.error || "Failed to delete");
            }
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setDeleteBusy(false);
            setDeleteId(null);
        }
    }

   

        if (forbidden) return <ProtectedLayout><AccessDenied permission="department.view" /></ProtectedLayout>;

        return (
            <ProtectedLayout>
                {/* Delete Confirmation Modal */}
                {deleteId && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                                <Trash2 className="text-red-600 h-6 w-6" />
                            </div>
                            <h3 className="text-center text-lg font-bold text-slate-900">Delete Department?</h3>
                            {/* <p className="text-center text-xs text-slate-500 mt-2">This action cannot be undone. Please confirm you want to remove this unit.</p> */}
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setDeleteId(null)} disabled={deleteBusy} className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                                    Cancel
                                </button>
                                <button onClick={() => handleDelete(deleteId)} disabled={deleteBusy} className="flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-red-400 rounded-xl hover:bg-red-500 transition shadow-lg shadow-red-200">
                                    {deleteBusy ? "..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <DepartmentModal
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setEditTarget(null); }}
                    onSave={handleSave}
                    initial={editTarget}
                    institutions={institutions}
                    branches={branches}
                />

                <div className="p-2 sm:p-4 lg:p-6 max-w-400 mx-auto space-y-6 animate-in fade-in duration-500">

                    {/* Header: Responsive flex-col on mobile, flex-row on sm+ */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 shrink-0 rounded-2xl bg-theme-800 flex items-center justify-center text-white shadow-lg shadow-theme-800/20">
                                <LayoutGrid size={22} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Departments</h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Functional Organizational Units</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setEditTarget(null); setModalOpen(true); }}
                            className="w-full md:w-auto flex items-center justify-center gap-2 h-12 px-8 bg-theme-800 rounded-xl text-white hover:bg-theme-900 transition-all shadow-lg shadow-theme-800/20 active:scale-95"
                        >
                            <Plus size={18} strokeWidth={3} />
                            <span className="text-xs font-black uppercase tracking-widest">Add Department</span>
                        </button>
                    </div>

                    {/* Stats Grid: 1 col on mobile, 2 on sm, 4 on lg */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {stats.map((s) => (
                            <div key={s.label} className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden`}>
                                <div className="flex items-center justify-between relative z-10">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                                        {loading ? <Skeleton width="40px" height="28px" /> : (
                                            <p className="text-2xl font-black text-slate-900 tracking-tighter">{s.value}</p>
                                        )}
                                    </div>
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${s.bg} ${s.color} group-hover:scale-110 transition-transform`}>
                                        <s.icon size={20} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, code, or institution..."
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 rounded-xl text-xs font-bold uppercase tracking-widest placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-theme-800/10 outline-none transition border-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Departments List: 1 col mobile, 2 col tablet, 3 col desktop, 4 col wide */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => <Skeleton key={i} height={200} className="rounded-3xl" />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <XCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">No results found</h4>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4  md:grid-cols-4 gap-3">
                            {filtered.map((d, idx) => {
                                const colors = DEPT_COLORS[idx % DEPT_COLORS.length];
                                return (
                                    <div key={d.id} className="group bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-2xl transition-all duration-500 relative overflow-hidden flex flex-col">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className={`h-12 w-12 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center text-xl font-black shadow-sm`}>
                                                {d.dept_name?.charAt(0)}
                                            </div>
                                            <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditTarget(d); setModalOpen(true); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => setDeleteId(d.dept_code)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight mb-1 truncate">{d.dept_name}</h3>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>{d.dept_code}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{d.institution_code || d.branch_code || "Global"}</span>
                                        </div>

                                        {d.description && (
                                            <p className="text-[11px] text-slate-500 leading-relaxed italic line-clamp-2 mb-6">"{d.description}"</p>
                                        )}

                                        <div className="mt-auto pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Institution</p>
                                                <p className="text-[10px] font-black text-slate-700 truncate">{d.institution_code || "—"}</p>
                                            </div>
                                            <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Branch</p>
                                                <p className="text-[10px] font-black text-slate-700 truncate">{d.branch_code || "—"}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </ProtectedLayout>
        );
    }

