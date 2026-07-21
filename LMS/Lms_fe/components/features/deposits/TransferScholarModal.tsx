'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, ArrowRightLeft, ChevronDown, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { courseAPI, receiptAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface TransferScholarModalProps {
    show: boolean;
    onClose: () => void;
    receipt: any;
    courses: any[];
    onSuccess: () => void;
}

export function TransferScholarModal({
    show,
    onClose,
    receipt,
    courses,
    onSuccess
}: TransferScholarModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        new_course_id: '',
        new_scheduled_class_id: '',
        reason: ''
    });

    useEffect(() => {
        if (show && receipt) {
            setFormData({
                new_course_id: receipt.course_id || '',
                new_scheduled_class_id: '',
                reason: ''
            });
            if (receipt.course_id) {
                fetchSessions(receipt.course_id);
            }
        }
    }, [show, receipt]);

    const fetchSessions = async (courseId: string) => {
        try {
            setLoading(true);
            const response = await courseAPI.getScheduledClasses(courseId);
            const data = Array.isArray(response) ? response : (response.results || []);
            setSessions(data.map((s: any) => ({
                id: s.id,
                label: `${s.section_name || 'Unnamed Section'} (${s.batch_name || 'No Batch'})`
            })));
        } catch (error) {
            console.error('Error fetching sessions:', error);
            toast.error('Failed to load sections');
        } finally {
            setLoading(false);
        }
    };

    const handleCourseChange = (courseId: string) => {
        setFormData(prev => ({ ...prev, new_course_id: courseId, new_scheduled_class_id: '' }));
        fetchSessions(courseId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.new_scheduled_class_id) {
            toast.error('Please select a target section');
            return;
        }

        try {
            setSubmitting(true);
            await receiptAPI.transferCode(receipt.id, {
                new_course_id: formData.new_course_id,
                new_scheduled_class_id: formData.new_scheduled_class_id,
                reason: formData.reason
            });
            toast.success('Scholar transferred successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Transfer error:', error);
            toast.error(error?.response?.data?.detail || 'Failed to transfer scholar');
        } finally {
            setSubmitting(false);
        }
    };

    if (!show || !receipt) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" 
                onClick={onClose}
            ></div>
            <div className="relative bg-white w-full max-w-xl rounded-[40px] shadow-3xl p-0 animate-in zoom-in-95 duration-500 border border-white group/modal overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-2 bg-amber-400 opacity-30" />
                
                <div className="p-10 md:p-12">
                    <div className="flex items-start justify-between mb-10">
                        <div>
                            <p className="text-amber-500 font-black tracking-[0.2em] text-[10px] uppercase mb-1">Curricular Migration</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Transfer Scholar</h2>
                            <p className="text-slate-700 font-medium text-sm mt-1">Re-assign {receipt.student_name} to a new curricular vector.</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all hover:rotate-90"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 flex items-center gap-2">
                                <Calendar size={12} className="text-amber-500" /> Target Curriculum
                            </label>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.new_course_id}
                                    onChange={(e) => handleCourseChange(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-black appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-400/10 focus:border-amber-400 transition-all uppercase tracking-widest"
                                >
                                    <option value="">Select New Course...</option>
                                    {courses.map(course => (
                                        <option key={course.id} value={course.id}>{course.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 flex items-center gap-2">
                                <Users size={12} className="text-amber-500" /> Target Curricular Node (Section)
                            </label>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.new_scheduled_class_id}
                                    onChange={(e) => setFormData({ ...formData, new_scheduled_class_id: e.target.value })}
                                    disabled={loading || !formData.new_course_id || sessions.length === 0}
                                    className={cn(
                                        "w-full px-6 py-4 border rounded-2xl text-[10px] font-black appearance-none transition-all uppercase tracking-widest",
                                        loading || !formData.new_course_id || sessions.length === 0 ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" : "bg-slate-50 text-slate-900 border-slate-100 focus:outline-none focus:ring-4 focus:ring-amber-400/10 focus:border-amber-400"
                                    )}
                                >
                                    <option value="">
                                        {loading ? 'Discovering nodes...' : sessions.length === 0 ? 'No open nodes available' : 'Select Target Section...'}
                                    </option>
                                    {sessions.map(session => (
                                        <option key={session.id} value={session.id}>{session.label}</option>
                                    ))}
                                </select>
                                {loading ? (
                                    <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 text-amber-500 animate-spin" size={18} />
                                ) : (
                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">Reason for Migration</label>
                            <textarea
                                required
                                placeholder="e.g. Schedule Conflict, Subject Interest Change..."
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-400/10 focus:border-amber-400 transition-all min-h-[100px] resize-none shadow-inner"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-10 border-t border-slate-50 px-2 pb-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="h-16 px-10 rounded-[28px] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 uppercase text-[11px] tracking-widest transition-all border-none"
                            >
                                Abort
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="h-16 px-12 rounded-[28px] bg-amber-400 hover:bg-amber-500 text-white font-black shadow-2xl shadow-amber-400/20 uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 min-w-[240px] disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
                                {submitting ? 'MIGRATING...' : 'Finalize Transfer'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
