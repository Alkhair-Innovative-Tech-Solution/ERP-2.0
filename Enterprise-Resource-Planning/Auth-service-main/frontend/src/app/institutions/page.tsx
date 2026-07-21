"use client";

/**
 * STRATEGIC INSTITUTIONS REGISTRY (UNIFIED)
 * --------------------------------------------------------------------------
 * Consolidated module for Institutions and Branch Deployment.
 * This version incorporates the full standalone branch logic, stats, and 
 * metadata fields into a unified operational hub.
 * --------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import {
  Building2, Plus, Search, MapPin, GitBranch, ArrowLeft,
  X, Shield, Activity, Globe, Edit2, Trash2, ArrowRight,
  Database, UserCheck, Phone, Mail, CheckCircle2, XCircle
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { fetchWithAuth } from "@/utils/api";
import { Suspense } from "react";
import AccessDenied from "@/components/AccessDenied";
import toast from "react-hot-toast";

// ==========================================================================
// 1. TYPES & INTERFACES
// ==========================================================================

type Organization = {
  id: string;
  name: string;
  org_code: string;
};

type Institution = {
  id: string;
  inst_code: string;
  name: string;
  inst_type: string;
  address: string;
  city: string;
  contact_number: string;
  organization_code?: string;
};

type Branch = {
  branch_id: string;
  branch_code: string;
  branch_name: string;
  institution_code: string;
  status: string;
  address: string;
  city: string;
  contact_number: string;
  email: string;
  branch_head_name?: string;
};

// ==========================================================================
// 2. SHARED UI FRAGMENTS
// ==========================================================================

function Skeleton({ className, width, height }: { className?: string; width?: string | number; height?: string | number }) {
  return <div className={`animate-pulse bg-zinc-100 rounded-md ${className}`} style={{ width, height }} />;
}

/**
 * EntityCard - High-density card for Institution Index
 */
