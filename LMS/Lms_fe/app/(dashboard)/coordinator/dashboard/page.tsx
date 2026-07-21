'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, Calendar, CheckSquare, Award, 
  TrendingUp, Activity, ZapIcon, ArrowUpRight, 
  Search, Clock, RefreshCw, ShieldCheck, 
  LayoutDashboard, Receipt, ArrowDownCircle, ArrowUpCircle,
  ChevronRight, Layers, BookOpen, MapPin, AlertTriangle
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStoredUser } from '@/lib/auth';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { receiptAPI, courseAPI } from '@/lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area 
} from 'recharts';

export default function CoordinatorDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const currentTime = useCurrentTime();

  const { data: sectionsData = [] } = useQuery({
    queryKey: ['coordinator-sections'],
    queryFn: () => courseAPI.getCoordinatorSectionsSummary().catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const sections = useMemo(() => (sectionsData as any[]).slice(0, 6), [sectionsData]);

  const { data: receipts = [] } = useQuery({
    queryKey: ['coordinator-receipts'],
    queryFn: () => {
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      return receiptAPI.getAll(false, 3, orgId).then((d: any) => Array.isArray(d) ? d : d.results || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const financeStats = useMemo(() => {
    const list = receipts as any[];
    return {
      totalDeposits: list.length * 1000,
      totalReturns: list.filter((r: any) => r.is_returned).length * 1000,
    };
  }, [receipts]);

  const financeData = useMemo(() =>
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m) => ({
      name: m,
      deposits: Math.floor(Math.random() * 5000) + 2000,
      returns: Math.floor(Math.random() * 1000) + 200,
    })),
  []);

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const stats = [
    { label: 'Active Teachers', val: '24', icon: Users, color: 'blue', trend: 'Online' },
    { label: 'Classes Today', val: '12', icon: Calendar, color: 'teal', trend: 'Scheduled' },
    { label: 'Total Deposits', val: `PKR ${financeStats.totalDeposits}`, icon: Receipt, color: 'emerald', trend: 'Collected' },
    { label: 'Pending Certificates', val: '08', icon: Award, color: 'amber', trend: 'Priority' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* â”€â”€ Dashboard Hero â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-brand-teal" />
            {greeting()}, <span className="text-brand-teal">{user?.first_name || user?.username || 'Coordinator'}</span>
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Institutional operations are under your supervision. Here is the daily summary.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden md:flex flex-col items-end mr-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{currentTime.toLocaleDateString('en-US', { weekday: 'long' })}</p>
             <p className="text-sm font-black text-slate-800 leading-none tracking-tight">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
           </div>
            <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['coordinator-'] })}
            variant="outline" 
            className="rounded-2xl border-slate-200 h-11 px-5 font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all flex gap-2"
          >
               <RefreshCw className="w-4 h-4" /> Refresh Insight
            </Button>
        </div>
      </div>

      {/* â”€â”€ Intelligence Cards â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="premium-card p-6 group relative overflow-hidden transition-all hover:-translate-y-1">
            <div className={cn(
              "absolute -right-2 -top-2 w-16 h-16 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20",
              stat.color === 'blue' ? "bg-blue-600" : stat.color === 'emerald' ? "bg-emerald-600" : "bg-amber-600"
            )} />
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:rotate-6 duration-500 shadow-sm',
              stat.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
              stat.color === 'teal' ? 'bg-teal-50 text-teal-600' :
              stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            )}>
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{stat.val}</h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Your Sections â”€â”€ */}
      {sections.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tighter">
              <Layers className="w-5 h-5 inline mr-2 text-brand-teal" />
              Your Sections
            </h2>
            <Link href="/coordinator/sections" className="text-[10px] font-black text-brand-teal uppercase tracking-widest hover:text-brand-teal transition-colors">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((s: any) => (
              <Link
                key={s.id}
                href={`/coordinator/sections/${s.id}`}
                className="group bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:shadow-slate-200/50 hover:border-brand-teal/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.course_code}</p>
                    <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{s.course_name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-teal group-hover:translate-x-1 transition-all shrink-0" />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.total_students}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.branch_name || 'N/A'}</span>
                  {s.attendance_rate < 75 && (
                    <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-3 h-3" />{s.attendance_rate}%</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ Finance Chart â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tighter">Financial Overview</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Deposits vs Returns (Monthly)</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-teal" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deposits</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returns</span>
               </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeData}>
                <defs>
                  <linearGradient id="colorDep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2a9f90" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2a9f90" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="deposits" stroke="#2a9f90" strokeWidth={4} fillOpacity={1} fill="url(#colorDep)" />
                <Area type="monotone" dataKey="returns" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorRet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl transition-transform group-hover:scale-150" />
            <h4 className="text-[10px] font-black text-brand-teal uppercase tracking-widest mb-6">Financial Summary</h4>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-emerald-400">
                    <ArrowUpCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Collection</p>
                    <p className="text-lg font-black tracking-tighter">PKR {financeStats.totalDeposits}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-rose-400">
                    <ArrowDownCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Refunds</p>
                    <p className="text-lg font-black tracking-tighter">PKR {financeStats.totalReturns}</p>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={() => router.push('/coordinator/deposits')}
              className="w-full mt-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              View Full Report
            </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-8">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-6 flex items-center gap-2">
              <ZapIcon size={16} className="text-amber-500" />
              Quick Actions
            </h4>
            <div className="space-y-3">
              <button onClick={() => router.push('/coordinator/teachers')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-brand-teal/10 transition-colors group">
                <span className="text-xs font-bold text-slate-600 group-hover:text-brand-teal">Mark Teacher Attendance</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-teal" />
              </button>
              <button onClick={() => router.push('/coordinator/deposits')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-brand-teal/10 transition-colors group">
                <span className="text-xs font-bold text-slate-600 group-hover:text-brand-teal">Verify Deposit Slips</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-teal" />
              </button>
              <button onClick={() => router.push('/coordinator/schedule')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-brand-teal/10 transition-colors group">
                <span className="text-xs font-bold text-slate-600 group-hover:text-brand-teal">Manage Class Timings</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-teal" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Operational Grid â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        {[
          { 
            label: 'Teacher Attendance', 
            desc: 'Mark and review daily teacher attendance records.', 
            icon: CheckSquare, 
            href: '/coordinator/teachers', 
            color: 'from-brand-teal to-brand-dark',
            accent: 'text-blue-200' 
          },
          { 
            label: 'Class Schedule', 
            desc: 'View all active classes, times, and assigned rooms.', 
            icon: Calendar, 
            href: '/coordinator/schedule', 
            color: 'from-teal-500 to-emerald-600',
            accent: 'text-teal-200' 
          },
          { 
            label: 'Certifications', 
            desc: 'Verify and manage student certificates.', 
            icon: Award, 
            href: '/coordinator/certifications', 
            color: 'from-amber-500 to-orange-600',
            accent: 'text-amber-200' 
          },
        ].map((item, i) => (
          <Link key={i} href={item.href} className="group relative overflow-hidden rounded-[2.5rem] p-10 shadow-premium transition-all hover:shadow-2xl hover:-translate-y-2">
             <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.9] group-hover:opacity-100 transition-opacity", item.color)} />
             <div className="absolute top-0 right-0 p-10 opacity-10 transition-transform group-hover:scale-125 group-hover:rotate-12 duration-700">
                <item.icon size={120} strokeWidth={1} color="white" />
             </div>
             
             <div className="relative z-10 space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl">
                   <item.icon size={28} />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tighter leading-tight">{item.label}</h3>
                   <p className={cn("text-sm font-medium mt-2 leading-relaxed opacity-80", item.accent)}>{item.desc}</p>
                </div>
                <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.2em] pt-4 group-hover:gap-4 transition-all">
                   Manage Module <ArrowUpRight size={14} />
                </div>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
