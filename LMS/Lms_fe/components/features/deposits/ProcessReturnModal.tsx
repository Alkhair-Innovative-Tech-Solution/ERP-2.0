'use client';

import { X, Loader2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReceiptCode } from '@/app/(dashboard)/admin/deposits/page';

interface ProcessReturnModalProps {
    showReturnModal: ReceiptCode | null;
    setShowReturnModal: (val: ReceiptCode | null) => void;
    handleProcessReturn: (e: React.FormEvent) => void;
    returnRemarks: string;
    setReturnRemarks: (val: string) => void;
    isSubmitting: boolean;
}

export function ProcessReturnModal({
    showReturnModal,
    setShowReturnModal,
    handleProcessReturn,
    returnRemarks,
    setReturnRemarks,
    isSubmitting
}: ProcessReturnModalProps) {
    if (!showReturnModal) return null;

    const d = showReturnModal;
    let deductions = 0;
    // Only deduct if the student hasn't already paid for the item upfront and it wasn't waived
    if (d.bag_taken && !d.bag_paid && !d.bag_waived) deductions += (d.bag_fee || 0);
    if (d.id_card_taken && !d.id_card_paid && !d.id_card_waived) deductions += (d.id_card_fee || 0);
    if (d.certificate_taken && !d.certificate_paid && !d.certificate_waived) deductions += (d.certificate_fee || 0);
    
    const refundAmount = Math.max(0, (d.deposit_amount || 0) - deductions);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowReturnModal(null)}></div>
            <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
                <div className="absolute inset-x-0 top-0 h-2 bg-brand-teal opacity-40" />
                
                <div className="p-10 md:p-12">
                    <div className="flex items-start justify-between mb-10">
                        <div>
                            <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Settlement Controller</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                                Process Refund
                            </h2>
                            <p className="text-slate-700 font-medium text-sm mt-1">Institutional deposit liquidation for {d.student_name}.</p>
                        </div>
                        <button onClick={() => setShowReturnModal(null)} className="p-3 hover:bg-slate-50 text-slate-300 hover:text-slate-600 rounded-2xl transition-all">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="space-y-4 mb-10 bg-slate-900 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-teal/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                        
                        <div className="flex justify-between items-center text-slate-600 text-[10px] font-black uppercase tracking-widest border-b border-slate-800 pb-4">
                            <span>Primary Vault Deposit</span>
                            <span className={cn("text-base", d.is_waived ? "text-emerald-400" : "text-white")}>
                                {d.is_waived ? "WAIVED / AID" : `PKR ${d.deposit_amount?.toLocaleString()}`}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {d.bag_taken && (
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-slate-600 uppercase tracking-widest">Institutional Gear</span>
                                    <span className={d.bag_waived || d.bag_paid ? "text-emerald-400" : "text-rose-400"}>
                                        {d.bag_waived ? "Waived" : d.bag_paid ? "Paid Upfront" : `Pending -${d.bag_fee}`}
                                    </span>
                                </div>
                            )}
                            {d.id_card_taken && (
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-slate-600 uppercase tracking-widest">LMS Identification</span>
                                    <span className={d.id_card_waived || d.id_card_paid ? "text-emerald-400" : "text-rose-400"}>
                                        {d.id_card_waived ? "Waived" : d.id_card_paid ? "Paid Upfront" : `Pending -${d.id_card_fee}`}
                                    </span>
                                </div>
                            )}
                            {d.certificate_taken && (
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-slate-600 uppercase tracking-widest">Certificate</span>
                                    <span className={d.certificate_waived || d.certificate_paid ? "text-emerald-400" : "text-rose-400"}>
                                        {d.certificate_waived ? "Waived" : d.certificate_paid ? "Paid Upfront" : `Pending -${d.certificate_fee}`}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-800 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-brand-teal uppercase tracking-widest">Final Refund Vector</span>
                                <span className="text-2xl font-black text-white tracking-tighter italic">PKR {refundAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3 py-2 px-2">
                        <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Adjustments Applied</span>
                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">- PKR {deductions.toLocaleString()}</span>
                        </div>
                        {d.bag_taken && !d.bag_waived && !d.bag_paid && (
                            <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Gear Recovery (Bag)</span>
                                    <span className="text-[10px] font-black text-rose-500">-Rs.{d.bag_fee}</span>
                            </div>
                        )}
                        {d.id_card_taken && !d.id_card_waived && !d.id_card_paid && (
                            <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">LMS Identification (ID)</span>
                                    <span className="text-[10px] font-black text-rose-500">-Rs.{d.id_card_fee}</span>
                            </div>
                        )}
                        {d.certificate_taken && !d.certificate_waived && !d.certificate_paid && (
                            <div className="flex justify-between items-center pl-4 border-l border-rose-500/30">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Certificate Fee</span>
                                    <span className="text-[10px] font-black text-rose-500">-Rs.{d.certificate_fee}</span>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleProcessReturn} className="space-y-8 mt-10">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Auditor Remarks / Settlement Notes</label>
                            <textarea 
                                value={returnRemarks} 
                                onChange={e=>setReturnRemarks(e.target.value)} 
                                placeholder="e.g., Electronic Settlement via Digital Vault #402..." 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all resize-none font-mono" 
                                rows={3}
                            />
                        </div>
                        
                        <div className="flex gap-4">
                            <Button type="button" onClick={() => setShowReturnModal(null)} className="flex-1 rounded-[24px] h-16 font-black text-slate-600 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest border-none transition-all">
                                Decline
                            </Button>
                            <Button type="submit" disabled={isSubmitting} 
                                className="flex-[1.5] bg-brand-teal hover:bg-brand-dark text-white rounded-[24px] h-16 font-black shadow-2xl shadow-brand-teal/20 uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50 transition-all font-black"
                            >
                                {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ArrowLeftRight size={24} />}
                                {isSubmitting ? 'SYNERGY...' : 'Finalize Settlement'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}