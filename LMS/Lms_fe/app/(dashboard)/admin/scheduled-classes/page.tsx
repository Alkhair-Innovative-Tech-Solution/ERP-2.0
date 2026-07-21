'use client';

import { useState, useEffect } from 'react';
import { courseAPI, userAPI, batchAPI, branchAPI, campusAPI } from '@/lib/api';
import { GraduationCap } from 'lucide-react';
import {
    Calendar as CalendarIcon,
    MapPin,
    Clock,
    User,
    BookOpen,
    Plus,
    Edit,
    Trash2,
    X,
    Search,
    Filter,
    CheckCircle2,
    AlertCircle,
    Activity,
    ChevronDown,
    ZapIcon,
    Layers,
    ExternalLink,
    SearchIcon,
    MoreHorizontal,
    Maximize2,
    Settings2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';

interface ScheduledClass {
    id: string;
    course: {
        id: string;
        name: string;
        course_code: string;
    };
    instructor_id: string;
    teacher_name?: string;
    room: {
        id: string;
        name: string;
    };
    // 🔹 Campus (Primary)
    campus_id?: string;
    campus_name?: string;
    // 🔹 Branch (Deprecated)
    branch_id?: string;
    branch_name?: string;
    start_time: string;
    end_time: string;
    days: string[];
    section?: string;
    lab_room?: string;
    strength_status: string;
    status?: string;
    whatsapp_group_link_boys?: string;
    whatsapp_group_link_girls?: string;
    admission_open_date?: string;
    course_start_date?: string;
    course_end_date?: string;
    total_students: number;
    total_applications: number;
    active: boolean;
}

interface Batch {
    id: string;
    name: string;
}

export default function ScheduledClassesPage() {
    const [classes, setClasses] = useState<ScheduledClass[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [instructors, setInstructors] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [campuses, setCampuses] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [campusFilter, setCampusFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        course_id: '',
        instructor_id: '',
        teacher_name: '',
        room_id: '',
        campus_id: '',
        branch_id: '',
        section: '',
        lab_room: '',
        strength_status: 'seats_available',
        start_time: '',
        end_time: '',
        days: [] as string[],
        whatsapp_group_link_boys: '',
        whatsapp_group_link_girls: '',
        admission_open_date: '',
        course_start_date: '',
        course_end_date: '',
        active: true
    });

    // Room Form Data
    const [roomFormData, setRoomFormData] = useState({
        name: '',
        capacity: 30,
        campus_id: '',
        branch_id: ''
    });

    const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    useEffect(() => {
        fetchData();
    }, [statusFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const [classData, courseData, roomData, instructorData, campusData, branchData] = await Promise.all([
                courseAPI.getScheduledClasses(undefined, undefined, undefined, statusFilter !== 'ALL' ? statusFilter : undefined, true),
                courseAPI.getAll({ organization_id: orgId }),
                courseAPI.getRooms(),
                userAPI.getTeachers(),
                campusAPI.getAll(orgId),
                branchAPI.getAll()
            ]);

            setClasses(Array.isArray(classData) ? classData : (classData as any).results || []);
            setCourses(Array.isArray(courseData) ? courseData : (courseData as any).results || []);
            setInstructors(Array.isArray(instructorData) ? instructorData : []);
            setRooms(Array.isArray(roomData) ? roomData : (roomData as any).results || []);
            setCampuses(Array.isArray(campusData) ? campusData : []);
            setBranches(Array.isArray(branchData) ? branchData : []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (scheduledClass?: ScheduledClass) => {
        if (scheduledClass) {
            setEditingClass(scheduledClass);
            setFormData({
                course_id: scheduledClass.course.id,
                instructor_id: scheduledClass.instructor_id,
                teacher_name: scheduledClass.teacher_name || '',
                room_id: scheduledClass.room.id,
                campus_id: scheduledClass.campus_id || '',
                branch_id: scheduledClass.branch_id || '',
                section: scheduledClass.section || '',
                lab_room: scheduledClass.lab_room || '',
                strength_status: scheduledClass.strength_status || 'seats_available',
                start_time: scheduledClass.start_time,
                end_time: scheduledClass.end_time,
                days: scheduledClass.days,
                whatsapp_group_link_boys: scheduledClass.whatsapp_group_link_boys || '',
                whatsapp_group_link_girls: scheduledClass.whatsapp_group_link_girls || '',
                admission_open_date: scheduledClass.admission_open_date || '',
                course_start_date: scheduledClass.course_start_date || '',
                course_end_date: scheduledClass.course_end_date || '',
                active: scheduledClass.active
            });
        } else {
            setEditingClass(null);
            setFormData({
                course_id: '',
                instructor_id: '',
                teacher_name: '',
                room_id: '',
                campus_id: '',
                branch_id: '',
                section: '',
                lab_room: '',
                strength_status: 'seats_available',
                start_time: '',
                end_time: '',
                days: [],
        whatsapp_group_link_boys: '',
        whatsapp_group_link_girls: '',
                admission_open_date: '',
                course_start_date: '',
                course_end_date: '',
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleDayToggle = (day: string) => {
        if (formData.days.includes(day)) {
            setFormData({ ...formData, days: formData.days.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, days: [...formData.days, day] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.days.length === 0) {
                toast.error('Please select at least one day');
                return;
            }
            const cleanData = {
                ...formData,
                admission_open_date: formData.admission_open_date || null,
                course_start_date: formData.course_start_date || null,
                course_end_date: formData.course_end_date || null,
            };

            if (editingClass) {
                await courseAPI.updateScheduledClass(editingClass.id, cleanData);
                toast.success('Class updated successfully');
            } else {
                await courseAPI.createScheduledClass(cleanData);
                toast.success('Class scheduled successfully');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Error saving class:', error);
            const msg = error.response?.data?.detail || 'Failed to save class';
            toast.error(msg);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this scheduled class?')) {
            try {
                await courseAPI.deleteScheduledClass(id);
                toast.success('Class deleted successfully');
                fetchData();
            } catch (error) {
                toast.error('Failed to delete class');
            }
        }
    };

    const handleAddRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await courseAPI.createRoom(roomFormData);
            toast.success('Room added successfully');
            setRoomFormData({ name: '', capacity: 30, campus_id: '', branch_id: '' });
            const roomData = await courseAPI.getRooms();
            setRooms(Array.isArray(roomData) ? roomData : (roomData as any).results || []);
        } catch (error) {
            console.error('Error creating room:', error);
            toast.error('Failed to create room');
        }
    };

    const getInstructorName = (item: ScheduledClass) => {
        if (item.teacher_name) return item.teacher_name;
        const instructor = instructors.find(i => String(i.id) === String(item.instructor_id));
        return instructor ? instructor.full_name : 'Unknown Instructor';
    };

    const filteredClasses = classes.filter(c => {
        const iName = getInstructorName(c).toLowerCase();
        const matchesSearch = c.course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            iName.includes(searchTerm.toLowerCase()) ||
            c.room.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = !branchFilter || String(c.branch_id) === String(branchFilter);
        return matchesSearch && matchesBranch;
    });

    const enrichedClasses = filteredClasses.map(c => ({
      ...c,
      course_name: c.course?.name || '',
      room_name: c.room?.name || '',
    }));
    const { sortedData, sortConfig, requestSort } = useSortableData(enrichedClasses);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Optimizing Schedules...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* â”€â”€ Header Section â”€â”€ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <CalendarIcon className="w-7 h-7 text-brand-teal" />
                        Class Scheduling
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Manage institutional rhythms, teacher allocations, and room inventory.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setIsRoomModalOpen(true)}
                        className="rounded-2xl h-11 px-5 font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all flex gap-2"
                    >
                        <MapPin size={16} /> Room Assets
                    </Button>
                    <Button
                        onClick={() => handleOpenModal()}
                        className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 px-6 font-bold shadow-lg shadow-brand-teal/20 flex gap-2"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Schedule Session
                    </Button>
                </div>
            </div>

            {/* â”€â”€ Intelligence Row â”€â”€ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Filtered Classes', val: filteredClasses.length, icon: CalendarIcon, color: 'teal' },
                  { label: 'Total Influx', val: classes.reduce((acc, c) => acc + (c.total_students || 0), 0), icon: Activity, color: 'blue' },
                  { label: 'Room Capacity', val: rooms.length, icon: MapPin, color: 'purple' },
                  { label: 'Pending Apps', val: classes.reduce((acc, c) => acc + (c.total_applications || 0), 0), icon: Layers, color: 'orange' },
                ].map((s, idx) => (
                  <div key={idx} className="premium-card p-6 flex flex-col group border-none shadow-premium">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500 shadow-sm",
                      s.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" : 
                      s.color === 'blue' ? "bg-blue-50 text-blue-600" :
                      s.color === 'purple' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <s.icon size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</h3>
                  </div>
                ))}
            </div>

            {/* â”€â”€ Lifecycle Tabs â”€â”€ */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-full md:w-fit">
                {[
                    { key: 'ALL', label: 'All Sessions' },
                    { key: 'active', label: 'Active' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'completed', label: 'Completed' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={cn(
                            "px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all",
                            statusFilter === tab.key
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-400 hover:text-slate-700"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* â”€â”€ Search & Filter Registry â”€â”€ */}
            <div className="premium-card p-4 flex flex-col md:flex-row gap-4 items-center border-none shadow-premium bg-slate-50/50">
                <div className="relative flex-1 group">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by course nomenclature, faculty, or room identity..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all"
                    />
                </div>
                <div className="relative min-w-[180px]">
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="w-full appearance-none bg-white border border-slate-200 rounded-2xl py-3 pl-4 pr-10 text-xs font-black text-slate-600 uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal"
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <Button variant="outline" className="rounded-2xl h-11 border-slate-200 px-5 flex gap-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest bg-white">
                     <Filter size={14} /> Global Protocol
                </Button>
            </div>

            {/* â”€â”€ Registry Table â”€â”€ */}
            <div className="premium-card overflow-hidden border-none shadow-premium">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <SortableTableHeader label="Session Matrix" sortKey="course_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Faculty Allocation" sortKey="teacher_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Campus" sortKey="campus_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Temporal Rhythm" sortKey="start_time" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Deployment Room" sortKey="room_name" currentSort={sortConfig} onSort={requestSort} />
                                <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {sortedData.length > 0 ? (
                                sortedData.map((item) => (
                                    <tr key={item.id} className="hover:bg-brand-teal/5 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div>
                                                <p className="font-black text-slate-900 tracking-tight text-sm mb-1.5 group-hover:text-brand-teal transition-colors">{item.course.name}</p>
                                                <div className="flex gap-2">
                                                    <Badge className="bg-brand-teal/10 text-brand-teal border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5">
                                                        SEC-{item.section || 'N/A'}
                                                    </Badge>
                                                    {item.lab_room && (
                                                        <Badge className="bg-slate-100 text-slate-400 border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5">
                                                            {item.lab_room}
                                                        </Badge>
                                                    )}
                                                    {item.campus_id && (
                                                        <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[8px] uppercase tracking-widest px-1.5 py-0.5">
                                                            Campus: {item.campus_id.slice(0, 8)}...
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-brand-teal text-white flex items-center justify-center text-xs font-black shadow-lg shadow-brand-teal/20 transition-transform group-hover:rotate-6">
                                                    {getInstructorName(item).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                   <p className="text-sm font-black text-slate-700 tracking-tight truncate max-w-[150px] leading-tight">
                                                       {getInstructorName(item)}
                                                   </p>
                                                   <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Assigned Faculty</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                                                <span className="text-xs font-bold text-slate-700">
                                                    {item.campus_name || campuses.find(c => String(c.id) === String(item.campus_id))?.campus_name || item.branch_name || 'â€”'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-1.5 text-slate-900 text-xs font-black tracking-tight">
                                                    <Clock size={14} className="text-brand-teal" />
                                                    {item.start_time} - {item.end_time}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.days.map((day, idx) => (
                                                        <span key={`${day}-${idx}`} className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md text-[8px] font-black border border-slate-100/50 uppercase">{day}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                   <MapPin size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-900 tracking-tight">{item.room.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {(() => {
                                                const st = item.status || (item.active ? 'active' : 'completed');
                                                const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
                                                    active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle2 },
                                                    upcoming: { label: 'Upcoming', bg: 'bg-blue-50', text: 'text-blue-600', icon: CalendarIcon },
                                                    completed: { label: 'Completed', bg: 'bg-slate-100', text: 'text-slate-400', icon: X },
                                                };
                                                const cfg = statusConfig[st] || statusConfig.active;
                                                const Icon = cfg.icon;
                                                return (
                                                    <div className={`flex items-center gap-2 px-3 py-1 ${cfg.bg} ${cfg.text} rounded-xl w-fit group/status`}>
                                                        <Icon size={12} className="group-hover/status:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest underline decoration-2 decoration-emerald-200 underline-offset-2">{cfg.label}</span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => handleOpenModal(item)}
                                                    className="w-9 h-9 rounded-xl text-slate-400 hover:text-brand-teal hover:bg-brand-teal/5 transition-all"
                                                >
                                                    <Edit size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-200">
                                            <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                               <BookOpen size={48} strokeWidth={1} />
                                            </div>
                                            <div>
                                               <p className="text-xl font-black text-slate-900 tracking-tight">Registry Void</p>
                                               <p className="text-slate-400 font-medium text-sm mt-1">No scheduled matrix parameters found matching your filters.</p>
                                               <Button variant="ghost" onClick={() => setSearchTerm('')} className="mt-4 text-brand-teal font-black uppercase text-[10px] tracking-widest">Reset System Query</Button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* â”€â”€ Configuration Modal â”€â”€ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setIsModalOpen(false); }}></div>
                    <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl p-10 md:p-12 animate-in zoom-in-95 duration-300 border border-white max-h-[92vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-10">
                            <div>
                                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Session Architect</p>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                                    {editingClass ? 'Modify Schedule' : 'Initialize Session'}
                                </h2>
                                <p className="text-slate-500 font-medium text-sm mt-1">Define temporal bounds and resource allocation for the academic registry.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-10">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Course Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Curriculum</label>
                                    <select
                                        required
                                        value={formData.course_id}
                                        onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Curricular Module</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.name || c.title}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Section Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Registry Section / Batch ID</label>
                                    <input
                                        placeholder="e.g. ALPHA-2024 (SEC-01)"
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                        required
                                    />
                                </div>

                                {/* Instructor Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Faculty Allocation (System ID)</label>
                                    <div className="relative">
                                        <select
                                            required
                                            value={formData.instructor_id}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                const inst = instructors.find(i => String(i.id) === String(id));
                                                setFormData({ 
                                                    ...formData, 
                                                    instructor_id: id,
                                                    teacher_name: inst ? (inst.full_name || inst.email) : formData.teacher_name
                                                });
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Map Faculty Resource</option>
                                            {instructors.map(i => (
                                                <option key={i.id} value={i.id}>{i.full_name || i.email}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Teacher Display Name */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Faculty Identity (Front-face)</label>
                                    <input
                                        placeholder="Custom display identity for portals"
                                        value={formData.teacher_name}
                                        onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>

                                {/* Room Selection */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Spatial Asset Allocation</label>
                                    <select
                                        required
                                        value={formData.room_id}
                                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Deployable Room</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} (Capacity: {r.capacity})</option>
                                        ))}
                                        </select>
                                </div>

                                {/* Campus Selection (Primary) */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Campus</label>
                                    <select
                                        value={formData.campus_id}
                                        onChange={(e) => setFormData({ ...formData, campus_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Campus</option>
                                        {campuses.map(c => (
                                            <option key={c.id} value={c.id}>{c.campus_name} ({c.campus_code})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Lab / Room Details */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Localized Lab Detail</label>
                                    <input
                                        placeholder="e.g. Infrastructure Lab 04"
                                        value={formData.lab_room}
                                        onChange={(e) => setFormData({ ...formData, lab_room: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>

                                {/* Strength Status */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Occupancy Density Protocol</label>
                                     <select
                                        required
                                        value={formData.strength_status}
                                        onChange={(e) => setFormData({ ...formData, strength_status: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="seats_available">VACANCY_NOMINAL (Seats Available)</option>
                                        <option value="filling_fast">VACANCY_CRITICAL (Filling Fast)</option>
                                        <option value="full">OCCUPANCY_MAX (Full)</option>
                                    </select>
                                </div>

                                {/* WhatsApp Group - Boys */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Boys WhatsApp Group Link</label>
                                    <input
                                        placeholder="Boys group link"
                                        value={formData.whatsapp_group_link_boys}
                                        onChange={(e) => setFormData({ ...formData, whatsapp_group_link_boys: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>
                                {/* WhatsApp Group - Girls */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Girls WhatsApp Group Link</label>
                                    <input
                                        placeholder="Girls group link"
                                        value={formData.whatsapp_group_link_girls}
                                        onChange={(e) => setFormData({ ...formData, whatsapp_group_link_girls: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>
                            </div>

                            {/* Schedule Days */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recurrence Parameters (Days)</label>
                                <div className="flex flex-wrap gap-3">
                                    {daysOfWeek.map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleDayToggle(day)}
                                            className={cn(
                                              "px-6 py-3 rounded-2xl text-[11px] font-black transition-all border shadow-sm",
                                              formData.days.includes(day)
                                                ? 'bg-brand-teal border-brand-teal text-white shadow-brand-teal/20 scale-105'
                                                : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-brand-teal/30 hover:text-slate-600'
                                            )}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time Selection */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Activation Time (Start)</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Termination Time (End)</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                    />
                                </div>
                            </div>

                            {/* Automation Matrix */}
                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <Settings2 size={12} className="text-brand-teal" /> Automation Cycle Parameters
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Admission Gateway Open</label>
                                        <input
                                            type="date"
                                            value={formData.admission_open_date}
                                            onChange={(e) => setFormData({ ...formData, admission_open_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Module Activation Date (Start)</label>
                                        <input
                                            type="date"
                                            value={formData.course_start_date}
                                            onChange={(e) => setFormData({ ...formData, course_start_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Module Termination Date (End)</label>
                                        <input
                                            type="date"
                                            value={formData.course_end_date}
                                            onChange={(e) => setFormData({ ...formData, course_end_date: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 py-4 pl-1">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className="relative flex items-center">
                                    <input 
                                      type="checkbox" 
                                      checked={formData.active} 
                                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })} 
                                      className="peer w-6 h-6 opacity-0 absolute cursor-pointer" 
                                    />
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 peer-checked:bg-brand-teal peer-checked:border-brand-teal transition-all flex items-center justify-center">
                                       <CheckCircle2 color="white" size={14} className={cn("transition-opacity", formData.active ? "opacity-100" : "opacity-0")} />
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-[0.1em] group-hover:text-brand-teal transition-colors">Authorize Deployment Activation</span>
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 rounded-[24px] h-16 font-black text-slate-400 border-none bg-slate-50 hover:bg-slate-100 hover:text-slate-600 transition-all uppercase text-[11px] tracking-[0.2em]"
                                >
                                    Abort Cycle
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-[24px] h-16 font-black shadow-2xl shadow-brand-teal/20 transition-all uppercase text-[11px] tracking-[0.2em]"
                                >
                                    {editingClass ? 'Commit Changes' : 'Initialize Session'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* â”€â”€ Room Management Intelligence Modal â”€â”€ */}
            {isRoomModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setIsRoomModalOpen(false); }}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 md:p-12 animate-in zoom-in-95 duration-300 border border-white max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">Infrastructure Control</p>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Room Assets</h2>
                                <p className="text-slate-500 font-medium text-sm mt-1">Manage physical deployment sites and capacity limits.</p>
                            </div>
                            <button onClick={() => setIsRoomModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-8 pr-1 custom-scrollbar">
                            {/* Add Room Interface */}
                            <form onSubmit={handleAddRoom} className="space-y-4 bg-slate-50/50 p-6 rounded-[28px] border border-slate-100/50">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Room Identification</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INFRA-LAB-01"
                                        value={roomFormData.name}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Campus</label>
                                    <select
                                        value={roomFormData.campus_id}
                                        onChange={(e) => setRoomFormData({ ...roomFormData, campus_id: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Campus</option>
                                        {campuses.map(c => (
                                            <option key={c.id} value={c.id}>{c.campus_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-32 space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Capacity</label>
                                        <input
                                            type="number"
                                            value={roomFormData.capacity}
                                            onChange={(e) => setRoomFormData({ ...roomFormData, capacity: parseInt(e.target.value) })}
                                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                                            required min="1"
                                        />
                                    </div>
                                    <div className="flex-1 pt-6">
                                        <Button
                                            type="submit"
                                            className="w-full bg-brand-teal hover:bg-brand-dark text-white font-black rounded-2xl h-full shadow-lg shadow-brand-teal/10 transition-all uppercase text-[10px] tracking-widest"
                                        >
                                            Register Asset
                                        </Button>
                                    </div>
                                </div>
                            </form>

                            {/* Inventory Stream */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-4 flex items-center gap-2">
                                   <Layers size={12} className="text-brand-teal" /> Current Room Inventory
                                </h3>
                                <div className="space-y-3">
                                    {rooms.map(room => (
                                        <div key={room.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-[22px] hover:border-brand-teal/30 transition-all group shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-teal/10 group-hover:text-brand-teal transition-colors">
                                                    <MapPin size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm tracking-tight">{room.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Static Capacity: {room.capacity} Units {room.campus_name ? `| ${room.campus_name}` : room.branch_name ? `| ${room.branch_name}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                               {/* Room actions could go here */}
                                               <div className="w-2 h-2 rounded-full bg-brand-teal" />
                                            </div>
                                        </div>
                                    ))}
                                    {rooms.length === 0 && (
                                        <div className="text-center py-10">
                                            <p className="text-slate-300 font-medium italic text-sm">Registry empty. Add room assets above.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
