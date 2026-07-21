'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Target, Users, Clock, CheckCircle,
  XCircle, ChevronDown, ChevronRight, SearchIcon, RefreshCw,
  Download, Activity, PieChart
} from 'lucide-react';
import { testsAPI, courseAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

interface TestData {
  id: string;
  title: string;
  course_id: string | null;
  specialization_id: string | null;
  passing_marks: number;
  total_marks: number;
  duration: number;
  is_required: boolean;
}

interface AttemptData {
  id: string;
  user_id: string;
  user_email: string;
  test: string;
  score: number | null;
  percentage: number | null;
  status: string;
  is_passed: boolean;
  attempt_number: number;
  start_time: string;
  end_time: string | null;
  enrollment_status: string;
  answers?: Record<string, string>;
}

interface QuestionBrief {
  id: string;
  question_text: string;
  correct_answer: string;
  correct_answers?: string;
  question_type?: string;
  marks: number;
  order: number;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
}

export default function TestAnalyticsPage() {
  const [tests, setTests] = useState<TestData[]>([]);
  const [allAttempts, setAllAttempts] = useState<AttemptData[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [questionsByTest, setQuestionsByTest] = useState<Record<string, QuestionBrief[]>>({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const [testsData, coursesData, attemptsData] = await Promise.all([
        testsAPI.getAll(orgId).catch(() => []),
        courseAPI.getAll({ organization_id: orgId }).catch(() => ({ results: [] } as any)),
        testsAPI.getAttempts().catch(() => ({ attempts: [] })),
      ]);
      const testList = Array.isArray(testsData) ? testsData : testsData.results || testsData.data || [];
      setTests(testList);
      setCourses(Array.isArray(coursesData) ? coursesData : coursesData.results || coursesData.data || []);
      setAllAttempts(attemptsData?.attempts || []);
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const attemptsByTest = useMemo(() => {
    const map: Record<string, AttemptData[]> = {};
    let filtered = allAttempts;
    if (dateRange.from) {
      const from = new Date(dateRange.from);
      filtered = filtered.filter(a => new Date(a.start_time) >= from);
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => new Date(a.start_time) <= to);
    }
    filtered.forEach(a => {
      const tid = a.test;
      if (!map[tid]) map[tid] = [];
      map[tid].push(a);
    });
    return map;
  }, [allAttempts, dateRange]);

  const coursesMap = useMemo(() => {
    const m = new Map<string, string>();
    courses.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [courses]);

  const getCourseName = (id: string | null) => id ? coursesMap.get(id) || 'Unknown' : 'General';

  const handleExpand = async (testId: string) => {
    setExpandedTest(expandedTest === testId ? null : testId);
    if (expandedTest !== testId && !questionsByTest[testId]) {
      try {
        const data = await testsAPI.getQuestions(testId);
        setQuestionsByTest(prev => ({ ...prev, [testId]: Array.isArray(data) ? data : [] }));
      } catch {
        setQuestionsByTest(prev => ({ ...prev, [testId]: [] }));
      }
    }
  };

  const getQuestionStats = (testId: string) => {
    const questions = questionsByTest[testId] || [];
    const attempts = attemptsByTest[testId] || [];
    const completed = attempts.filter(a => a.status === 'completed' && a.answers);

    if (!questions.length || !completed.length) return [];

    return questions.map(q => {
      let correct = 0;
      let answered = 0;
      completed.forEach(a => {
        const selected = a.answers?.[q.id];
        if (selected) {
          answered++;
          if (q.question_type === 'multiple_choice') {
            const userAnswers = selected.split(',').map(s => s.trim()).sort();
            const correctAnswers = (q.correct_answers || q.correct_answer || '').split(',').map(s => s.trim()).sort();
            if (JSON.stringify(userAnswers) === JSON.stringify(correctAnswers)) correct++;
          } else {
            if (selected === q.correct_answer) correct++;
          }
        }
      });
      return {
        id: q.id,
        text: q.question_text,
        type: q.question_type || 'single_choice',
        marks: q.marks,
        correct,
        answered,
        accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      };
    });
  };

  const filteredTests = useMemo(() => {
    if (!searchQuery) return tests;
    const q = searchQuery.toLowerCase();
    return tests.filter(t =>
      t.title.toLowerCase().includes(q) ||
      getCourseName(t.course_id).toLowerCase().includes(q)
    );
  }, [tests, searchQuery]);

  const { sortedData: sortedFilteredTests, sortConfig, requestSort } = useSortableData(filteredTests);

  const overallStats = useMemo(() => {
    const allAttempts = Object.values(attemptsByTest).flat();
    const completed = allAttempts.filter(a => a.status === 'completed');
    const total = allAttempts.length;
    const passed = completed.filter(a => a.is_passed).length;
    const avgPct = completed.length
      ? Math.round(completed.reduce((s, a) => s + (a.percentage || 0), 0) / completed.length)
      : 0;
    return {
      totalAttempts: total,
      completedAttempts: completed.length,
      passed,
      failed: completed.length - passed,
      avgPercentage: avgPct,
      passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
    };
  }, [attemptsByTest]);

  const perTestStats = useMemo(() => {
    return tests.map(t => {
      const attempts = attemptsByTest[t.id] || [];
      const completed = attempts.filter(a => a.status === 'completed');
      const passed = completed.filter(a => a.is_passed).length;
      const avgPct = completed.length
        ? Math.round(completed.reduce((s, a) => s + (a.percentage || 0), 0) / completed.length)
        : 0;
      return {
        ...t,
        totalAttempts: attempts.length,
        completedAttempts: completed.length,
        passed,
        failed: completed.length - passed,
        avgPercentage: avgPct,
        passRate: completed.length ? Math.round((passed / completed.length) * 100) : 0,
        courseName: getCourseName(t.course_id),
      };
    });
  }, [tests, attemptsByTest, getCourseName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Assessment Analytics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-brand-teal" />
            Test Analytics
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Pass rates, score distribution, and per-test performance metrics.</p>
        </div>
        <Button onClick={fetchAll} variant="ghost" className="rounded-2xl h-14 px-6 font-black text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all">
          <RefreshCw className="w-5 h-5 mr-3" /> Refresh
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {[
          { label: 'Total Attempts', val: overallStats.totalAttempts, icon: Users, color: 'blue' },
          { label: 'Completed', val: overallStats.completedAttempts, icon: Activity, color: 'indigo' },
          { label: 'Pass Rate', val: `${overallStats.passRate}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Average Score', val: `${overallStats.avgPercentage}%`, icon: Target, color: 'amber' },
          { label: 'Tests', val: tests.length, icon: BarChart3, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="premium-card p-6 flex items-center gap-5 group hover:border-brand-teal/30 transition-all">
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm shrink-0',
              stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
              stat.color === 'indigo' ? 'bg-brand-teal/10 text-brand-teal' :
              stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
              stat.color === 'amber' ? 'bg-amber-50 text-amber-600' :
              'bg-purple-50 text-purple-600'
            )}>
              <stat.icon size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className={cn(
                'text-2xl font-black tracking-tighter leading-none mb-1',
                stat.color === 'emerald' ? 'text-emerald-600' : 'text-slate-900'
              )}>{stat.val}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pass/Fail Pie (simple bar) */}
      {overallStats.completedAttempts > 0 && (
        <div className="premium-card p-6 border-slate-200/60">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={16} className="text-brand-teal" />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Overall Pass / Fail Distribution</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000 flex items-center justify-center text-[10px] font-black text-white"
                style={{ width: `${overallStats.passRate}%` }}
              >
                {overallStats.passRate > 15 && `${overallStats.passRate}%`}
              </div>
              <div
                className="h-full bg-rose-400 transition-all duration-1000 flex items-center justify-center text-[10px] font-black text-white"
                style={{ width: `${100 - overallStats.passRate}%` }}
              >
                {overallStats.passRate < 85 && `${100 - overallStats.passRate}%`}
              </div>
            </div>
            <div className="flex gap-4 text-xs font-bold shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle size={12} /> {overallStats.passed} Passed</span>
              <span className="flex items-center gap-1.5 text-rose-500"><XCircle size={12} /> {overallStats.failed} Failed</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">From</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">To</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
            />
          </div>
          {(dateRange.from || dateRange.to) && (
            <button
              onClick={() => setDateRange({ from: '', to: '' })}
              className="self-end px-4 py-3 text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase tracking-widest transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Per-Test Analytics */}
      <div className="space-y-4">
        {perTestStats.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-semibold">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>No test data available.</p>
          </div>
        )}
        {sortedFilteredTests.map((test) => {
          const stats = perTestStats.find(s => s.id === test.id);
          if (!stats) return null;
          return (
            <div key={test.id} className="premium-card overflow-hidden border border-slate-200/60 hover:border-brand-teal/20 transition-all">
              {/* Test Header */}
              <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => handleExpand(test.id)}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                    <Target size={22} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 truncate">{test.title}</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">{stats.courseName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="hidden md:flex items-center gap-6 text-xs font-bold">
                    <span className="text-slate-500">{stats.totalAttempts} attempts</span>
                    <span className={cn(stats.passRate >= 70 ? 'text-emerald-600' : stats.passRate >= 50 ? 'text-amber-600' : 'text-rose-600')}>
                      {stats.passRate}% pass
                    </span>
                    <span className="text-slate-500">{stats.avgPercentage}% avg</span>
                  </div>
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                    <div className={cn(
                      'h-full rounded-full transition-all',
                      stats.passRate >= 70 ? 'bg-emerald-500' : stats.passRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    )} style={{ width: `${stats.passRate}%` }} />
                  </div>
                  <div className="text-slate-300">
                    {expandedTest === test.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>
              </div>

              {/* Expanded Attempts */}
              {expandedTest === test.id && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <div className="p-6">
                    {/* Per-test stats mini-row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {[
                        { label: 'Attempts', val: stats.totalAttempts, icon: Users, color: 'text-blue-600 bg-blue-50' },
                        { label: 'Passed', val: stats.passed, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'Failed', val: stats.failed, icon: XCircle, color: 'text-rose-600 bg-rose-50' },
                        { label: 'Avg Score', val: `${stats.avgPercentage}%`, icon: Target, color: 'text-amber-600 bg-amber-50' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.color)}>
                            <s.icon size={16} strokeWidth={2.5} />
                          </div>
                          <div>
                            <p className="text-xl font-black text-slate-900 leading-none">{s.val}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">{s.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Attempts Table */}
                    {(attemptsByTest[test.id] || []).length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium text-center py-8">No attempts recorded for this test.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-100/80 rounded-xl">
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-l-xl">User</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Percentage</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Result</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Attempt</th>
                              <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-r-xl">Enrollment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(attemptsByTest[test.id] || []).map((att) => (
                              <tr key={att.id} className="hover:bg-white/80 transition-colors">
                                <td className="px-4 py-3">
                                  <span className="text-xs font-bold text-slate-700">{att.user_email}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {new Date(att.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-black text-slate-800">{att.score ?? 'â€”'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {att.percentage !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn(
                                          'h-full rounded-full',
                                          att.percentage >= 70 ? 'bg-emerald-500' :
                                          att.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                        )} style={{ width: `${Math.min(att.percentage, 100)}%` }} />
                                      </div>
                                      <span className="text-[10px] font-black text-slate-600">{Math.round(att.percentage)}%</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">â€”</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {att.status === 'completed' ? (
                                    att.is_passed ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        <CheckCircle size={10} /> PASS
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                        <XCircle size={10} /> FAIL
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-400 uppercase">{att.status}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold text-slate-500">#{att.attempt_number}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    'text-[10px] font-bold uppercase tracking-wider',
                                    att.enrollment_status === 'success' ? 'text-emerald-600' :
                                    att.enrollment_status === 'failed' ? 'text-rose-600' :
                                    att.enrollment_status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                                  )}>
                                    {att.enrollment_status === 'success' ? 'Enrolled' :
                                     att.enrollment_status === 'failed' ? 'Failed' :
                                     att.enrollment_status === 'pending' ? 'Pending' : 'None'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Question-Level Analytics */}
                    {getQuestionStats(test.id).length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Target size={14} className="text-brand-teal" />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Question-Level Breakdown</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-100/80 rounded-xl">
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-l-xl">#</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Question</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Marks</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Answered</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Correct</th>
                                <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-r-xl">Accuracy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {getQuestionStats(test.id).map((qs, i) => (
                                <tr key={qs.id} className="hover:bg-white/80 transition-colors">
                                  <td className="px-4 py-2.5 text-xs font-black text-slate-400">{i + 1}</td>
                                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 max-w-[300px] truncate">{qs.text}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={cn(
                                      'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                                      qs.type === 'multiple_choice' ? 'bg-purple-50 text-purple-600' :
                                      qs.type === 'true_false' ? 'bg-cyan-50 text-cyan-600' :
                                      'bg-blue-50 text-blue-600'
                                    )}>
                                      {qs.type === 'multiple_choice' ? 'Multi' : qs.type === 'true_false' ? 'T/F' : 'Single'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{qs.marks}</td>
                                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700">{qs.answered}</td>
                                  <td className="px-4 py-2.5 text-xs font-bold text-emerald-600">{qs.correct}</td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn(
                                          'h-full rounded-full',
                                          qs.accuracy >= 70 ? 'bg-emerald-500' :
                                          qs.accuracy >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                        )} style={{ width: `${qs.accuracy}%` }} />
                                      </div>
                                      <span className={cn(
                                        'text-[10px] font-black',
                                        qs.accuracy >= 70 ? 'text-emerald-600' :
                                        qs.accuracy >= 40 ? 'text-amber-600' : 'text-rose-600'
                                      )}>{qs.accuracy}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