function EntityCard({
  institution,
  branches = [],
  onEdit,
  onDelete,
  onViewBranches
}: {
  institution: Institution;
  branches?: Branch[];
  onEdit: (inst: Institution) => void;
  onDelete: (id: string) => void;
  onViewBranches: (inst: Institution) => void;
}) {
  const branchCount = branches.length;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-theme-800/10 hover:-translate-y-1.5 transition-all duration-500 group relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-25 h-25 bg-theme-800/5 blur-[60px] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />

      <div className="p-4 sm:p-5 relative z-10 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-theme-800/10 text-theme-800 flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shrink-0">
              <Building2 size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-black text-theme-800 uppercase tracking-widest">{institution.inst_code}</span>
                <span className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight group-hover:text-theme-800 transition-colors uppercase leading-tight truncate">
                {institution.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
            <button onClick={() => onEdit(institution)} className="h-8 w-8 flex items-center justify-center bg-white text-slate-400 rounded-lg hover:text-theme-800 hover:bg-theme-800/10 transition-all active:scale-95 border border-slate-100 shadow-sm">
              <Edit2 size={14} strokeWidth={2.5} />
            </button>
            <button onClick={() => onDelete(institution.id)} className="h-8 w-8 flex items-center justify-center bg-white text-slate-400 rounded-lg hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95 border border-slate-100 shadow-sm">
              <Trash2 size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {/*///////// institutions cards//// */}

        <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-slate-50">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Inst Type</p>
            <p className="text-[10px] font-black text-slate-700 uppercase truncate">{institution.inst_type || 'Educational'}</p>
          </div>
          <div className="border-l border-slate-50 pl-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
            <p className="text-[10px] font-black text-slate-700 uppercase truncate">{institution.city || 'Central'}</p>
          </div>
          <div className="border-l border-slate-50 pl-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</p>
            <p className="text-[10px] font-black text-slate-700 uppercase truncate">{branchCount} Units</p>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={() => onViewBranches(institution)}
            className="w-full  bg-theme-800 text-white rounded-2xl py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-theme-800 transition-all active:scale-95 text-center flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
          >
            <GitBranch size={16} strokeWidth={3} />
            See Branches
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 3. MODAL SYSTEMS from of institution update and create
// ==========================================================================

function InstitutionModal({ open, onClose, onSave, initial, organizations }: {
  open: boolean; onClose: () => void;
  onSave: (d: any) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>;
  initial?: Institution | null;
  organizations: Organization[];
}) {
  const [form, setForm] = useState({
    name: '', inst_code: '', inst_type: 'educational',
    organization_code: '', city: '', address: '', contact_number: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? '',
        inst_code: initial?.inst_code ?? '',
        inst_type: initial?.inst_type ?? 'educational',
        organization_code: initial?.organization_code ?? (organizations[0]?.org_code || ''),
        city: initial?.city ?? '',
        address: initial?.address ?? '',
        contact_number: initial?.contact_number ?? '',
      });
      setErrors({});
      setSubmitError('');
    }
  }, [initial, open, organizations]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.inst_code.trim()) e.inst_code = 'Code required';
    if (!form.organization_code) e.organization_code = 'Organization required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    const result = await onSave(form);
    setSaving(false);
    if (!result.ok) {
      if (result.fieldErrors) setErrors(result.fieldErrors);
      setSubmitError(result.error || 'Save failed');
    }
  };

  const inp = (err?: string) =>
    `w-full px-5 py-3.5 bg-zinc-50 border focus:bg-white rounded-lg text-[10px] uppercase font-black tracking-widest outline-none transition-all ${err ? 'border-rose-400' : 'border-transparent focus:border-theme-800'}`;

  if (!open) return null;
  //////// add institution from ////
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-2 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-zinc-100 animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="px-5 py-5 border-b border-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900 tracking-tighter uppercase">{initial ? 'Update Entity' : 'Institution Registry'}</h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Core Institutional Record</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-300 hover:text-zinc-900 transition-all"><X size={20} /></button>
        </div>
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {submitError && (
            <div className="col-span-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-4 py-3 rounded-lg">
              {submitError}
            </div>
          )}

          {/* Parent Organization */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Parent Organization</label>
            <select value={form.organization_code}
              onChange={e => { setForm(p => ({ ...p, organization_code: e.target.value })); setErrors(p => ({ ...p, organization_code: '' })); }}
              className={inp(errors.organization_code)}>
              {organizations.map(org => <option key={org.id} value={org.org_code}>{org.name} ({org.org_code})</option>)}
            </select>
            {errors.organization_code && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.organization_code}</p>}
          </div>

          {/* Inst Code */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Inst Code</label>
            <input type="text" placeholder="Unique code (e.g., AIT01, AMC01)" value={form.inst_code}
              onChange={e => { setForm(p => ({ ...p, inst_code: e.target.value })); setErrors(p => ({ ...p, inst_code: '' })); }}
              className={inp(errors.inst_code)} />
            {errors.inst_code && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.inst_code}</p>}
          </div>

          {/* Name */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1"> Inst Name</label>
            <input type="text" placeholder="e.g. Al-Khidmat Foundation" value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: '' })); }}
              className={inp(errors.name)} />
            {errors.name && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.name}</p>}
          </div>

          {/* Inst Type */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Inst Type</label>
            <select value={form.inst_type} onChange={e => setForm(p => ({ ...p, inst_type: e.target.value }))}
              className={inp()}>
              <option value="educational">Educational (School, College, University)</option>
              <option value="healthcare">Healthcare (Hospital, Clinic, Lab)</option>
              <option value="social_welfare">Social Welfare (Kitchen, Shelter, Center)</option>
              <option value="administrative">Administrative (Office, Branch)</option>
              <option value="technical">Technical / Vocational</option>
              <option value="operational">Operational / Project Site</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Address */}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Address</label>
            <input type="text" placeholder="Street address" value={form.address ?? ''}
              onChange={e => { setForm(p => ({ ...p, address: e.target.value })); setErrors(p => ({ ...p, address: '' })); }}
              className={inp(errors.address)} />
            {errors.address && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.address}</p>}
          </div>

          {/* City */}
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">City</label>
            <input type="text" placeholder="e.g. Karachi" value={form.city ?? ''}
              onChange={e => { setForm(p => ({ ...p, city: e.target.value })); setErrors(p => ({ ...p, city: '' })); }}
              className={inp(errors.city)} />
            {errors.city && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.city}</p>}
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">Contact Number</label>
            <input type="tel" placeholder="e.g. 0300-1234567" value={form.contact_number ?? ''}
              onChange={e => { setForm(p => ({ ...p, contact_number: e.target.value })); setErrors(p => ({ ...p, contact_number: '' })); }}
              className={inp(errors.contact_number)} />
            {errors.contact_number && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.contact_number}</p>}
          </div>

          {/* Actions */}
          <div className="col-span-2 pt-6 flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-6 py-3 text-[10px] font-black text-zinc-500 rounded-lg hover:bg-[#dce0e4] bg-[#f1f5f9] hover:text-zinc-700 uppercase tracking-widest">Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-8 py-3.5 bg-theme-800 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-theme-800 transition-all active:scale-95 shadow-xl disabled:opacity-50">
              {saving ? 'Saving...' : initial ? 'Finalize Changes' : 'Department Registration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

///////branch code /////

function BranchModal({ open, onClose, onSave, initial, institutionCode }: {
  open: boolean; onClose: () => void;
  onSave: (d: any) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>;
  initial?: Branch | null;
  institutionCode: string;
}) {
  const empty = { branch_name: '', branch_code: '', institution_code: institutionCode, status: 'active', city: '', address: '', contact_number: '', email: '', branch_head_name: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        branch_name: initial?.branch_name ?? '',
        branch_code: initial?.branch_code ?? '',
        institution_code: institutionCode,
        status: initial?.status ?? 'active',
        city: initial?.city ?? '',
        address: initial?.address ?? '',
        contact_number: initial?.contact_number ?? '',
        email: initial?.email ?? '',
        branch_head_name: initial?.branch_head_name ?? '',
      });
      setErrors({});
      setSubmitError('');
    }
  }, [initial, open, institutionCode]);

  const PK_PHONE = /^(\+92|92|0|0092)?3\d{2}-?\d{7}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.branch_name.trim()) e.branch_name = 'Branch name required';
    if (!form.branch_code.trim()) e.branch_code = 'Branch code required';
    if (form.contact_number && !PK_PHONE.test(form.contact_number)) e.contact_number = 'Invalid PK phone (e.g. 03001234567)';
    if (form.email && !EMAIL_RE.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    const result = await onSave(form);
    setSaving(false);
    if (!result.ok) {
      if (result.fieldErrors) setErrors(result.fieldErrors);
      setSubmitError(result.error || 'Save failed');
    }
  };

  const inp = (err?: string) =>
    `w-full px-5 py-3.5 bg-zinc-50 border focus:bg-white rounded-lg text-[10px] uppercase font-black tracking-widest outline-none transition-all ${err ? 'border-rose-400' : 'border-transparent focus:border-theme-800'}`;

  if (!open) return null;
  ////branch from code///////
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-zinc-100 animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="px-5 py-5 border-b border-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-zinc-900 tracking-tighter uppercase">{initial ? 'Update Branch' : 'Deploy Operational Branch'}</h2>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">Full Deployment Registry</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-300 hover:text-zinc-900 transition-all"><X size={20} /></button>
        </div>
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {submitError && (
            <div className="col-span-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-4 py-3 rounded-xl">
              {submitError}
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Branch Name </label>
            <input type="text" placeholder="e.g. Area Command Hub" value={form.branch_name}
              onChange={e => { setForm(p => ({ ...p, branch_name: e.target.value })); setErrors(p => ({ ...p, branch_name: '' })); }}
              className={inp(errors.branch_name)} />
            {errors.branch_name && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.branch_name}</p>}
          </div>
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Branch Code </label>
            <input type="text" placeholder="ISL-01" value={form.branch_code}
              onChange={e => { setForm(p => ({ ...p, branch_code: e.target.value })); setErrors(p => ({ ...p, branch_code: '' })); }}
              className={inp(errors.branch_code)} />
            {errors.branch_code && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.branch_code}</p>}
          </div>
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Deployment Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inp()}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
              {/* <option value="under_construction">Under Construction</option> */}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Branch Head / CO</label>
            <input type="text" placeholder="e.g. Dr. Salman Khan" value={form.branch_head_name}
              onChange={e => setForm(p => ({ ...p, branch_head_name: e.target.value }))} className={inp()} />
          </div>
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Contact Phone</label>
            <input type="tel" placeholder="03001234567" value={form.contact_number}
              onChange={e => { setForm(p => ({ ...p, contact_number: e.target.value })); setErrors(p => ({ ...p, contact_number: '' })); }}
              className={inp(errors.contact_number)} />
            {errors.contact_number && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.contact_number}</p>}
          </div>
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Deployment Email</label>
            <input type="email" placeholder="unit@inst.pk" value={form.email}
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: '' })); }}
              className={`${inp(errors.email)} lowercase`} />
            {errors.email && <p className="text-[9px] text-rose-500 font-bold mt-1 ml-1">{errors.email}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Station City</label>
            <input type="text" placeholder="e.g. Islamabad" value={form.city}
              onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inp()} />
          </div>
          <div className="col-span-2">
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Full Physical Address</label>
            <input type="text" placeholder="Plot 123, Sector G-10..." value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inp()} />
          </div>
          <div className="col-span-2 pt-6 flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-6 py-3 text-[10px] font-black bg-[#e4e4f0] rounded-lg text-zinc-600 hover:text-zinc-700 uppercase tracking-widest">Cancel</button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-8 py-3.5 bg-theme-800 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-theme-800 transition-all active:scale-95 shadow-xl disabled:opacity-50">
              {saving ? 'Saving...' : initial ? 'Apply Command' : 'Initialize Deployment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// 4. MAIN REGISTRY COMPONENT
// ==========================================================================

function InstitutionsPage() {
  const [view, setView] = useState<"list" | "branches">("list");
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");

  const [totalUnits, setTotalUnits] = useState(0);
  const [reachCities, setReachCities] = useState(0);

  const [instModal, setInstModal] = useState(false);
  const [branchModal, setBranchModal] = useState(false);
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [instRes, orgRes, branchRes] = await Promise.all([
        fetchWithAuth("/employees/institutions"),
        fetchWithAuth("/employees/organizations"),
        fetchWithAuth("/employees/branches")
      ]);

      if (instRes.status === 403 || orgRes.status === 403 || branchRes.status === 403) {
        setForbidden(true);
        return;
      }

      if (instRes.ok) {
        const data = await instRes.json();
        const list = Array.isArray(data) ? data : (data.institutions || []);
        setInstitutions(list);
        setReachCities(new Set(list.map((i: any) => i.city).filter(Boolean)).size);
      }

      if (orgRes.ok) {
        const data = await orgRes.json();
        setOrganizations(Array.isArray(data) ? data : (data.organizations || []));
      }

      if (branchRes.ok) {
        const data = await branchRes.json();
        const list = Array.isArray(data) ? data : (data.branches || []);
        setBranches(list);
        setTotalUnits(list.length);
      }
    } catch (err) {
      console.error("Registry load failure:", err);
    } finally {
      setLoading(false);
    }
  }

  const searchParams = useSearchParams();

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "branches") {
      setView("branches");
      setSelectedInst(null); // Show all branches
    }
  }, [searchParams]);

  useEffect(() => { loadInitialData(); }, []);

  async function handleInstitutionSave(data: any): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
    try {
      const method = editInst ? "PUT" : "POST";
      const url = editInst ? `/employees/institutions/${editInst.id}` : "/employees/institutions";
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setInstModal(false);
        await loadInitialData();
        if (editInst) {
          toast.success("Institution Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
        } else {
          toast.success("Institution Added Successfully", { style: { backgroundColor: '#22c55e', color: '#fff' } });
        }
        return { ok: true };
      }
      if (body?.field_errors) return { ok: false, fieldErrors: body.field_errors };
      if (Array.isArray(body?.detail)) return { ok: false, error: body.detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ') };
      return { ok: false, error: body?.error || 'Failed to save institution' };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  }

  async function handleBranchSave(data: any): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
    try {
      const method = editBranch ? "PUT" : "POST";
      const url = editBranch ? `/employees/branches/${editBranch.branch_id}` : "/employees/branches";
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setBranchModal(false);
        await loadInitialData();
        if (editBranch) {
          toast.success("Branch Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
        } else {
          toast.success("Branch Added Successfully", { style: { backgroundColor: '#22c55e', color: '#fff' } });
        }
        return { ok: true };
      }
      if (body?.field_errors) return { ok: false, fieldErrors: body.field_errors };
      if (Array.isArray(body?.detail)) return { ok: false, error: body.detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ') };
      return { ok: false, error: body?.error || 'Failed to save branch' };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  }

  async function deleteEntity(id: string) {
    if (!confirm("Confirm dissolution?")) return;
    try {
      const res = await fetchWithAuth(`/employees/institutions/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadInitialData();
        toast.success("Institution Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
      }
      else { const b = await res.json().catch(() => ({})); alert(b?.error || 'Failed to delete institution'); }
    } catch { alert('Network error'); }
  }

  async function deleteUnit(id: string) {
    if (!confirm("Confirm decommissioning?")) return;
    try {
      const res = await fetchWithAuth(`/employees/branches/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadInitialData();
        toast.success("Branch Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
      }
      else { const b = await res.json().catch(() => ({})); alert(b?.error || 'Failed to delete branch'); }
    } catch { alert('Network error'); }
  }

  const filtered = institutions.filter(inst =>
    inst.name.toLowerCase().includes(search.toLowerCase()) ||
    inst.inst_code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedBranches = branches.filter(b => b.institution_code === selectedInst?.inst_code);
  const activeUnits = selectedBranches.filter(b => b.status === "active").length;
  const offlineUnits = selectedBranches.filter(b => b.status === "offline").length;

  if (forbidden) return <ProtectedLayout><AccessDenied permission="institution.view" /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <InstitutionModal open={instModal} onClose={() => setInstModal(false)} onSave={handleInstitutionSave} initial={editInst} organizations={organizations} />
      <BranchModal open={branchModal} onClose={() => setBranchModal(false)} onSave={handleBranchSave} initial={editBranch} institutionCode={selectedInst?.inst_code || ''} />

      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-theme-800/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>

     <div className="p-4 sm:p-4 lg:p-6 max-w-400 mx-auto space-y-6 animate-in fade-in duration-700">

        {view === "list" ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm backdrop-blur-md ">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-theme-800 flex items-center justify-center text-white shadow-lg shadow-theme-800/20">
                  <Building2 size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Institutions</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Strategic Command Registry</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <button onClick={() => { setEditInst(null); setInstModal(true); }}
                  className="h-11 px-6 bg-theme-800 text-white rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-theme-900 transition-all shadow-lg shadow-theme-800/20 active:scale-95">
                  <Plus size={16} strokeWidth={3} /> Add Institution
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Institutions', val: institutions.length, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50/50', shadow: 'hover:shadow-purple-500/20', blob: 'bg-purple-500/5' },
                { label: 'Active Institutions', val: institutions.length, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50/50', shadow: 'hover:shadow-emerald-500/20', blob: 'bg-emerald-500/5' },
                { label: 'Total Org.', val: organizations.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50/50', shadow: 'hover:shadow-indigo-500/20', blob: 'bg-indigo-500/5' },
                { label: 'Total Branches', val: totalUnits, icon: GitBranch, color: 'text-blue-600', bg: 'bg-blue-50/50', shadow: 'hover:shadow-blue-500/20', blob: 'bg-blue-500/5' },
              ].map((stat, i) => (
                <div key={i} className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-2xl ${stat.shadow} hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 ${stat.blob} blur-[60px] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150`} />
                  <div className="relative z-10">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">{stat.val}</h3>
                    </div>
                  </div>
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm relative z-10`}>
                    <stat.icon size={24} strokeWidth={2.5} />
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
                  placeholder="Quickly search by name, code, or type..."
                  className="w-full pl-11 pr-4 py-3 border-0 bg-slate-50 rounded-lg text-xs font-bold uppercase tracking-widest placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-theme-800/20 outline-none transition"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {loading ? [1, 2, 3, 4].map(i => <Skeleton key={i} height={180} className="rounded-3xl" />) :
                filtered.map(inst => (
                  <EntityCard key={inst.id} institution={inst} branches={branches.filter(b => b.institution_code === inst.inst_code)}
                    onEdit={(i) => { setEditInst(i); setInstModal(true); }} onDelete={deleteEntity} onViewBranches={(i) => { setSelectedInst(i); setView("branches"); }} />
                ))
              }
            </div>
          </>
        ) : (
          ////Branch main code ////
          <div className="space-y-7 ">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-5">
              <div className="space-y-4">
                <button onClick={() => setView("list")} className="flex items-center gap-2 text-zinc-500 bg-white rounded-2xl p-3 hover:text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] transition-all group py-2">
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back To catalog
                </button>
                <div className="flex items-center gap-5">
                  <div className="h-15 w-15 rounded-2xl bg-theme-800 flex items-center justify-center text-white shadow-2xl shadow-zinc-900/40">
                    <Building2 size={40} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text hover:bg-theme-800uppercase tracking-widest bg-theme-800/10 px-2 py-2 rounded-full border border-theme-800/20">{selectedInst ? selectedInst.inst_type : 'Consolidated'}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{selectedInst ? `ID: ${selectedInst.inst_code}` : 'All Units'}</span>
                    </div>
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase leading-tight">
                      {selectedInst ? selectedInst.name : "Global Deployment"}
                    </h1>
                  </div>
                </div>
              </div>
              <button onClick={() => { setEditBranch(null); setBranchModal(true); }} className="h-14 px-3 bg-theme-800 text-white rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-theme-800 transition-all shadow-2xl active:scale-95">
                <Plus size={20} /> Add New Branch
              </button>
            </div>

            {/* Tactical Deployment Stats */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Operational Units', val: selectedBranches.length, icon: GitBranch, sub: 'Total Base' },
                { label: 'Active Signals', val: activeUnits, icon: CheckCircle2, sub: 'Online' },
                { label: 'Strategic Standby', val: offlineUnits, icon: XCircle, sub: 'Offline' }
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all">
                  <div className="h-12 w-12 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-theme-800 group-hover:text-white transition-all">
                    <s.icon size={24} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{s.label}</p>
                    <h3 className="text-2xl font-black text-zinc-900 tracking-tighter leading-none">{s.val} <span className="text-[10px] text-zinc-300 ml-1">{s.sub}</span></h3>
                  </div>
                </div>
              ))}
            </div> */}

            {/* Tactical Deployment Data Table (Refactored to Row Layout) */}
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-2xl shadow-zinc-200/20">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-100 text-left">
                  <thead>
                    <tr className="bg-zinc-50/50 hover:bg-gray-400">
                      <th className="py-6 px-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Operational Unit</th>
                      <th className="py-6 px-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Deployment Base</th>
                      <th className="py-6 px-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Command Node</th>
                      <th className="py-6 px-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status</th>
                      <th className="py-6 px-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {loading ? [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="p-5">
                          <Skeleton height={20} className="w-full opacity-50" />
                        </td>
                      </tr>
                    )) : (selectedInst ? selectedBranches : branches).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                          <GitBranch size={48} className="mx-auto text-zinc-400 mb-4" />
                          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">No units found in the registry.</p>
                        </td>
                      </tr>
                    ) : (selectedInst ? selectedBranches : branches).map(b => (
                      <tr key={b.branch_id} className="hover:bg-zinc-50/50 transition-all group">
                        <td className="py-6 px-8">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-[#d6d6e2] flex items-center justify-center text-white shadow-lg group-hover:bg-theme-800 transition-all shrink-0">
                              <GitBranch size={20} />
                            </div>
                            <div>
                              <h5 className="text-[13px] font-black text-zinc-900 uppercase tracking-tight leading-tight">{b.branch_name}</h5>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{b.branch_code}</p>
                                {!selectedInst && (
                                  <>
                                    <span className="h-0.5 w-0.5 rounded-full bg-zinc-200" />
                                    <p className="text-[9px] font-black text-theme-800 uppercase tracking-widest">{b.institution_code}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <div className="flex items-center gap-3">
                            <MapPin size={14} className="text-theme-800" />
                            <div>
                              <p className="text-[11px] font-black text-zinc-900 uppercase">{b.city || 'Central'}</p>
                              <p className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-37.5">{b.address}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone size={10} className="text-zinc-300" />
                              <span className="text-[10px] font-black text-zinc-500">{b.contact_number || '--'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail size={10} className="text-zinc-300" />
                              <span className="text-[10px] font-black text-zinc-500 lowercase">{b.email || 'no-email@reg.pk'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${b.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-500'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                            {b.status}
                          </span>
                        </td>
                        <td className="py-6 px-8 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button onClick={() => { setEditBranch(b); setBranchModal(true); }} className="h-9 w-9 flex items-center justify-center bg-white text-zinc-400 rounded-lg hover:bg[#a1a1aa] transition-all border border-zinc-100 shadow-sm">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteUnit(b.branch_id)} className="h-9 w-9 flex items-center justify-center bg-white text-zinc-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-zinc-100 shadow-sm">
                              <Trash2 size={12} />
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
        )}
      </div>
    </ProtectedLayout>
  );
}

// Wrap in Suspense for useSearchParams
export default function SuspendedInstitutionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 animate-pulse" />}>
      <InstitutionsPage />
    </Suspense>
  );
}

