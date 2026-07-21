'use client';

import { useState, useEffect } from 'react';
import {
  Layers, Plus, Search, Edit, Trash2, X, Loader2,
  ChevronDown, Calendar, Users, Hash, RefreshCcw,
  BarChart3, CheckCircle2, GitBranch
} from 'lucide-react';
import { batchAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function BatchManagementPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const data = await batchAPI.getAll(orgId);
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', start_date: '', end_date: '', is_active: true });
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch: any) => {
    setFormData({
      name: batch.name || '',
      start_date: batch.start_date || '',
      end_date: batch.end_date || '',
      is_active: batch.is_active !== false,
    });
    setEditingId(batch.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (isEditMode && editingId) {
        await batchAPI.update(editingId, formData);
        toast.success('Batch updated successfully');
      } else {
        await batchAPI.create(formData);
        toast.success('Batch created successfully');
      }
      setIsModalOpen(false);
      fetchBatches();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Operation failed';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this batch?')) return;
    try {
      await batchAPI.delete(id);
      toast.success('Batch deleted successfully');
      setBatches(batches.filter(b => b.id !== id));
    } catch (error) {
      toast.error('Failed to delete batch');
    }
  };

  const filteredBatches = batches.filter(b =>
    b.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedData, sortConfig, requestSort } = useSortableData(filteredBatches);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Batches...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-brand-teal" />
            Batch Management
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Organize and manage academic batches across all programs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchBatches}
            variant="outline"
            className="rounded-2xl border-slate-200 h-11 px-5 font-bold text-slate-600 hover:bg-slate-50 flex gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 px-6 font-bold shadow-lg shadow-brand-teal/20 flex gap-2"
          >
            <Plus className="w-5 h-5" /> Create Batch
          </Button>
        </div>
      </div>

      {/* â”€â”€ Stats â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Batches', val: batches.length, icon: Layers, color: 'blue' },
          { label: 'Active', val: batches.filter(b => b.is_active).length, icon: CheckCircle2, color: 'emerald' },
          { label: 'Inactive', val: batches.filter(b => !b.is_active).length, icon: Hash, color: 'slate' },
        ].map((s, idx) => (
          <div key={idx} className="premium-card p-6 flex items-center gap-5 group">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 duration-500 shadow-sm",
              s.color === 'blue' ? "bg-blue-50 text-blue-600" :
              s.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-700"
            )}>
              <s.icon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Search + Table â”€â”€ */}
      <div className="premium-card overflow-hidden flex flex-col border-none shadow-premium">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
            <input
              placeholder="Search batches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <SortableTableHeader label="Batch Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Start Date" sortKey="start_date" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="End Date" sortKey="end_date" currentSort={sortConfig} onSort={requestSort} />
                <SortableTableHeader label="Status" sortKey="is_active" currentSort={sortConfig} onSort={requestSort} />
                <th className="text-right p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center text-slate-300 gap-3">
                      <Layers size={40} strokeWidth={1} />
                      <p className="text-sm font-black uppercase tracking-widest">No batches found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((batch, idx) => (
                  <tr key={batch.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center font-black text-sm">
                          {batch.name?.[0]?.toUpperCase() || 'B'}
                        </div>
                        <span className="font-bold text-slate-900">{batch.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-600">{batch.start_date || 'â€”'}</td>
                    <td className="p-4 text-sm font-semibold text-slate-600">{batch.end_date || 'â€”'}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
                        batch.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {batch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEdit(batch)} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(batch.id)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-all">
                          <Trash2 size={14} />
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

      {/* â”€â”€ Modal â”€â”€ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 border border-white">
            
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Batch Configuration</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                  {isEditMode ? 'Edit Batch' : 'New Batch'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Batch Name</label>
                <input
                  required
                  placeholder="e.g., Batch 14, Morning Batch"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status</label>
                <div className="flex items-center gap-3 h-[46px] bg-slate-50 border border-slate-200 rounded-2xl px-4">
                  <input
                    type="checkbox"
                    id="batch_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                  />
                  <label htmlFor="batch_active" className="text-sm font-bold text-slate-700 cursor-pointer">
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl h-12 font-bold text-slate-500 border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-12 font-black shadow-xl shadow-brand-teal/20"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> <span>Saving...</span>
                    </div>
                  ) : (isEditMode ? 'Update Batch' : 'Create Batch')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
