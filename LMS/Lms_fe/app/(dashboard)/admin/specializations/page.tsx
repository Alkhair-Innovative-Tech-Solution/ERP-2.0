'use client';
// Trigger re-compile

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Layout,
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Loader2,
    CheckCircle2,
    Clock,
    Layers,
    Activity,
    Target,
    Settings2,
    ChevronDown,
    Filter
} from 'lucide-react';
import { courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Types
interface Specialization {
    id: string;
    name: string;
    description: string;
    active: boolean;
    organization_id?: string;
}

export default function SpecializationManagementPage() {
    const [specializations, setSpecializations] = useState<Specialization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingSpec, setEditingSpec] = useState<Specialization | null>(null);
    const [mounted, setMounted] = useState(false); // needed for portal (SSR-safe)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        active: true,
    });

    useEffect(() => {
        setMounted(true);
        fetchSpecializations();
    }, []);

    const fetchSpecializations = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const specData: any = await courseAPI.getSpecializations(orgId);
            setSpecializations(Array.isArray(specData) ? specData : []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSpec = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await courseAPI.createSpecialization(formData);
            toast.success('Specialization created successfully!');
            setIsAddModalOpen(false);
            fetchSpecializations();
            resetForm();
        } catch (error: any) {
            toast.error('Failed to create specialization');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSpec = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSpec) return;
        try {
            setIsSubmitting(true);
            await courseAPI.updateSpecialization(editingSpec.id, formData);
            toast.success('Specialization updated successfully!');
            setIsEditModalOpen(false);
            setEditingSpec(null);
            fetchSpecializations();
            resetForm();
        } catch (error: any) {
            toast.error('Failed to update specialization');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSpec = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this specialization?')) return;
        try {
            await courseAPI.deleteSpecialization(id);
            toast.success('Specialization deactivated successfully');
            fetchSpecializations();
        } catch (error) {
            toast.error('Failed to deactivate specialization');
        }
    };

    const openEditModal = (spec: Specialization) => {
        setEditingSpec(spec);
        setFormData({
            name: spec.name,
            description: spec.description,
            active: spec.active,
        });
        setIsEditModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            active: true,
        });
    };

    const filteredSpecs = specializations.filter((s: Specialization) =>
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning Sectors...</p>
            </div>
        );
    }

    // Modal JSX extracted so we can push it into a portal
    const modalContent = (isAddModalOpen || isEditModalOpen) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}></div>
            <div className="relative bg-white w-full max-w-xl rounded-[32px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 border border-white max-h-[95vh] overflow-y-auto">

                <div className="flex items-start justify-between mb-10">
                    <div>
                        <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Grid Configuration</p>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                            {isEditModalOpen ? 'Modify Sector' : 'Initialize Domain'}
                        </h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">Configure academic specialization and metadata properties.</p>
                    </div>
                    <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={isEditModalOpen ? handleEditSpec : handleAddSpec} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sector Nomenclature</label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. Full Stack Engineering Systems"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sector Abstract (Description)</label>
                        <textarea
                            required
                            rows={4}
                            placeholder="Define the scope and disciplinary bounds of this category..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all resize-none min-h-[120px]"
                        />
                    </div>

                    <div className="flex items-center gap-4 pt-2 pl-1">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.active}
                              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                              className="peer w-6 h-6 opacity-0 absolute cursor-pointer"
                            />
                            <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 peer-checked:bg-brand-teal peer-checked:border-brand-teal transition-all flex items-center justify-center">
                               <CheckCircle2 color="white" size={14} className={cn("transition-opacity", formData.active ? "opacity-100" : "opacity-0")} />
                            </div>
                          </div>
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-brand-teal transition-colors">Operational Deployment</span>
                        </label>
                    </div>

                    <div className="flex gap-4 pt-10">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                            className="flex-1 rounded-2xl h-14 font-bold text-slate-500 border-slate-200 hover:bg-slate-50 transition-all uppercase text-[11px] tracking-[0.1em]"
                        >
                            Cancel Request
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 font-black shadow-xl shadow-brand-teal/20 transition-all flex items-center justify-center"
                        >
                            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (isEditModalOpen ? 'Commit Configuration' : 'Initialize Domain')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    ) : null;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Layers className="w-7 h-7 text-brand-teal" />
                        Academic Sectors
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Manage disciplinary specializations and curriculum grouping.</p>
                </div>
                <div className="flex items-center gap-3">
                   <Button
                        onClick={fetchSpecializations}
                        variant="outline"
                        className="rounded-2xl border-slate-200 h-11 px-5 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                   >
                        Refresh Directory
                   </Button>
                   <Button
                        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 px-6 font-bold shadow-lg shadow-brand-teal/20 flex gap-2"
                   >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Initialize New Sector
                   </Button>
                </div>
            </div>

            {/* Intelligence Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Total Domain Index', val: specializations.length, icon: Layers, color: 'blue' },
                  { label: 'Active Curricula', val: specializations.filter(s => s.active).length, icon: Activity, color: 'teal' },
                  { label: 'Archived Sectors', val: specializations.filter(s => !s.active).length, icon: Clock, color: 'orange' },
                ].map((s, idx) => (
                  <Card key={idx} className="premium-card p-6 flex items-center gap-5 group border-none shadow-premium">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 duration-500 shadow-sm",
                      s.color === 'blue' ? "bg-blue-50 text-blue-600" :
                      s.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" : "bg-amber-50 text-amber-600"
                    )}>
                      <s.icon size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</h3>
                    </div>
                  </Card>
                ))}
            </div>

            {/* Search & Registry Filter */}
            <div className="premium-card p-4 flex flex-col md:flex-row gap-4 items-center border-none shadow-premium bg-slate-50/50">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                    <input
                        type="text"
                        placeholder="Search sectors by identity or abstract..."
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
                    />
                </div>
                <Button variant="outline" className="rounded-2xl h-11 border-slate-200 px-5 flex gap-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                     <Filter className="w-3.5 h-3.5" /> Registry Filter
                </Button>
            </div>

            {/* Registry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredSpecs.length === 0 ? (
                    <div className="col-span-full premium-card border-dashed py-24 flex flex-col items-center justify-center text-center bg-slate-50/30">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-300">
                            <Target className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Search Result Null</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2 italic">No sectors matched your current identity filters.</p>
                        <Button variant="ghost" onClick={() => setSearchTerm('')} className="mt-4 text-brand-teal font-black uppercase text-[10px] tracking-widest">Clear Query</Button>
                    </div>
                ) : (
                    filteredSpecs.map((spec: Specialization) => (
                        <div key={spec.id} className="premium-card p-8 group overflow-hidden border-none shadow-premium flex flex-col hover:-translate-y-1 transition-all">
                            <div className="flex items-start justify-between mb-6">
                                <div className="min-w-0">
                                   <div className="flex items-center gap-2 mb-2">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", spec.active ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                                      <span className={cn("text-[9px] font-black uppercase tracking-widest", spec.active ? "text-emerald-700" : "text-slate-400")}>
                                         {spec.active ? 'Operational' : 'Archived'}
                                      </span>
                                      {spec.organization_id && (
                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                          Org: {spec.organization_id.slice(0, 8)}...
                                        </span>
                                      )}
                                   </div>
                                   <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-brand-teal transition-colors">{spec.name}</h3>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-brand-teal/10 group-hover:text-brand-teal transition-all">
                                   <Layers size={18} />
                                </div>
                            </div>

                            <p className="text-sm font-medium text-slate-400 line-clamp-3 mb-8 leading-relaxed flex-1 italic">
                                {spec.description || 'No sectoral abstract provided.'}
                            </p>

                            <div className="flex items-center justify-between pt-6 border-t border-slate-100/50">
                                <div className="flex items-center gap-2">
                                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Entity ID</span>
                                   <span className="px-1.5 py-0.5 rounded-md bg-slate-50 text-[10px] font-bold text-slate-500">#{spec.id?.slice(-4).toUpperCase()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost" size="icon"
                                        onClick={() => openEditModal(spec)}
                                        className="text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded-xl transition-all w-9 h-9"
                                    >
                                        <Edit size={16} />
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon"
                                        onClick={() => handleDeleteSpec(spec.id)}
                                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all w-9 h-9"
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal rendered via portal -> escapes any parent transform/filter/stacking context
                so the blur overlay always covers the FULL viewport including header/sidebar */}
            {mounted && modalContent && createPortal(modalContent, document.body)}
        </div>
    );
}