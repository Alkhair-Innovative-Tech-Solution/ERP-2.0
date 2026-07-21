'use client';

import { useState, useEffect } from 'react';
import { branchAPI } from '@/lib/api';
import { Building2, Plus, Edit2, Trash2, MapPin, Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', address: '', city: 'Karachi', contact_phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await branchAPI.getAll();
      setBranches(data);
    } catch (error) {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Code and Name are required');
      return;
    }
    setSaving(true);
    try {
      if (editingBranch) {
        await branchAPI.update(editingBranch.id, formData);
        toast.success('Branch updated');
      } else {
        await branchAPI.create(formData);
        toast.success('Branch created');
      }
      setShowModal(false);
      setEditingBranch(null);
      setFormData({ code: '', name: '', address: '', city: 'Karachi', contact_phone: '' });
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Delete "${branch.name}"? This cannot be undone if the branch has no users.`)) return;
    try {
      await branchAPI.delete(branch.id);
      toast.success('Branch deleted');
      fetchBranches();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete branch');
    }
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      address: branch.address || '',
      city: branch.city || 'Karachi',
      contact_phone: branch.contact_phone || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingBranch(null);
    setFormData({ code: '', name: '', address: '', city: 'Karachi', contact_phone: '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-brand-teal" />
            Branch Management
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Manage campus locations and branch assignments</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-lg shadow-brand-teal/20"
        >
          <Plus size={16} /> Add Branch
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Branches</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{branches.length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</p>
          <p className="text-3xl font-black text-emerald-500 mt-1">{branches.filter(b => b.is_active).length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inactive</p>
          <p className="text-3xl font-black text-rose-500 mt-1">{branches.filter(b => !b.is_active).length}</p>
        </div>
      </div>

      {/* Branch List */}
      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        </div>
      ) : branches.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No branches yet</p>
          <p className="text-slate-400 font-medium mt-1">Add your first campus location</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <div key={branch.id} className={cn(
              "premium-card p-5 border-l-4 transition-all hover:shadow-lg",
              branch.is_active ? "border-l-brand-teal" : "border-l-slate-300 opacity-70"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-brand-teal bg-brand-teal/5 px-2 py-0.5 rounded uppercase tracking-widest border border-brand-teal/10">
                      {branch.code}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      branch.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2">{branch.name}</h3>
                  {branch.address && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 font-bold">
                      <MapPin size={12} className="text-brand-teal" />
                      {branch.address}
                    </div>
                  )}
                  {branch.contact_phone && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-bold">
                      <Phone size={12} className="text-brand-teal" />
                      {branch.contact_phone}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(branch)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-brand-teal transition-all"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(branch)}
                    className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowModal(false); setEditingBranch(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">
              {editingBranch ? 'Edit Branch' : 'Add New Branch'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Branch Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="PH"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Karachi"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Branch Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Power House"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+92-XXX-XXXXXXX"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => { setShowModal(false); setEditingBranch(null); }}
                className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving...' : (editingBranch ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
