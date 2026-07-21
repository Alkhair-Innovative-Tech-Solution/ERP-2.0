'use client';

import { useState, useEffect } from 'react';
import {
  X, Loader2, BookOpen, ChevronDown, FileText,
  ShieldCheck, ShieldAlert, Clock, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { courseAPI, admissionAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface EditLeadModalProps {
    show: boolean;
    onClose: () => void;
    lead: any;
    courses: any[];
    onSuccess: () => void;
}

export function EditLeadModal({
    show,
    onClose,
    lead,
    courses,
    onSuccess
}: EditLeadModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [depositSubmitting, setDepositSubmitting] = useState(false);
    const [confirmDepositOverride, setConfirmDepositOverride] = useState(false);
    const [depositReason, setDepositReason] = useState('');
    const [scoreSubmitting, setScoreSubmitting] = useState(false);
    const [scoreForm, setScoreForm] = useState({ score: '', status: '', reason: '' });
    const [formData, setFormData] = useState({
        course_id: '',
        course_name_requested: '',
        reason: ''
    });

    useEffect(() => {
        if (show && lead) {
            setFormData({
                course_id: lead.course_id || '',
                course_name_requested: lead.course_name_requested || '',
                reason: ''
            });
            setConfirmDepositOverride(false);
            setDepositReason('');
            setScoreForm({ score: '', status: '', reason: '' });
        }
    }, [show, lead]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.course_id && !formData.course_name_requested) {
            toast.error('Please select a course or enter a course name');
            return;
        }

        try {
            setSubmitting(true);
            const payload: any = {};
            if (formData.course_id) payload.course_id = formData.course_id;
            if (formData.course_name_requested) payload.course_name_requested = formData.course_name_requested;

            await admissionAPI.updateLead(lead.id, payload);
            toast.success('Lead course updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Edit lead error:', error);
            toast.error(error?.response?.data?.detail || 'Failed to update lead');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDepositOverride = async () => {
        if (!depositReason.trim()) {
            toast.error('Please provide a reason for the deposit override');
            return;
        }
        try {
            setDepositSubmitting(true);
            await admissionAPI.updateLead(lead.id, {
                has_paid_deposit: !lead.has_paid_deposit,
            });
            toast.success(`Deposit status overridden to ${!lead.has_paid_deposit ? 'PAID' : 'PENDING'}`);
            onSuccess();
            setConfirmDepositOverride(false);
            setDepositReason('');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to override deposit status');
        } finally {
            setDepositSubmitting(false);
        }
    };

    const handleScoreOverride = async () => {
        if (!scoreForm.reason.trim()) {
            toast.error('Please provide a reason');
            return;
        }
        if (!scoreForm.score && !scoreForm.status) {
            toast.error('Set a new score, status, or both');
            return;
        }
        try {
            setScoreSubmitting(true);
            await admissionAPI.scoreOverride(lead.id, {
                score: scoreForm.score ? parseInt(scoreForm.score) : undefined,
                status: scoreForm.status || undefined,
                reason: scoreForm.reason,
            });
            toast.success('Score / status override applied');
            onSuccess();
            setScoreForm({ score: '', status: '', reason: '' });
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Failed to override score');
        } finally {
            setScoreSubmitting(false);
        }
    };

    if (!show || !lead) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500"
                onClick={onClose}
            ></div>
            <div className="relative bg-white w-full max-w-xl rounded-[40px] shadow-3xl p-0 animate-in zoom-in-95 duration-500 border border-white group/modal overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-2 bg-brand-teal opacity-30" />

                <div className="p-10 md:p-12">
                    <div className="flex items-start justify-between mb-10">
                        <div>
                            <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Lead Configuration</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Edit Applicant Details</h2>
                            <p className="text-slate-700 font-medium text-sm mt-1">Update course or deposit status for <span className="font-bold">{lead.name}</span>.</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all hover:rotate-90"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-8 pr-2">

                        {/* Course Change Section */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                                    <BookOpen size={14} className="text-brand-teal" />
                                </div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Course Assignment</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Select Course</label>
                                <div className="relative">
                                    <select
                                        value={formData.course_id}
                                        onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-widest"
                                    >
                                        <option value="">Select Course...</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>{course.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Or Enter Course Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Web Development Specialization"
                                    value={formData.course_name_requested}
                                    onChange={(e) => setFormData({ ...formData, course_name_requested: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Reason for Change</label>
                                <textarea
                                    placeholder="e.g. Student requested different course..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all min-h-[80px] resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 px-2 pb-2">
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="h-14 px-8 rounded-[28px] bg-brand-teal hover:bg-brand-dark text-white font-black shadow-lg shadow-brand-teal/20 uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                                    {submitting ? 'UPDATING...' : 'Update Course'}
                                </Button>
                            </div>
                        </form>

                        {/* Separator */}
                        <div className="border-t border-slate-100" />

                        {/* Score Override Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <Target size={14} className="text-indigo-600" />
                                </div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Score / Status Override</p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Test Score</p>
                                    <p className="text-lg font-black text-slate-900 mt-1">
                                        {lead.test_score !== null ? `${lead.test_score}%` : 'Not Taken'}
                                    </p>
                                </div>
                                <div className={cn(
                                    'px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border',
                                    lead.status === 'passed' || lead.status === 'enrolled' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    lead.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                    'bg-slate-100 text-slate-500 border-slate-200'
                                )}>
                                    {lead.status === 'enrolled' ? 'ENROLLED' : lead.status === 'passed' ? 'PASSED' : lead.status === 'failed' ? 'FAILED' : lead.status?.toUpperCase() || 'PENDING'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">New Score (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        placeholder="0-100"
                                        value={scoreForm.score}
                                        onChange={(e) => setScoreForm({ ...scoreForm, score: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">New Status</label>
                                    <select
                                        value={scoreForm.status}
                                        onChange={(e) => setScoreForm({ ...scoreForm, status: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all uppercase tracking-widest"
                                    >
                                        <option value="">Keep Current</option>
                                        <option value="pending">Pending</option>
                                        <option value="passed">Passed</option>
                                        <option value="failed">Failed</option>
                                        <option value="enrolled">Enrolled</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-1">Reason *</label>
                                <textarea
                                    value={scoreForm.reason}
                                    onChange={(e) => setScoreForm({ ...scoreForm, reason: e.target.value })}
                                    placeholder="e.g. Manual review of answer sheet..."
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[60px] resize-none"
                                />
                            </div>
                            <Button
                                onClick={handleScoreOverride}
                                disabled={scoreSubmitting || !scoreForm.reason.trim() || (!scoreForm.score && !scoreForm.status)}
                                className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest bg-indigo-500 hover:bg-indigo-600 text-white transition-all disabled:opacity-50"
                            >
                                {scoreSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Apply Override'}
                            </Button>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-slate-100" />

                        {/* Deposit Override Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                    <ShieldCheck size={14} className="text-amber-600" />
                                </div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Deposit Status Override</p>
                            </div>

                            {/* Current Status */}
                            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Deposit Status</p>
                                    <p className="text-lg font-black text-slate-900 mt-1">
                                        {lead.has_paid_deposit ? 'Deposit Paid' : 'No Deposit'}
                                    </p>
                                </div>
                                <div className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest',
                                    lead.has_paid_deposit
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                )}>
                                    {lead.has_paid_deposit ? <ShieldCheck size={14} /> : <Clock size={14} />}
                                    {lead.has_paid_deposit ? 'PAID' : 'PENDING'}
                                </div>
                            </div>

                            {!confirmDepositOverride ? (
                                <Button
                                    onClick={() => setConfirmDepositOverride(true)}
                                    variant="outline"
                                    className={cn(
                                        'w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all',
                                        lead.has_paid_deposit
                                            ? 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
                                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'
                                    )}
                                >
                                    <ShieldAlert size={16} className="mr-2" />
                                    {lead.has_paid_deposit ? 'Revoke Deposit Status' : 'Mark Deposit as Paid'}
                                </Button>
                            ) : (
                                <div className="space-y-3 bg-amber-50/50 rounded-2xl p-4 border border-amber-200/50">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                                        {lead.has_paid_deposit
                                            ? 'Are you sure you want to revoke the deposit status? This will allow the lead to change courses.'
                                            : 'Are you sure you want to mark deposit as paid? This will lock the lead from changing courses.'}
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Reason for Override *</label>
                                        <textarea
                                            value={depositReason}
                                            onChange={(e) => setDepositReason(e.target.value)}
                                            placeholder="e.g. Admin override due to payment confirmation..."
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-400 transition-all min-h-[60px] resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => { setConfirmDepositOverride(false); setDepositReason(''); }}
                                            variant="ghost"
                                            className="flex-1 h-11 rounded-xl font-bold text-slate-500 bg-white hover:bg-slate-50 text-[10px] uppercase tracking-widest"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleDepositOverride}
                                            disabled={depositSubmitting || !depositReason.trim()}
                                            className={cn(
                                                'flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest text-white transition-all disabled:opacity-50',
                                                lead.has_paid_deposit
                                                    ? 'bg-rose-500 hover:bg-rose-600'
                                                    : 'bg-emerald-500 hover:bg-emerald-600'
                                            )}
                                        >
                                            {depositSubmitting ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : lead.has_paid_deposit ? (
                                                'Revoke Deposit'
                                            ) : (
                                                'Confirm Paid'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
