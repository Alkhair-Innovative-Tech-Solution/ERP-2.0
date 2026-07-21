'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, BookOpen, Users, Plus, X, ArrowLeft, Check } from 'lucide-react';
import { courseAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function CreateScheduledClassPage() {
  const [formData, setFormData] = useState({
    course_id: '',
    section: '',
    room_id: '',
    class_name: '',
    days: [] as string[],
    start_time: '',
    end_time: '',
    status: 'ACTIVE'
  });

  const [courses, setCourses] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  
  const user = getStoredUser();
  const router = useRouter();

  const daysOfWeek = [
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
  ];

  useEffect(() => {
    fetchRequiredData();
  }, []);

  const fetchRequiredData = async () => {
    try {
      setFetchingData(true);
      const [coursesData, roomsData] = await Promise.all([
        courseAPI.getMyCourses(),
        courseAPI.getRooms().catch(() => [])
      ]);

      setCourses(Array.isArray(coursesData) ? coursesData : (coursesData.results || []));
      setRooms(Array.isArray(roomsData) ? roomsData : (roomsData.results || []));
    } catch (error) {
      console.error('Error fetching creation data:', error);
      toast.error('Failed to load session configuration');
    } finally {
      setFetchingData(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.course_id) return toast.error('Please select a course');
    if (formData.days.length === 0) return toast.error('Please select at least one day');
    if (!formData.start_time || !formData.end_time) return toast.error('Please set start and end times');

    try {
      setLoading(true);
      const payload = {
        ...formData,
        instructor_id: user?.id,
        // Ensure times are in HH:MM format if they aren't already
        start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time,
        end_time: formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time,
      };

      await courseAPI.createScheduledClass(payload);
      toast.success('Session scheduled successfully!');
      router.push('/teacher/my-classes');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.message || 'Failed to schedule session');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-e-brand-teal animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Configuring Workspaceâ€¦</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group mb-6"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm tracking-tight text-slate-400 group-hover:text-slate-900 transition-colors">Back to Sessions</span>
          </button>
          
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-7 h-7 text-brand-teal" />
            Schedule Session
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">
            Orchestrate new academic tracking parameters for your educational modules.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Main Configuration Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="p-10 border-b border-slate-50 bg-gradient-to-r from-slate-50/50 to-transparent">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                <BookOpen className="w-5 h-5" />
              </div>
              Core Configuration
            </h2>
          </div>

          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Session Name */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Session Display Name</label>
              <input
                type="text"
                placeholder="e.g., Advanced React Mastery - Morning Track"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-800 placeholder:text-slate-300"
                required
              />
            </div>

            {/* Course Selection */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Assigned Course</label>
              <div className="relative">
                <select
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl appearance-none focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-900 uppercase tracking-tight"
                  required
                >
                  <option value="" className="text-slate-900">Select a courseâ€¦</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id} className="text-slate-900">
                      {course.name || course.title}
                    </option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Section Code */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Section Code / Identifier</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g., Morning-A, Weekend-Batch"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-800 placeholder:text-slate-300"
                  required
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Configuration Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="p-10 border-b border-slate-50 bg-gradient-to-r from-slate-50/50 to-transparent">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                <Calendar className="w-5 h-5" />
              </div>
              Timeline & Venue
            </h2>
          </div>

          <div className="p-10 space-y-10">
            {/* Days Selection */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Weekly Frequency</label>
              <div className="flex flex-wrap gap-3">
                {daysOfWeek.map(day => {
                  const isSeleceed = formData.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border shadow-sm ${
                        isSeleceed 
                          ? 'bg-brand-dark text-white border-brand-dark shadow-xl shadow-brand-dark/20 scale-105 active:scale-95' 
                          : 'bg-slate-50 text-slate-400 border-slate-100/80 hover:border-brand-teal/30 hover:bg-white hover:text-brand-teal'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Seare Time */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Session Start</label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-800"
                    required
                  />
                  <Clock className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
                </div>
              </div>

              {/* End Time */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Session Release</label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-800"
                    required
                  />
                  <Clock className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
                </div>
              </div>

              {/* Room Selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Location / Room</label>
                <div className="relative">
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl appearance-none focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal transition-all font-bold text-slate-900"
                  >
                    <option value="" className="text-slate-900">Select Locationâ€¦</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id} className="text-slate-900">{room.name}</option>
                    ))}
                  </select>
                  <MapPin className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
          >
            Discard Changes
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary !px-12 !py-4.5 !rounded-2xl flex items-center gap-3 shadow-2xl shadow-brand-teal/30 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-e-white rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            <span className="font-black uppercase tracking-widest text-sm">
              {loading ? 'Finalizingâ€¦' : 'Establish Session'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
