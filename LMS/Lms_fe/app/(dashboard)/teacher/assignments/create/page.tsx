'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Paperclip, X, Clock, Calendar, Save, FileText } from 'lucide-react';
import { courseAPI, assignmentAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function CreateAssignmentPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [form, setForm] = useState({
    course_id: '',
    section_id: '',
    title: '',
    description: '',
    instructions: '',
    total_marks: 100,
    due_date: '',
    due_time: '',
    type: 'ASSIGNMENT',
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const user = getStoredUser();
  const router = useRouter();

  useEffect(() => {
    courseAPI.getMyCourses().then(data => {
      const list = Array.isArray(data) ? data : (data as any).results || [];
      setCourses(list);
      if (list.length > 0) setForm(f => ({ ...f, course_id: list[0].id }));
    }).catch(() => toast.error('Failed to load courses'))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (form.course_id && user?.id) {
      courseAPI.getScheduledClasses(form.course_id, user.id).then(data => {
        const list = Array.isArray(data) ? data : [];
        setSections(list);
        setForm(f => ({ ...f, section_id: list.length > 0 ? list[0].id : '' }));
      }).catch(() => setSections([]));
    } else {
      setSections([]);
    }
  }, [form.course_id, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.course_id) return toast.error('Select a course');

    setSaving(true);
    try {
      const payload: any = {
        course_id: form.course_id,
        title: form.title,
        description: form.description || form.title,
        instructions: form.instructions,
        total_marks: form.total_marks,
        assignment_type: form.type,
        created_by_id: user?.id,
        is_published: true,
      };
      if (form.section_id) payload.scheduled_class_id = form.section_id;
      if (form.due_date) {
        payload.due_date = form.due_time
          ? `${form.due_date}T${form.due_time}`
          : `${form.due_date}T23:59`;
      }
      if (file) payload.attachment = file;
      await assignmentAPI.create(payload);
      toast.success('Assignment created!');
      router.push('/teacher/assignments');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-3 border-slate-100 border-t-brand-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to assignments
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <FileText className="w-7 h-7 text-brand-teal" />
          Create Assignment
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Create a new assignment for your students.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
              {/* Title */}
              <input
                type="text"
                placeholder="Title"
                className="w-full text-2xl font-bold text-slate-900 placeholder:text-slate-300 border-0 border-b-2 border-slate-100 pb-3 focus:border-brand-teal focus:ring-0 outline-none transition-colors"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                autoFocus
                required
              />

              {/* Instructions / Description */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Instructions (optional)</label>
                <textarea
                  placeholder="Add detailed instructions for students..."
                  rows={5}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none resize-none"
                  value={form.instructions}
                  onChange={e => setForm({ ...form, instructions: e.target.value })}
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Attachment (optional)</label>
                {file ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Paperclip className="w-4 h-4 text-brand-teal" />
                    <span className="text-sm text-slate-700 flex-1">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-brand-teal hover:text-brand-teal cursor-pointer transition-colors">
                    <Plus className="w-4 h-4" />
                    Attach file
                    <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Points */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-xs font-medium text-slate-500 mb-2 block">Points</label>
              <input
                type="number"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={form.total_marks}
                onChange={e => setForm({ ...form, total_marks: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>

            {/* Due Date */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Due Date
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Time (optional)
                </label>
                <input
                  type="time"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                  value={form.due_time}
                  onChange={e => setForm({ ...form, due_time: e.target.value })}
                />
              </div>
            </div>

            {/* Course */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-xs font-medium text-slate-500 mb-2 block">Course</label>
              <select
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={form.course_id}
                onChange={e => setForm({ ...form, course_id: e.target.value })}
              >
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.title}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <label className="text-xs font-medium text-slate-500 mb-2 block">Section (optional)</label>
              <select
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal outline-none"
                value={form.section_id}
                onChange={e => setForm({ ...form, section_id: e.target.value })}
              >
                <option value="">All Sections</option>
                {sections.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.section ? `Section ${s.section}` : s.id?.slice(0, 8)} {s.days ? `(${s.days.join(', ')})` : ''}
                  </option>
                ))}
              </select>
              {sections.length === 0 && form.course_id && (
                <p className="text-xs text-slate-400 mt-1">No sections found for this course</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
