"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import {
  Plus, Search, Edit2, Trash2, X,
  Briefcase, CheckCircle2, XCircle, Star
} from "lucide-react";

type Designation = {
  id: string;
  position_code: string;
  position_name: string;
  department__dept_code?: string;
  department_code?: string;
};

type Department = {
  dept_code: string;
  dept_name: string;
};

const DEPARTMENTS: Department[] = [
  { dept_name: "Academic", dept_code: "AIT" },
  { dept_name: "Health care", dept_code: "EDHI02" },
  { dept_name: "Food", dept_code: "SMIT03" },
  { dept_name: "IT Dept", dept_code: "BQ01" },
  { dept_name: "Test", dept_code: "TEST01" },
];

const Skeleton = ({ className, height, width }: any) => (
  <div className={`animate-pulse bg-zinc-100 rounded-xl ${className}`} style={{ height, width }} />
);

function DesignationModal({ open, onClose, onSave, initial }: {
  open: boolean; onClose: () => void;
  onSave: (d: any) => void; initial?: Designation | null;
}) {
  const empty = { position_name: "", position_code: "", department_code: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => { 
    setForm(initial ? { 
      position_name: initial.position_name, 
      position_code: initial.position_code, 
      department_code: initial.department__dept_code || initial.department_code || "" 
    } : empty); 
  }, [initial, open]);

  if (!open) return null;

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{initial ? "Edit Designation" : "Add Designation"}</h2>
            <p className="text-sm text-slate-400 mt-0.5">Fill in the position details.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Position Name</label>
            <input type="text" placeholder="Enter position name" value={form.position_name} onChange={f('position_name')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Position Code</label>
              <input type="text" placeholder="Short code" value={form.position_code} onChange={f('position_code')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select value={form.department_code} onChange={f('department_code')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white">
                <option value="">Select Department</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept.dept_code} value={dept.dept_code}>
                    {dept.dept_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }}
            className="w-full sm:w-auto px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md transition active:scale-95">
            {initial ? "Save Changes" : "Add Designation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Designation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/employees/designations');
      if (res.ok) {
        const data = await res.json();
        setDesignations(Array.isArray(data) ? data : (data.designations || []));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setDesignations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = (Array.isArray(designations) ? designations : []).filter(d =>
    ((d.position_name || '').toLowerCase().includes(search.toLowerCase()) ||
     (d.position_code || '').toLowerCase().includes(search.toLowerCase()))
  );

  const stats = [
    { label: "Total Designations", value: designations.length, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Frameworks", value: designations.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Departments", value: new Set(designations.map(d => d.department__dept_code || d.department_code)).size, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "System Nodes", value: designations.length, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  async function handleSave(data: any) {
    try {
      const url = editTarget ? `/employees/designations/${editTarget.id}` : '/employees/designations';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(data) });
      if (res.ok) loadData();
    } catch (err) {
      console.error("Save failed:", err);
    }
    setEditTarget(null);
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetchWithAuth(`/employees/designations/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteId(null);
  }

  return (
    <ProtectedLayout>
      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 /></div>
            <h3 className="text-lg font-semibold text-slate-900">Delete Record?</h3>
            <p className="text-sm text-slate-500 mt-1">This entry will be removed from the framework.</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      <DesignationModal 
        open={modalOpen} 
        onClose={() => { setModalOpen(false); setEditTarget(null); }} 
        onSave={handleSave} 
        initial={editTarget} 
      />

      <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1600px] mx-auto space-y-8 sm:space-y-12 animate-in fade-in duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-zinc-100 pb-8 sm:pb-12">
          <div className="space-y-2 sm:space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-zinc-900 leading-none lowercase">
              positional framework
            </h1>
            <p className="text-[9px] sm:text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] sm:tracking-[0.5em] italic opacity-60">
              job titles, roles & authority levels
            </p>
          </div>
          <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="w-full lg:w-auto h-14 sm:h-16 px-6 sm:px-10 bg-zinc-900 text-white rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-xl"
          >
            <Plus size={18} strokeWidth={3} /> Add Designation
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-white p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
              <div className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl ${s.bg} ${s.color} transition-transform group-hover:scale-110`}>
                <s.icon size={20} strokeWidth={2.5} className="sm:w-6 sm:h-6" />
              </div>
              <div className="relative z-10">
                <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{s.label}</p>
                {loading ? <Skeleton width="40%" height={32} /> : (
                  <h3 className="text-2xl sm:text-4xl font-black text-zinc-900 tracking-tighter leading-none">{s.value}</h3>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-xl shadow-zinc-200/10">
          <div className="relative group">
            <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
            <input
              type="text"
              placeholder="search by title or code..."
              className="w-full pl-12 sm:pl-14 pr-6 py-4 sm:py-5 bg-zinc-50/50 border border-transparent focus:border-zinc-200 focus:bg-white rounded-[1rem] sm:rounded-[1.5rem] text-[10px] sm:text-xs font-black text-zinc-900 uppercase tracking-widest outline-none transition-all shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table/List Segment */}
        <div className="relative pb-10">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[3rem] border border-zinc-100 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-50/50 text-left">
                <thead>
                  <tr className="bg-zinc-50/30">
                    <th className="py-6 sm:py-8 px-6 sm:px-8 text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Position / Title</th>
                    <th className="hidden md:table-cell py-8 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Registry Code</th>
                    <th className="py-6 sm:py-8 px-6 sm:px-8 text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Dept</th>
                    <th className="py-6 sm:py-8 px-6 sm:px-8 text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50/50">
                  {loading ? [...Array(3)].map((_, i) => (
                    <tr key={i}><td colSpan={4} className="p-8"><Skeleton height={24} className="w-full" /></td></tr>
                  )) : filtered.map(d => (
                    <tr key={d.id} className="hover:bg-zinc-50/60 transition-all group">
                      <td className="p-6 sm:p-8">
                        <div className="flex items-center gap-3 sm:gap-5">
                          <div className="hidden xs:flex h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-zinc-900 items-center justify-center text-white text-xs sm:text-sm font-black transition-transform group-hover:rotate-6">
                            {d.position_name?.charAt(0)}
                          </div>
                          <div>
                            <h5 className="text-xs sm:text-sm font-black text-zinc-900 uppercase tracking-tight leading-tight">{d.position_name}</h5>
                            <p className="md:hidden text-[8px] font-mono text-blue-600 mt-1 uppercase">{d.position_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell p-8">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100/50 tracking-widest font-mono">
                          {d.position_code}
                        </span>
                      </td>
                      <td className="p-6 sm:p-8">
                        <span className="px-3 sm:px-4 py-1 sm:py-1.5 bg-zinc-50 text-zinc-900 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-zinc-100 shadow-sm inline-block whitespace-nowrap">
                          {DEPARTMENTS.find(dept => dept.dept_code === (d.department__dept_code || d.department_code))?.dept_name || '—'}
                        </span>
                      </td>
                      <td className="p-6 sm:p-8 text-right">
                        <div className="flex justify-end gap-2 sm:gap-3 lg:opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditTarget(d); setModalOpen(true); }} className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-lg sm:rounded-xl hover:bg-zinc-900 hover:text-white transition-all">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setDeleteId(d.id)} className="h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-zinc-50 text-zinc-400 rounded-lg sm:rounded-xl hover:bg-rose-600 hover:text-white transition-all">
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
      </div>
    </ProtectedLayout>
  );
}