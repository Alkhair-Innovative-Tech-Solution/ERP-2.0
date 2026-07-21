'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, Users, BookOpen, MapPin, Clock, ChevronRight, AlertTriangle, Activity, Filter } from 'lucide-react';
import { courseAPI } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SectionSummary {
  id: string;
  course_name: string;
  course_code: string;
  section?: string;
  branch_name?: string;
  room_name?: string;
  teacher_name?: string;
  days: string[];
  start_time?: string;
  end_time?: string;
  total_students: number;
  total_applications: number;
  strength_status: string;
  attendance_rate: number;
  total_classes: number;
  status: string;
}

export default function CoordinatorSectionsPage() {
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [todayOnly, setTodayOnly] = useState(false);

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const params: { status?: string; today?: boolean; organization_id?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (todayOnly) params.today = true;
      if (orgId) params.organization_id = orgId;
      const data = await courseAPI.getCoordinatorSectionsSummary(params);
      setSections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch sections:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, todayOnly]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const filtered = sections.filter(s =>
    !search || s.course_name.toLowerCase().includes(search.toLowerCase()) ||
    s.course_code?.toLowerCase().includes(search.toLowerCase()) ||
    s.branch_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.teacher_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStrengthColor = (status: string) => {
    switch (status) {
      case 'full': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'filling_fast': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const filterTabs = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Upcoming', value: 'upcoming' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-brand-teal" />
            All Sections
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">{filtered.length} section{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            placeholder="Search sections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all w-72"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-4 py-2 rounded-2xl text-sm font-bold transition-all',
              statusFilter === tab.value
                ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button
          onClick={() => setTodayOnly(!todayOnly)}
          className={cn(
            'px-4 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-2',
            todayOnly
              ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
          )}
        >
          <Calendar className="w-4 h-4" />
          Today&apos;s Classes
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-black">No sections found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(section => (
            <Link
              key={section.id}
              href={`/coordinator/sections/${section.id}`}
              className="group bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl hover:shadow-slate-200/50 hover:border-brand-teal/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{section.course_code}</p>
                  <h3 className="text-sm font-black text-slate-800 mt-1 truncate">{section.course_name}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-teal group-hover:translate-x-1 transition-all shrink-0" />
              </div>

              <div className="space-y-2 text-xs text-slate-500">
                {section.section && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Section {section.section}</span>
                  </div>
                )}
                {section.branch_name && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{section.branch_name}</span>
                  </div>
                )}
                {section.teacher_name && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>{section.teacher_name}</span>
                  </div>
                )}
                {section.days && section.days.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{section.days.join(', ')} {section.start_time && section.end_time ? `${section.start_time} â€“ ${section.end_time}` : ''}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-black text-slate-700">{section.total_students}</span>
                  <span className="text-[9px] text-slate-400">students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className={cn("w-3.5 h-3.5", getAttendanceColor(section.attendance_rate))} />
                  <span className={cn("text-sm font-black", getAttendanceColor(section.attendance_rate))}>{section.attendance_rate}%</span>
                  <span className="text-[9px] text-slate-400">attendance</span>
                </div>
                <span className={cn("ml-auto px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", getStrengthColor(section.strength_status))}>
                  {section.strength_status === 'full' ? 'Full' : section.strength_status === 'filling_fast' ? 'Filling' : 'Seats'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


