'use client';

import { useState, useEffect } from 'react';
import { feeAPI, courseAPI } from '@/lib/api';
import { Layers, Plus, Edit2, Trash2, Calendar, DollarSign, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface FeeStructure {
  id: string; course_id: string; course_name: string;
  scheduled_class_id: string | null; section_label: string | null;
  scope: string; monthly_maintenance_fee: number; one_time_fee: number;
  payment_plan: string; due_day_of_month: number; require_deposit_paid: boolean;
  is_active: boolean; effective_from: string; effective_to: string | null;
  remarks: string | null;
}

export default function FeeStructuresPage() {
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [formData, setFormData] = useState({
    course_id: '', scheduled_class_id: '', scope: 'course',
    monthly_maintenance_fee: 0, one_time_fee: 0, payment_plan: 'monthly',
    due_day_of_month: 10, require_deposit_paid: true,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '', remarks: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFees(); fetchCourses(); }, []);

  const fetchFees = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      setFees(await feeAPI.getFeeStructures(orgId));
    }
    catch { toast.error('Failed to load fee structures'); }
    finally { setLoading(false); }
  };

  const fetchCourses = async () => {
    try {
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      setCourses(await courseAPI.getAll({ organization_id: orgId }));
    } catch {}
  };

  const handleSave = async () => {
    if (!formData.course_id) { toast.error('Select a course'); return; }
    if (formData.monthly_maintenance_fee <= 0 && formData.one_time_fee <= 0) { toast.error('Set at least one fee amount'); return; }
    setSaving(true);
    try {
      const payload = { ...formData, effective_to: formData.effective_to || null };
      if (editingFee) { await feeAPI.updateFeeStructure(editingFee.id, payload); toast.success('Fee structure updated'); }
      else { await feeAPI.createFeeStructure(payload); toast.success('Fee structure created'); }
      setShowModal(false); setEditingFee(null);
      setFormData({ course_id: '', scheduled_class_id: '', scope: 'course', monthly_maintenance_fee: 0, one_time_fee: 0, payment_plan: 'monthly', due_day_of_month: 10, require_deposit_paid: true, effective_from: new Date().toISOString().split('T')[0], effective_to: '', remarks: '' });
      fetchFees();
    } catch (error: any) { toast.error(error.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (fee: FeeStructure) => {
    if (!confirm('Deactivate this fee rule?')) return;
    try { await feeAPI.deleteFeeStructure(fee.id); toast.success('Fee structure deactivated'); fetchFees(); }
    catch (error: any) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const openEdit = (fee: FeeStructure) => {
    setEditingFee(fee);
    setFormData({ course_id: fee.course_id, scheduled_class_id: fee.scheduled_class_id || '', scope: fee.scope, monthly_maintenance_fee: fee.monthly_maintenance_fee, one_time_fee: fee.one_time_fee, payment_plan: fee.payment_plan, due_day_of_month: fee.due_day_of_month, require_deposit_paid: fee.require_deposit_paid, effective_from: fee.effective_from, effective_to: fee.effective_to || '', remarks: fee.remarks || '' });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingFee(null);
    setFormData({ course_id: '', scheduled_class_id: '', scope: 'course', monthly_maintenance_fee: 0, one_time_fee: 0, payment_plan: 'monthly', due_day_of_month: 10, require_deposit_paid: true, effective_from: new Date().toISOString().split('T')[0], effective_to: '', remarks: '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-brand-teal" /> Fee Structures
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Configure maintenance fees per course or time slot</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-lg shadow-brand-teal/20">
          <Plus size={16} /> Add Fee Rule
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Rules</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{fees.length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</p>
          <p className="text-3xl font-black text-emerald-500 mt-1">{fees.filter(f => f.is_active).length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Course-Level</p>
          <p className="text-3xl font-black text-blue-500 mt-1">{fees.filter(f => f.scope === 'course').length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time-Slot</p>
          <p className="text-3xl font-black text-purple-500 mt-1">{fees.filter(f => f.scope === 'scheduled_class').length}</p>
        </div>
      </div>

      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-teal" /></div>
      ) : fees.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Layers className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No fee rules yet</p>
          <p className="text-slate-400 font-medium mt-1">Create your first maintenance fee configuration</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fees.map((fee) => (
            <div key={fee.id} className={cn("premium-card p-5 border-l-4 transition-all hover:shadow-lg", fee.is_active ? "border-l-brand-teal" : "border-l-slate-300 opacity-70")}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest", fee.scope === 'course' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>{fee.scope === 'course' ? 'Course' : 'Time Slot'}</span>
                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", fee.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>{fee.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-2">{fee.course_name}</h3>
                  {fee.section_label && <p className="text-xs text-slate-500 font-bold mt-1">{fee.section_label}</p>}
                  <div className="mt-3 space-y-1">
                    {fee.monthly_maintenance_fee > 0 && <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><DollarSign size={12} className="text-emerald-500" /> PKR {fee.monthly_maintenance_fee.toLocaleString()}/month</div>}
                    {fee.one_time_fee > 0 && <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><DollarSign size={12} className="text-blue-500" /> PKR {fee.one_time_fee.toLocaleString()} (one-time)</div>}
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Calendar size={12} /> Due: {fee.due_day_of_month}th of month</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Clock size={12} /> From: {fee.effective_from}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => openEdit(fee)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-brand-teal transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(fee)} className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowModal(false); setEditingFee(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-900 mb-6">{editingFee ? 'Edit Fee Rule' : 'Add Fee Rule'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Course</label>
                <select value={formData.course_id} onChange={(e) => setFormData(prev => ({ ...prev, course_id: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.level === 1 ? 'Beginner' : 'Advanced'})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Fee Scope</label>
                  <select value={formData.scope} onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
                    <option value="course">Per Course (all sections)</option>
                    <option value="scheduled_class">Per Time Slot</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Payment Plan</label>
                  <select value={formData.payment_plan} onChange={(e) => setFormData(prev => ({ ...prev, payment_plan: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Monthly Fee (PKR)</label>
                  <input type="number" value={formData.monthly_maintenance_fee} onChange={(e) => setFormData(prev => ({ ...prev, monthly_maintenance_fee: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">One-Time Fee (PKR)</label>
                  <input type="number" value={formData.one_time_fee} onChange={(e) => setFormData(prev => ({ ...prev, one_time_fee: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Due Day of Month</label>
                  <input type="number" min={1} max={28} value={formData.due_day_of_month} onChange={(e) => setFormData(prev => ({ ...prev, due_day_of_month: parseInt(e.target.value) || 10 }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Effective From</label>
                  <input type="date" value={formData.effective_from} onChange={(e) => setFormData(prev => ({ ...prev, effective_from: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-3 h-[46px] bg-slate-50 border-2 border-transparent rounded-xl px-4">
                <input type="checkbox" id="require_deposit" checked={formData.require_deposit_paid} onChange={(e) => setFormData(prev => ({ ...prev, require_deposit_paid: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-brand-teal" />
                <label htmlFor="require_deposit" className="text-xs font-bold text-slate-700 cursor-pointer">Require deposit paid before charging fee</label>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setShowModal(false); setEditingFee(null); }} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving...' : (editingFee ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
