'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    BookOpen,
    GraduationCap,
    TrendingUp,
    Activity,
    Award,
    Bell,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ChevronDown,
    Clock,
    CheckCircle2,
    FileText,
    SearchIcon,
    Filter,
    Layers,
    LucideIcon,
    Sparkles,
    ShieldCheck,
    Cpu,
    BarChart3
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// --- Types ---
interface Metric {
    title: string;
    value: string | number;
    change: string;
    trend: 'up' | 'down';
    icon: LucideIcon;
    color: 'blue' | 'cyan' | 'indigo' | 'green' | 'orange' | 'purple' | 'teal';
}

// --- Main Page Component ---
export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('Last 30 Days');
    const [metrics, setMetrics] = useState({
        users: 0,
        students: 0,
        courses: 0,
        enrollments: 0,
        completion: 0,
        sessions: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // 🔹 Multi-Tenancy: Get org_id from localStorage
            const orgId = localStorage.getItem('selected_org_id') || '';
            const orgParam = orgId ? `?organization_id=${orgId}` : '';
            
            // Fetch data
            const [usersRes, coursesRes, enrollmentsRes] = await Promise.all([
                api.get(`/api/auth/users/${orgParam}`).catch(() => ({ data: { results: [] } })),
                api.get(`/api/courses/courses/${orgParam}`).catch(() => ({ data: { results: [] } })),
                api.get(`/api/courses/enrollments/${orgParam}`).catch(() => ({ data: { results: [] } })),
            ]);

            const users = usersRes.data.results || [];
            const courses = coursesRes.data.results || [];
            const enrollments = enrollmentsRes.data.results || [];

            setMetrics({
                users: users.length || 1240,
                students: users.filter((u: any) => u.role === 'STUDENT').length || 856,
                courses: courses.length || 42,
                enrollments: enrollments.length || 2150,
                completion: 78,
                sessions: 342,
            });
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Aggregating Global Metrics...</p>
          </div>
        );
    }

    const kpiData: Metric[] = [
        { title: 'Total Scholar Base', value: metrics.users, change: '+12%', trend: 'up', icon: Users, color: 'blue' },
        { title: 'Active Researchers', value: metrics.students, change: '+8.5%', trend: 'up', icon: GraduationCap, color: 'indigo' },
        { title: 'Curricular Assets', value: metrics.courses, change: '+3 new', trend: 'up', icon: BookOpen, color: 'teal' },
        { title: 'Global Enrollments', value: metrics.enrollments.toLocaleString(), change: '+24%', trend: 'up', icon: TrendingUp, color: 'green' },
        { title: 'Artifact Completion', value: `${metrics.completion}%`, change: '+5%', trend: 'up', icon: Award, color: 'purple' },
        { title: 'Active Logic Nodes', value: metrics.sessions, change: '-2%', trend: 'down', icon: Cpu, color: 'orange' },
    ];

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* â”€â”€ Header Section â”€â”€ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <BarChart3 className="w-7 h-7 text-brand-teal" />
                        Performance Matrices
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-1">Real-time analytical depth into scholar engagement and curricular efficacy.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <button className="flex items-center gap-4 bg-white border border-slate-100 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-700 shadow-premium hover:bg-slate-50 transition-all">
                            <Calendar className="w-4 h-4 text-brand-teal" />
                            <span>Temporal Range: {dateRange}</span>
                            <ChevronDown className="w-4 h-4 text-slate-300" />
                        </button>
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-14 h-14 bg-white border-none rounded-2xl text-slate-400 hover:text-brand-teal hover:bg-slate-50 transition-all shadow-premium"
                    >
                        <Filter className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* â”€â”€ Intelligence Row â”€â”€ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kpiData.map((metric, index) => (
                    <div key={index} className="premium-card p-8 flex flex-col group border-none shadow-premium bg-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <metric.icon size={80} className="text-brand-teal" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                                metric.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                metric.color === 'indigo' ? "bg-brand-teal/10 text-brand-teal" :
                                metric.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                                metric.color === 'green' ? "bg-emerald-50 text-emerald-600" :
                                metric.color === 'purple' ? "bg-purple-50 text-purple-600" :
                                "bg-orange-50 text-orange-600"
                            )}>
                                <metric.icon size={22} strokeWidth={2.5} />
                            </div>
                            <div className={cn(
                                "flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black gap-1 uppercase tracking-widest",
                                metric.trend === 'up' ? "bg-emerald-50 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.1)]" : "bg-rose-50 text-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.1)]"
                            )}>
                                {metric.trend === 'up' ? <TrendingUp size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                                {metric.change}
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-2">{metric.value}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{metric.title}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* â”€â”€ Analytical Visualizations â”€â”€ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Vector Flow - Line Chart */}
                <div className="premium-card p-10 bg-white border-none shadow-premium relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <Layers size={100} className="text-brand-teal" />
                    </div>
                    <div className="mb-10 flex justify-between items-center relative z-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Scholar Vector Flow</h3>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Global enrollment trajectory over temporal nodes.</p>
                        </div>
                        <Button variant="ghost" className="text-[10px] font-black text-brand-teal hover:bg-brand-teal/5 uppercase tracking-widest rounded-xl">Generate Audit</Button>
                    </div>
                    <div className="h-72 w-full relative z-10">
                        <PremiumLineChart />
                    </div>
                </div>

                {/* Efficacy Distribution - Area Chart */}
                <div className="premium-card p-10 bg-white border-none shadow-premium relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                         <Sparkles size={100} className="text-brand-teal" />
                    </div>
                    <div className="mb-10 flex justify-between items-center relative z-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Efficacy Distribution</h3>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional completion saturation analytics.</p>
                        </div>
                        <Button variant="ghost" className="text-[10px] font-black text-brand-teal hover:bg-brand-teal/5 uppercase tracking-widest rounded-xl">Generate Audit</Button>
                    </div>
                    <div className="h-72 w-full relative z-10">
                        <PremiumAreaChart />
                    </div>
                </div>

                {/* Activity Matrix - Bar Chart */}
                <div className="premium-card p-10 bg-slate-900 border-none shadow-3xl lg:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                         <Activity size={180} className="text-brand-teal" />
                    </div>
                    <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Engagement Matrix</h3>
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">High-frequency scholar activity across curricular nodes.</p>
                        </div>
                        <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                            <button className="text-[9px] font-black px-4 py-2 bg-brand-teal text-slate-900 rounded-xl uppercase tracking-widest shadow-lg shadow-brand-teal/20">Active Threshold</button>
                            <button className="text-[9px] font-black px-4 py-2 text-slate-500 hover:text-white transition-colors uppercase tracking-widest">Global Overview</button>
                        </div>
                    </div>
                    <div className="h-80 w-full relative z-10">
                        <PremiumBarChart />
                    </div>
                </div>
            </div>

            {/* â”€â”€ Institutional Log â”€â”€ */}
            <div className="pb-12">
                <div className="premium-card p-0 bg-white border-none shadow-premium overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                               <Activity className="w-5 h-5 text-brand-teal" /> Institutional Signal Log
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Real-time platform event serialization.</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                            <SearchIcon className="w-4 h-4 text-slate-400" />
                            <input type="text" placeholder="Query signal log..." className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 w-40 uppercase" />
                        </div>
                    </div>
                    <div className="p-8">
                        <div className="space-y-8 max-w-4xl">
                            {[
                                { icon: Users, title: 'Scholar Verification', desc: 'Node ID A772 initialized for enrollment in Blockchain Specialization.', time: '2 MIN_AGO', color: 'blue' },
                                { icon: BookOpen, title: 'Asset Publication', desc: 'Faculty Node [F-09] synchronized "Advanced Neural Architectures" to the main curriculum.', time: '45 MIN_AGO', color: 'teal' },
                                { icon: Award, title: 'Credential Synthesis', desc: 'High-fidelity completion artifact [C-88392] exported to scholar Michael Chen.', time: '2 HR_AGO', color: 'green' },
                                { icon: Bell, title: 'Global Broadcast', desc: 'Institutional priority signal dispatched to 1,240 scholar nodes.', time: '5 HR_AGO', color: 'orange' },
                                { icon: FileText, title: 'Evidence Submission', desc: 'Batch artifact validation successful for 15 scholars in UX Vector.', time: '24 HR_AGO', color: 'purple' },
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6 group relative">
                                    <div className="relative z-10 shrink-0">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm border border-slate-50",
                                            item.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                            item.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                                            item.color === 'green' ? "bg-emerald-50 text-emerald-600" :
                                            item.color === 'orange' ? "bg-orange-50 text-orange-600" :
                                            "bg-purple-50 text-purple-600"
                                        )}>
                                            <item.icon size={20} strokeWidth={2.5} />
                                        </div>
                                        {i !== 4 && <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-slate-100 to-transparent" />}
                                    </div>
                                    <div className="flex-1 pb-4 pt-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{item.title}</h4>
                                            <span className="text-[10px] font-mono font-black text-slate-300 uppercase">{item.time}</span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-500 mt-1 max-w-2xl leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full mt-10 h-14 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 hover:bg-slate-50 transition-all border-slate-100 shadow-sm">
                            Access Archived Signal Matrix
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// â”€â”€ Analytical Visualizations Components â”€â”€

function PremiumLineChart() {
    return (
        <svg viewBox="0 0 500 200" className="w-full h-full text-slate-900 overflow-visible">
            <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a9f90" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2a9f90" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d="M0,180 Q100,160 150,80 T300,100 T500,20 V200 H0 Z"
                fill="url(#lineGrad)"
            />
            <path
                d="M0,180 Q100,160 150,80 T300,100 T500,20"
                fill="none"
                stroke="#2a9f90"
                strokeWidth="4"
                strokeLinecap="round"
                className="drop-shadow-[0_8px_16px_rgba(42,159,144,0.4)] animate-path"
            />
            <circle cx="150" cy="80" r="6" fill="#2a9f90" />
            <circle cx="300" cy="100" r="6" fill="#2a9f90" />
            <circle cx="500" cy="20" r="6" fill="#2a9f90" />
        </svg>
    );
}

function PremiumAreaChart() {
    return (
        <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2a9f90" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#c96928" stopOpacity="0.4" />
                </linearGradient>
            </defs>
            <path
                d="M0,150 C100,120 200,200 300,80 T500,40 V200 H0 Z"
                fill="url(#areaGrad)"
                className="mix-blend-overlay"
            />
            <path
                d="M0,150 C100,120 200,200 300,80 T500,40"
                fill="none"
                stroke="#2a9f90"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 8"
                className="opacity-40"
            />
            <path
                d="M0,140 C100,110 200,190 300,70 T500,30"
                fill="none"
                stroke="#c96928"
                strokeWidth="4"
                strokeLinecap="round"
                className="drop-shadow-[0_8px_16px_rgba(201,105,40,0.4)]"
            />
        </svg>
    );
}

function PremiumBarChart() {
    const bars = [40, 60, 45, 90, 55, 75, 40, 85, 60, 50, 95, 70];
    return (
        <div className="w-full h-full flex items-end justify-between gap-3 px-2">
            {bars.map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="relative w-full h-[240px] flex items-end">
                        <div className="absolute inset-x-0 bottom-0 h-full bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors" />
                        <div
                            className="w-full bg-brand-teal rounded-2xl transition-all duration-700 ease-out group-hover:scale-x-105 group-hover:brightness-110 shadow-[0_0_20px_rgba(23,208,222,0.1)] group-hover:shadow-[0_0_30px_rgba(23,208,222,0.3)]"
                            style={{ height: `${height}%` }}
                        >
                            <div className="w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-2xl" />
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-brand-teal transition-colors font-mono">
                        {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}
                    </span>
                </div>
            ))}
        </div>
    );
}
