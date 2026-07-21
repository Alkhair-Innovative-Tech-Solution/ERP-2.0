'use client';

import { useState, useEffect } from 'react';
import { organizationAPI } from '@/lib/api';
import { Building2, Plus, Edit2, Trash2, Loader2, Users, School, Globe, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function SuperAdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    max_users: 100,
    max_students: 500,
    max_campuses: 5,
    is_active: true,
  });

  useEffect(() => { fetchOrganizations(); }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await organizationAPI.getAll();
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Organization name is required');
      return;
    }
    try {
      if (editingOrg) {
        await organizationAPI.update(editingOrg.id, formData);
        toast.success('Organization updated');
      } else {
        await organizationAPI.create(formData);
        toast.success('Organization created');
      }
      setShowModal(false);
      setEditingOrg(null);
      fetchOrganizations();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (org: any) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    try {
      await organizationAPI.delete(org.id);
      toast.success('Organization deleted');
      fetchOrganizations();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const openEdit = (org: any) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      subdomain: org.subdomain || '',
      max_users: org.max_users,
      max_students: org.max_students,
      max_campuses: org.max_campuses,
      is_active: org.is_active,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-brand-teal" /> Organizations
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Manage all institutions on the platform</p>
        </div>
        <button onClick={() => { setEditingOrg(null); setFormData({ name: '', subdomain: '', max_users: 100, max_students: 500, max_campuses: 5, is_active: true }); setShowModal(true); }}
          className="flex items-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-lg shadow-brand-teal/20">
          <Plus size={16} /> Add Organization
        </button>
      </div>

      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-teal" /></div>
      ) : organizations.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No organizations yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <div key={org.id} className={cn("premium-card p-5 border-l-4 transition-all hover:shadow-lg cursor-pointer", org.is_active ? "border-l-brand-teal" : "border-l-slate-300 opacity-70")}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", org.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>{org.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2">{org.name}</h3>
                  {org.subdomain && <p className="text-xs text-slate-500 font-bold mt-1"><Globe size={12} className="inline" /> {org.subdomain}.lms</p>}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-slate-500 font-bold"><Users size={12} className="inline" /> {org.max_users} users</span>
                    <span className="text-xs text-slate-500 font-bold"><School size={12} className="inline" /> {org.max_campuses} campuses</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(org)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-brand-teal transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(org)} className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowModal(false); setEditingOrg(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">{editingOrg ? 'Edit Organization' : 'Add Organization'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Subdomain</label>
                <input type="text" value={formData.subdomain} onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Max Users</label>
                  <input type="number" value={formData.max_users} onChange={(e) => setFormData(prev => ({ ...prev, max_users: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Max Students</label>
                  <input type="number" value={formData.max_students} onChange={(e) => setFormData(prev => ({ ...prev, max_students: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Max Campuses</label>
                  <input type="number" value={formData.max_campuses} onChange={(e) => setFormData(prev => ({ ...prev, max_campuses: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setShowModal(false); setEditingOrg(null); }} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">Cancel</button>
              <button onClick={handleSave} className="flex-1 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">{editingOrg ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
