'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, RefreshCw, SearchIcon, FileText, Clock, Target,
  CheckCircle, XCircle, Trash2, Edit3, Eye, BarChart3,
  ChevronDown, ChevronRight, Image as ImageIcon, Beaker
} from 'lucide-react';
import { getFileUrl, testsAPI, courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TestData {
  id: string;
  title: string;
  course_id: string | null;
  specialization_id: string | null;
  passing_marks: number;
  total_marks: number;
  duration: number;
  is_required: boolean;
  questions: QuestionData[];
}

interface QuestionData {
  id: string;
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  correct_answers: string;
  marks: number;
  difficulty: string;
  order: number;
  image: string | null;
  option_a_image: string | null;
  option_b_image: string | null;
  option_c_image: string | null;
  option_d_image: string | null;
}

export default function AdminTestsPage() {
  const [tests, setTests] = useState<TestData[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // needed for portal (SSR-safe)
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTest, setEditingTest] = useState<TestData | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    course_id: '',
    specialization_id: '',
    passing_marks: 0,
    total_marks: 0,
    duration: 10,
    is_required: true,
  });
  const [saving, setSaving] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, QuestionData[]>>({});
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_type: 'single_choice',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    correct_answers: '',
    marks: 1,
    difficulty: 'easy',
  });
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null);
  const [optionImageFiles, setOptionImageFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    setMounted(true);
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const [testsData, coursesData] = await Promise.all([
        testsAPI.getAll(orgId).catch(() => []),
        courseAPI.getAll({ organization_id: orgId }).catch(() => ({ results: [] })),
      ]);
      setTests(Array.isArray(testsData) ? testsData : []);
      setCourses(
        Array.isArray(coursesData)
          ? coursesData
          : coursesData?.results || []
      );
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const coursesMap = useMemo(() => {
    const m = new Map<string, string>();
    courses.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [courses]);

  const getCourseName = (id: string | null) =>
    id ? coursesMap.get(id) || 'Unknown' : 'All Courses';

  const filteredTests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return tests;
    return tests.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        getCourseName(t.course_id).toLowerCase().includes(q)
    );
  }, [tests, searchQuery]);

  const resetForm = () => {
    setFormData({
      title: '',
      course_id: '',
      specialization_id: '',
      passing_marks: 0,
      total_marks: 0,
      duration: 10,
      is_required: true,
    });
    setEditingTest(null);
    setShowForm(false);
  };

  const openEditForm = (test: TestData) => {
    setFormData({
      title: test.title,
      course_id: test.course_id || '',
      specialization_id: test.specialization_id || '',
      passing_marks: test.passing_marks,
      total_marks: test.total_marks,
      duration: test.duration,
      is_required: test.is_required,
    });
    setEditingTest(test);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      setSaving(true);
      const data = {
        ...formData,
        course_id: formData.course_id || null,
        specialization_id: formData.specialization_id || null,
      };
      if (editingTest) {
        await testsAPI.update(editingTest.id, data);
        toast.success('Test updated');
      } else {
        await testsAPI.create(data);
        toast.success('Test created');
      }
      resetForm();
      await fetchAll();
    } catch {
      toast.error('Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test? This cannot be undone.')) return;
    try {
      await testsAPI.delete(id);
      toast.success('Test deleted');
      await fetchAll();
    } catch {
      toast.error('Failed to delete test');
    }
  };

  const toggleExpand = async (testId: string) => {
    if (expandedTest === testId) {
      setExpandedTest(null);
      return;
    }
    setExpandedTest(testId);
    if (!questions[testId]) {
      try {
        const data = await testsAPI.getQuestions(testId);
        setQuestions((prev) => ({ ...prev, [testId]: Array.isArray(data) ? data : [] }));
      } catch {
        setQuestions((prev) => ({ ...prev, [testId]: [] }));
      }
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_type: 'single_choice',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      correct_answers: '',
      marks: 1,
      difficulty: 'easy',
    });
    setQuestionImageFile(null);
    setOptionImageFiles({});
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  const openEditQuestion = (q: QuestionData) => {
    setQuestionForm({
      question_type: q.question_type || 'single_choice',
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer || 'A',
      correct_answers: q.correct_answers || '',
      marks: q.marks,
      difficulty: q.difficulty,
    });
    setEditingQuestion(q);
    setShowQuestionForm(true);
  };

  const uploadImagesIfNeeded = async (questionId: string) => {
    const uploads: Promise<any>[] = [];
    if (questionImageFile) {
      uploads.push(testsAPI.uploadQuestionImage(questionId, questionImageFile, 'image'));
    }
    for (const [opt, file] of Object.entries(optionImageFiles)) {
      if (file) {
        uploads.push(testsAPI.uploadQuestionImage(questionId, file, `option_${opt.toLowerCase()}_image`));
      }
    }
    await Promise.all(uploads);
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (!expandedTest) return;
    try {
      setSaving(true);
      let questionId: string | null = null;
      if (editingQuestion) {
        await testsAPI.updateQuestion(editingQuestion.id, questionForm);
        questionId = editingQuestion.id;
        toast.success('Question updated');
      } else {
        const result = await testsAPI.addQuestion(expandedTest, questionForm);
        questionId = result?.id || result?.[0]?.id;
        toast.success('Question added');
      }
      if (questionId) {
        await uploadImagesIfNeeded(questionId);
      }
      resetQuestionForm();
      const data = await testsAPI.getQuestions(expandedTest);
      setQuestions((prev) => ({ ...prev, [expandedTest]: Array.isArray(data) ? data : [] }));
    } catch {
      toast.error('Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await testsAPI.deleteQuestion(questionId);
      toast.success('Question deleted');
      if (expandedTest) {
        const data = await testsAPI.getQuestions(expandedTest);
        setQuestions((prev) => ({ ...prev, [expandedTest]: Array.isArray(data) ? data : [] }));
      }
    } catch {
      toast.error('Failed to delete question');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Assessments...</p>
      </div>
    );
  }

  // ── Test Form Modal (rendered via portal) ──
  const testFormModal = showForm ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={resetForm}>
      <div className="bg-white rounded-3xl w-full max-w-lg mx-4 p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-slate-900 mb-6">{editingTest ? 'Edit Test' : 'New Test'}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
              placeholder="e.g. Frontend Developer Skill Assessment"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Course</label>
            <select
              value={formData.course_id}
              onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
            >
              <option value="">All Courses (General)</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Duration (min)</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Total Marks</label>
              <input
                type="number"
                value={formData.total_marks}
                onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Passing Marks</label>
              <input
                type="number"
                value={formData.passing_marks}
                onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
              />
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                />
                <span className="text-sm font-bold text-slate-600">Required Test</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Button onClick={resetForm} variant="outline" className="rounded-2xl h-12 px-6 font-bold border-slate-200 text-slate-500">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-2xl h-12 px-6 font-bold bg-brand-teal hover:bg-brand-dark text-white">
            {saving ? 'Saving...' : editingTest ? 'Update Test' : 'Create Test'}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Question Form Modal (rendered via portal) ──
  const questionFormModal = showQuestionForm ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={resetQuestionForm}>
      <div className="bg-white rounded-3xl w-full max-w-3xl mx-4 p-8 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-black text-slate-900 mb-6">{editingQuestion ? 'Edit Question' : 'Add Question'}</h2>
        <div className="space-y-5">

          {/* Question Type */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Question Type</label>
            <div className="flex gap-2">
              {[
                { value: 'single_choice', label: 'Single Choice' },
                { value: 'true_false', label: 'True / False' },
                { value: 'multiple_choice', label: 'Multiple Choice' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => {
                    const isTf = t.value === 'true_false';
                    setQuestionForm({
                      ...questionForm,
                      question_type: t.value,
                      option_a: isTf ? 'True' : questionForm.option_a,
                      option_b: isTf ? 'False' : questionForm.option_b,
                      option_c: isTf ? '' : questionForm.option_c,
                      option_d: isTf ? '' : questionForm.option_d,
                      correct_answer: t.value === 'multiple_choice' ? 'A' : questionForm.correct_answer,
                    });
                  }}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border-2',
                    questionForm.question_type === t.value
                      ? 'bg-brand-teal/5 border-brand-teal text-brand-teal'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Question Text</label>
            <textarea
              value={questionForm.question_text}
              onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 resize-none"
              placeholder="Enter the question..."
            />
          </div>

          {/* Question Image */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Question Image</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setQuestionImageFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-teal/5 file:text-brand-teal hover:file:bg-brand-teal/10"
              />
              {questionImageFile && (
                <button onClick={() => setQuestionImageFile(null)} className="text-xs text-rose-500 font-bold shrink-0">Clear</button>
              )}
            </div>
            {questionImageFile && (
              <img src={URL.createObjectURL(questionImageFile)} alt="" className="mt-2 max-h-24 rounded-xl object-contain" />
            )}
          </div>

          {/* Options */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Options
              {questionForm.question_type === 'multiple_choice' && (
                <span className="text-amber-600 font-medium ml-2">(select all correct)</span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const show = questionForm.question_type !== 'true_false' || opt === 'A' || opt === 'B';
                if (!show) return null;
                const isMc = questionForm.question_type === 'multiple_choice';
                const correctAnswers = questionForm.correct_answers ? questionForm.correct_answers.split(',').map(s => s.trim()) : [questionForm.correct_answer];
                const checked = isMc ? correctAnswers.includes(opt) : questionForm.correct_answer === opt;
                return (
                  <div key={opt}>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-2">
                      Option {opt}
                      {questionForm.question_type === 'true_false' && checked && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-black">CORRECT</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      {isMc && (
                        <button
                          onClick={() => {
                            let list = questionForm.correct_answers ? questionForm.correct_answers.split(',').map(s => s.trim()) : [questionForm.correct_answer];
                            if (checked) list = list.filter(x => x !== opt);
                            else list.push(opt);
                            list = [...new Set(list)].sort();
                            setQuestionForm({ ...questionForm, correct_answers: list.join(',') });
                          }}
                          className={cn(
                            'w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
                            checked ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                          )}
                        >
                          {checked ? <CheckCircle size={16} /> : null}
                        </button>
                      )}
                      <div className="flex-1">
                        <input
                          type="text"
                          value={questionForm[`option_${opt.toLowerCase()}` as keyof typeof questionForm] as string}
                          onChange={(e) => setQuestionForm({ ...questionForm, [`option_${opt.toLowerCase()}`]: e.target.value })}
                          readOnly={questionForm.question_type === 'true_false'}
                          className={cn(
                            'w-full px-4 py-3 border rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50',
                            checked && !isMc ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                          )}
                          placeholder={`Option ${opt}`}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setOptionImageFiles(prev => ({ ...prev, [opt]: e.target.files?.[0] || null }))}
                          className="mt-1.5 w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-brand-teal/10 file:text-brand-teal hover:file:bg-brand-teal/20"
                        />
                        {optionImageFiles[opt] && (
                          <span className="text-[10px] text-emerald-600 font-semibold">Image selected</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Correct Answer (single_choice / true_false) */}
          {questionForm.question_type !== 'multiple_choice' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Correct Answer</label>
                <select
                  value={questionForm.correct_answer}
                  onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
                >
                  {questionForm.question_type === 'true_false' ? (
                    <><option value="A">True</option><option value="B">False</option></>
                  ) : (
                    <><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Marks</label>
                <input
                  type="number"
                  value={questionForm.marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Difficulty</label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          )}

          {/* Multiple Choice: marks + difficulty only */}
          {questionForm.question_type === 'multiple_choice' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Marks</label>
                <input
                  type="number"
                  value={questionForm.marks}
                  onChange={(e) => setQuestionForm({ ...questionForm, marks: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Difficulty</label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          )}

        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Button onClick={resetQuestionForm} variant="outline" className="rounded-2xl h-12 px-6 font-bold border-slate-200 text-slate-500">
            Cancel
          </Button>
          <Button onClick={handleSaveQuestion} disabled={saving} className="rounded-2xl h-12 px-6 font-bold bg-brand-teal hover:bg-brand-dark text-white">
            {saving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Beaker className="w-7 h-7 text-brand-teal" />
            Skill Assessments
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Create and manage admission skill assessment tests.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/admin/tests/analytics">
            <Button variant="outline" className="rounded-2xl h-14 px-6 font-black text-brand-teal border-brand-teal/20 hover:bg-brand-teal/10 transition-all">
              <BarChart3 className="w-5 h-5 mr-3" /> Analytics
            </Button>
          </Link>
          <Button onClick={fetchAll} variant="ghost" className="rounded-2xl h-14 px-6 font-black text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
            <RefreshCw className="w-5 h-5 mr-3" /> Refresh
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-2xl h-14 px-6 font-black bg-brand-teal hover:bg-brand-dark text-white transition-all shadow-lg shadow-brand-teal/20">
            <Plus className="w-5 h-5 mr-3" /> New Test
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Tests', val: tests.length, icon: FileText, color: 'blue' },
          { label: 'Total Questions', val: tests.reduce((s, t) => s + (t.questions?.length || questions[t.id]?.length || 0), 0), icon: Target, color: 'emerald' },
          { label: 'Avg Duration', val: tests.length ? Math.round(tests.reduce((s, t) => s + t.duration, 0) / tests.length) + ' min' : 'â€”', icon: Clock, color: 'amber' },
          { label: 'Required', val: tests.filter((t) => t.is_required).length, icon: CheckCircle, color: 'indigo' },
        ].map((stat, i) => (
          <div key={i} className="premium-card p-6 flex items-center gap-6 group hover:border-brand-teal/30 transition-all">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm',
              stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
              stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
              stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-brand-teal/10 text-brand-teal'
            )}>
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{stat.val}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md group">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
          />
        </div>
      </div>

      {/* Test List */}
      <div className="space-y-4">
        {filteredTests.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-semibold">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>No tests found. Create your first assessment.</p>
          </div>
        )}
        {filteredTests.map((test) => {
          const questionCount = test.questions?.length || questions[test.id]?.length || 0;
          return (
            <div key={test.id} className="premium-card overflow-hidden border border-slate-200/60 hover:border-brand-teal/20 transition-all">
              {/* Test Header */}
              <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(test.id)}>
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                    <FileText size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{test.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs font-semibold text-slate-400">
                      <span>{getCourseName(test.course_id)}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{test.duration} min</span>
                      <span className="flex items-center gap-1"><Target size={12} />{test.passing_marks}/{test.total_marks} pass</span>
                      <span>{questionCount} questions</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {test.is_required && (
                    <span className="text-[10px] font-black px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full uppercase tracking-wider">Required</span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); openEditForm(test); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-brand-teal">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(test.id); }} className="p-2 hover:bg-rose-50 rounded-xl transition-all text-slate-400 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                  <div className="text-slate-300 ml-2">
                    {expandedTest === test.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>
              </div>

              {/* Expanded Questions */}
              {expandedTest === test.id && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-700">Questions</h4>
                      <Button
                        onClick={() => { resetQuestionForm(); setShowQuestionForm(true); }}
                        size="sm"
                        className="rounded-xl h-9 px-4 text-xs font-bold bg-brand-teal hover:bg-brand-dark text-white"
                      >
                        <Plus size={14} className="mr-1" /> Add Question
                      </Button>
                    </div>
                    {(!questions[test.id] || questions[test.id].length === 0) && (
                      <p className="text-sm text-slate-400 font-medium text-center py-8">No questions yet.</p>
                    )}
                    <div className="space-y-3">
                      {(questions[test.id] || []).map((q, idx) => {
                        const opts = q.question_type === 'true_false'
                          ? (['A', 'B'] as const)
                          : (['A', 'B', 'C', 'D'] as const);
                        const correctOptions = q.question_type === 'multiple_choice'
                          ? (q.correct_answers || q.correct_answer || '').split(',').map(s => s.trim())
                          : [q.correct_answer];
                        return (
                        <div key={q.id} className="bg-white rounded-2xl p-4 border border-slate-200/60">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-black text-slate-400 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">{idx + 1}</span>
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                                  q.question_type === 'multiple_choice' ? 'bg-purple-50 text-purple-600' :
                                  q.question_type === 'true_false' ? 'bg-cyan-50 text-cyan-600' :
                                  'bg-blue-50 text-blue-600'
                                )}>
                                  {q.question_type === 'multiple_choice' ? 'Multi' : q.question_type === 'true_false' ? 'T/F' : 'Single'}
                                </span>
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                                  q.difficulty === 'hard' ? 'bg-rose-50 text-rose-600' :
                                  q.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                )}>{q.difficulty}</span>
                                <span className="text-xs text-slate-400 font-semibold">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                              </div>
                              {q.image && (
                                <img src={getFileUrl(q.image)} alt="" className="max-h-32 rounded-xl mb-2 object-contain" />
                              )}
                              <p className="text-sm font-semibold text-slate-800 mb-2">{q.question_text}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {opts.map((opt) => {
                                  const val = q[`option_${opt.toLowerCase()}` as keyof QuestionData] as string;
                                  const isCorrect = correctOptions.includes(opt);
                                  const hasImg = q[`${opt.toLowerCase()}_image` as keyof QuestionData] as string | null;
                                  return (
                                    <div key={opt} className={cn(
                                      'text-xs px-3 py-1.5 rounded-lg border',
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                                        : 'bg-slate-50 border-slate-200 text-slate-500'
                                    )}>
                                      <span className="font-black mr-1">{opt}.</span>
                                      {hasImg && <img src={getFileUrl(hasImg)} alt="" className="h-8 inline-block mr-1 rounded" />}
                                      {val}
                                      {isCorrect && q.question_type === 'multiple_choice' && (
                                        <CheckCircle size={12} className="inline ml-1 text-emerald-500" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button onClick={() => {
                                const list = questions[test.id] || [];
                                const idx2 = list.findIndex(x => x.id === q.id);
                                if (idx2 > 0) {
                                  const newList = [...list];
                                  [newList[idx2 - 1], newList[idx2]] = [newList[idx2], newList[idx2 - 1]];
                                  setQuestions(prev => ({ ...prev, [test.id]: newList }));
                                  testsAPI.reorderQuestions(test.id, newList.map(x => x.id)).catch(() => {});
                                }
                              }} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all" title="Move up">
                                <ChevronDown size={14} className="rotate-180" />
                              </button>
                              <button onClick={() => {
                                const list = questions[test.id] || [];
                                const idx2 = list.findIndex(x => x.id === q.id);
                                if (idx2 < list.length - 1) {
                                  const newList = [...list];
                                  [newList[idx2], newList[idx2 + 1]] = [newList[idx2 + 1], newList[idx2]];
                                  setQuestions(prev => ({ ...prev, [test.id]: newList }));
                                  testsAPI.reorderQuestions(test.id, newList.map(x => x.id)).catch(() => {});
                                }
                              }} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all" title="Move down">
                                <ChevronDown size={14} />
                              </button>
                              <div className="border-t border-slate-100 my-1" />
                              <button onClick={() => openEditQuestion(q)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-teal transition-all">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals rendered via portal -> escapes any parent transform/filter/stacking context
          so the blur/dark overlay always covers the FULL viewport including header/sidebar */}
      {mounted && testFormModal && createPortal(testFormModal, document.body)}
      {mounted && questionFormModal && createPortal(questionFormModal, document.body)}
    </div>
  );
}