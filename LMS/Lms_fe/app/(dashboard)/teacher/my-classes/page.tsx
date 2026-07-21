'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Plus, TrendingUp, ArrowUpRight, CheckCircle2, X, Sparkles } from 'lucide-react';
import { courseAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

export default function TeacherMyClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getStoredUser();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('ðŸ‘¨â€ðŸ« Teacher My Classes: Fetching classes for user:', user?.id);

      // First get teacher's courses
      const coursesData = await courseAPI.getMyCourses();
      const courses = Array.isArray(coursesData)
        ? coursesData
        : (coursesData.results || coursesData || []);

      // Fetch scheduled classes directly by instructor_id
      let myClasses: any[] = [];
      if (user?.id) {
        try {
          const classesData = await courseAPI.getScheduledClasses(undefined, user.id).catch(() => []);
          myClasses = Array.isArray(classesData)
            ? classesData
            : (classesData.results || classesData || []);
        } catch (error) {
          console.error('Error fetching scheduled classes:', error);
        }
      }

      console.log('ðŸ“… Teacher My Classes: Classes received:', myClasses);
      setClasses(myClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const enrichedClasses = classes.map(c => ({
    ...c,
    course_name: typeof c.course === 'object' ? (c.course?.name || '') : (c.course?.title || ''),
    room_name: typeof c.room === 'object' ? (c.room?.name || '') : (c.room || ''),
  }));
  const { sortedData, sortConfig, requestSort } = useSortableData(enrichedClasses);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Loading classes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-7 h-7 text-brand-teal" />
            My Classes
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Check your schedule and mark attendance.</p>
        </div>
      </div>

      {/* Empty State */}
      {classes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center">
            <Calendar className="w-7 h-7 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">No classes found</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            You haven't been assigned any classes yet. Talk to your coordinator to start.
          </p>
        </div>
      ) : (
        /* Classes Table */
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <SortableTableHeader label="Class Name" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Days</th>
                  <SortableTableHeader label="Time" sortKey="start_time" currentSort={sortConfig} onSort={requestSort} />
                  <SortableTableHeader label="Location" sortKey="room_name" currentSort={sortConfig} onSort={requestSort} />
                  <SortableTableHeader label="Status" sortKey="active" currentSort={sortConfig} onSort={requestSort} />
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((classItem: any) => {
                  const days = classItem.days && Array.isArray(classItem.days)
                    ? classItem.days
                    : [];
                  const timeSlot = classItem.time_slot;
                  const isActive = classItem.status === 'ACTIVE' || classItem.active;
                  const courseName = classItem.course_name || (typeof classItem.course === 'string' ? classItem.course : classItem.course?.title || classItem.course?.name || 'Session');
                  const displayRoom = classItem.room_name || (typeof classItem.room === 'string' ? classItem.room : classItem.room?.name || '—');
                  const startTime = classItem.start_time?.slice(0, 5) || timeSlot?.start_time?.slice(0, 5);
                  const endTime = classItem.end_time?.slice(0, 5) || timeSlot?.end_time?.slice(0, 5);

                  return (
                    <tr
                      key={classItem.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      {/* Course */}
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-teal/10 transition-colors">
                            <Calendar className="w-5 h-5 text-slate-400 group-hover:text-brand-teal transition-all" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-slate-900 text-sm tracking-tight leading-tight">{courseName}</p>
                            {classItem.section && (
                              <span className="text-[10px] font-bold text-brand-teal uppercase tracking-widest mt-0.5 block">
                                Section {classItem.section}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Schedule Days */}
                      <td className="px-6 py-5 align-top">
                        {days.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {days.map((day: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase"
                              >
                                {day}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Time */}
                      <td className="px-6 py-5 align-top">
                        {startTime && endTime ? (
                          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            {startTime} - {endTime}
                          </div>
                        ) : timeSlot?.slot_name ? (
                          <div className="flex items-center gap-2 text-slate-900 text-xs font-black">
                            <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
                            {timeSlot.slot_name.toUpperCase()}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">PENDING</span>
                        )}
                      </td>

                      {/* Room */}
                      <td className="px-6 py-5 align-top">
                        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {displayRoom}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5 align-top">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wide">
                            <X className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 align-top text-right">
                        <button
                          onClick={() => router.push(`/teacher/attendance?class_id=${classItem.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                        >
                          MARK ATTENDANCE
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
