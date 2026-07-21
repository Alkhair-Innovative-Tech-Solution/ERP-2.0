'use client';

import { X, Loader2, ShieldCheck, Users, Mail, CreditCard, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProcessAdmissionModalProps {
    showAddModal: boolean;
    setShowAddModal: (val: boolean) => void;
    handleAddReceipt: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (val: any) => void;
    courses: any[];
    isSubmitting: boolean;
    isEditMode: boolean;
    isCurrentTestNotRequired: boolean;
}

export function ProcessAdmissionModal({
    showAddModal,
    setShowAddModal,
    handleAddReceipt,
    formData,
    setFormData,
    courses,
    isSubmitting,
    isEditMode,
    isCurrentTestNotRequired
}: ProcessAdmissionModalProps) {
    if (!showAddModal) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" 
                onClick={() => setShowAddModal(false)}
            ></div>
            <div className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-3xl p-0 animate-in zoom-in-95 duration-500 border border-white group/modal overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header Stripe */}
                <div className="h-2 bg-gradient-to-r from-brand-teal via-blue-500 to-brand-teal animate-shimmer bg-[length:200%_100%]" />
                
                <div className="p-10 md:p-12 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex items-start justify-between mb-12">
                        <div>
                            <p className="text-brand-teal font-black tracking-[0.2em] text-[11px] uppercase mb-1">Admissions Architect</p>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
                                {isEditMode ? 'Modify Admission' : 'Authorize Admission'}
                            </h2>
                            <p className="text-slate-700 font-medium text-sm mt-1">Configure institutional registration codes and financial commitments.</p>
                        </div>
                        <button 
                            onClick={() => setShowAddModal(false)} 
                            className="w-14 h-14 flex items-center justify-center rounded-[24px] bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all hover:rotate-90"
                        >
                            <X size={28} />
                        </button>
                    </div>

                    <form onSubmit={handleAddReceipt} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 mb-4 flex items-center gap-2">
                                    <Users size={12} /> Candidate Profile Protocols
                                </p>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Unique Receipt Identification</label>
                                        <input 
                                            required 
                                            type="text" 
                                            placeholder="e.g. RCP-26-001" 
                                            value={formData.code} 
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all font-mono uppercase"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Scholar Full Name</label>
                                        <input 
                                            required 
                                            type="text" 
                                            placeholder="Institutional Name" 
                                            value={formData.student_name} 
                                            onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-tight"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Communication Channel (Email)</label>
                                        <div className="relative">
                                             <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                             <input 
                                                required 
                                                type="email" 
                                                placeholder="scholar@domain.edu" 
                                                value={formData.student_email} 
                                                onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                             />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Receipt Reference Number</label>
                                        <input 
                                            type="text" 
                                            placeholder="AIT-DEP-XXXX" 
                                            value={formData.receipt_number || ''} 
                                            onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-widest"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest pl-1 mb-4 flex items-center gap-2">
                                    <CreditCard size={12} /> Curricular & Fiscal Configuration
                                </p>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Course Assignment</label>
                                            <div className="relative">
                                                <select 
                                                    required 
                                                    value={formData.course_id} 
                                                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                                    className="w-full pl-6 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer uppercase tracking-tight"
                                                >
                                                    <option value="" disabled>Query Registry...</option>
                                                    {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Compliance Score</label>
                                            <input 
                                                required={!isCurrentTestNotRequired} 
                                                disabled={isCurrentTestNotRequired} 
                                                type="text" 
                                                placeholder={isCurrentTestNotRequired ? "EXEMPT" : "VAL_INDEX (%)"} 
                                                value={isCurrentTestNotRequired ? 'EXEMPTED' : formData.test_score} 
                                                onChange={(e) => setFormData({ ...formData, test_score: e.target.value })}
                                                className={cn(
                                                    "w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-brand-teal/10 transition-all uppercase tracking-widest",
                                                    isCurrentTestNotRequired ? "text-slate-300 italic bg-slate-100" : "text-slate-900"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Primary Security Deposit (PKR)</label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className={cn("w-4 h-4 rounded border transition-all flex items-center justify-center", formData.is_waived ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
                                                    {formData.is_waived && <Check size={10} className="text-white" />}
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    className="hidden" 
                                                    checked={formData.is_waived} 
                                                    onChange={e => setFormData({ ...formData, is_waived: e.target.checked, deposit_amount: e.target.checked ? 0 : 3000 })} 
                                                />
                                                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-emerald-600">Apply Financial Aid Waiver</span>
                                            </label>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">PKR</div>
                                            <input 
                                                type="number" 
                                                required 
                                                disabled={formData.is_waived} 
                                                value={formData.deposit_amount} 
                                                onChange={e => setFormData({ ...formData, deposit_amount: Number(e.target.value) })} 
                                                className={cn(
                                                    "w-full pl-14 pr-6 py-4 bg-white border-2 rounded-2xl text-xl font-black transition-all font-sans",
                                                    formData.is_waived ? "border-emerald-100 bg-emerald-50/30 text-emerald-600" : "border-slate-100 text-slate-900 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Supplementary Inventory & IDs</p>
                                        
                                        <div className="grid grid-cols-1 gap-3">
                                            {/* Institutional Gear Card */}
                                            <div className={cn(
                                                "p-5 rounded-[24px] border-2 transition-all duration-500",
                                                formData.bag_taken ? "bg-white border-blue-100 shadow-xl shadow-blue-500/5" : "bg-slate-50/50 border-slate-100 opacity-60"
                                            )}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                            formData.bag_taken ? "bg-blue-500 border-blue-500" : "bg-white border-slate-200"
                                                        )}>
                                                            {formData.bag_taken && <Check size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.bag_taken} onChange={e => setFormData({ ...formData, bag_taken: e.target.checked })} />
                                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Institutional Gear</span>
                                                    </label>
                                                    
                                                    {formData.bag_taken && (
                                                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                            {[
                                                                { id: 'pending', label: 'Pending', active: !formData.bag_paid && !formData.bag_waived, color: 'text-rose-600' },
                                                                { id: 'paid', label: 'Paid', active: formData.bag_paid && !formData.bag_waived, color: 'text-blue-600' },
                                                                { id: 'waived', label: 'Waived', active: formData.bag_waived, color: 'text-emerald-600' }
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (opt.id === 'waived') setFormData({ ...formData, bag_waived: true, bag_paid: false });
                                                                        else if (opt.id === 'paid') setFormData({ ...formData, bag_waived: false, bag_paid: true });
                                                                        else setFormData({ ...formData, bag_waived: false, bag_paid: false });
                                                                    }}
                                                                    className={cn(
                                                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                                        opt.active ? "bg-white shadow-sm " + opt.color : "text-slate-600 hover:text-slate-600"
                                                                    )}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {formData.bag_taken && !formData.bag_waived && (
                                                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Item Cost (PKR)</p>
                                                            <input 
                                                                type="number" 
                                                                value={formData.bag_fee} 
                                                                onChange={e => setFormData({ ...formData, bag_fee: Number(e.target.value) })} 
                                                                className="w-full bg-transparent text-lg font-black text-blue-600 outline-none"
                                                            />
                                                        </div>
                                                        <div className="px-4 py-2 bg-blue-50 rounded-xl">
                                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Status</p>
                                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{formData.bag_paid ? "Received" : "To Deduct"}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {formData.bag_taken && formData.bag_waived && (
                                                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Institutional Contribution Applied (Waived)</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* LMS Identifier Card */}
                                            <div className={cn(
                                                "p-5 rounded-[24px] border-2 transition-all duration-500",
                                                formData.id_card_taken ? "bg-white border-indigo-100 shadow-xl shadow-indigo-500/5" : "bg-slate-50/50 border-slate-100 opacity-60"
                                            )}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                                            formData.id_card_taken ? "bg-indigo-500 border-indigo-500" : "bg-white border-slate-200"
                                                        )}>
                                                            {formData.id_card_taken && <Check size={14} className="text-white" />}
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={formData.id_card_taken} onChange={e => setFormData({ ...formData, id_card_taken: e.target.checked })} />
                                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">LMS Identifier</span>
                                                    </label>
                                                    
                                                    {formData.id_card_taken && (
                                                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                            {[
                                                                { id: 'pending', label: 'Pending', active: !formData.id_card_paid && !formData.id_card_waived, color: 'text-rose-600' },
                                                                { id: 'paid', label: 'Paid', active: formData.id_card_paid && !formData.id_card_waived, color: 'text-indigo-600' },
                                                                { id: 'waived', label: 'Waived', active: formData.id_card_waived, color: 'text-emerald-600' }
                                                            ].map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (opt.id === 'waived') setFormData({ ...formData, id_card_waived: true, id_card_paid: false });
                                                                        else if (opt.id === 'paid') setFormData({ ...formData, id_card_waived: false, id_card_paid: true });
                                                                        else setFormData({ ...formData, id_card_waived: false, id_card_paid: false });
                                                                    }}
                                                                    className={cn(
                                                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                                                        opt.active ? "bg-white shadow-sm " + opt.color : "text-slate-600 hover:text-slate-600"
                                                                    )}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {formData.id_card_taken && !formData.id_card_waived && (
                                                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">ID Card Fee (PKR)</p>
                                                            <input 
                                                                type="number" 
                                                                value={formData.id_card_fee} 
                                                                onChange={e => setFormData({ ...formData, id_card_fee: Number(e.target.value) })} 
                                                                className="w-full bg-transparent text-lg font-black text-indigo-600 outline-none"
                                                            />
                                                        </div>
                                                        <div className="px-4 py-2 bg-indigo-50 rounded-xl">
                                                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Status</p>
                                                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{formData.id_card_paid ? "Received" : "To Deduct"}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {formData.id_card_taken && formData.id_card_waived && (
                                                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Institutional Contribution Applied (Waived)</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-4 pt-10 border-t border-slate-100 px-10 pb-10">
                            <Button 
                                type="button" 
                                onClick={() => setShowAddModal(false)} 
                                className="h-16 px-10 rounded-[28px] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest border-none transition-all"
                            >
                                Void Protocol
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSubmitting} 
                                className="h-16 px-12 rounded-[28px] bg-brand-teal hover:bg-brand-dark text-white font-black shadow-2xl shadow-brand-teal/20 uppercase text-[11px] tracking-[0.2em] flex items-center gap-3 min-w-[240px] disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ShieldCheck size={24} />}
                                {isSubmitting ? 'SECURE_SYNERGY...' : (isEditMode ? 'Modify Registry' : 'Authorize Admission')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}