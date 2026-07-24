"use client"

import { useState, useEffect } from "react"
import {
    Globe, Users, ShieldCheck, Activity, TrendingUp, ChevronRight,
    Building2, GraduationCap, Cpu, Wifi, WifiOff, ArrowUpRight,
    CheckCircle2, AlertTriangle, Circle,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useRouter } from "next/navigation"
import { useSystemMonitoring } from "@/hooks/useSystemMonitoring"

interface OrgStats {
    id: number
    name: string
    code_prefix: string
    used_students: number
    max_students: number
    used_users: number
    is_active: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function svcUp(status: string | undefined) {
    return status === 'Healthy'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
    label, value, sub, icon: Icon, color, onClick,
}: {
    label: string; value: string | number; sub: string
    icon: React.ElementType; color: string; onClick?: () => void
}) {
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 transition-all' : ''}`}
        >
            <div className="p-3 rounded-xl shrink-0" style={{ background: `${color}15` }}>
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
            </div>
            {onClick && <ArrowUpRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
        </div>
    )
}

function ServiceRow({ name, status }: { name: string; status: string | undefined }) {
    const up = svcUp(status)
    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
                {up
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : status
                    ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                    : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                }
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wide">{name}</span>
            </div>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                up      ? 'bg-emerald-50 text-emerald-600' :
                status  ? 'bg-rose-50 text-rose-500' :
                'bg-slate-100 text-slate-400'
            }`}>
                {up ? 'UP' : status ? 'DOWN' : '—'}
            </span>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────

const SERVICES = [
    { key: 'auth',         label: 'Auth' },
    { key: 'org',          label: 'Org' },
    { key: 'campus',       label: 'Campus' },
    { key: 'staff',        label: 'Staff' },
    { key: 'student',      label: 'Student' },
    { key: 'attendance',   label: 'Attendance' },
    { key: 'result',       label: 'Result' },
    { key: 'timetable',    label: 'Timetable' },
    { key: 'fees',         label: 'Fees' },
    { key: 'notification', label: 'Notification' },
    { key: 'support',      label: 'Support' },
    { key: 'database',     label: 'PostgreSQL' },
    { key: 'redis',        label: 'Redis' },
]

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#06b6d4', '#22c55e', '#eab308', '#ef4444']

export function SuperAdminDashboard() {
    const router = useRouter()
    const { stats: live, isConnected } = useSystemMonitoring()
    const [orgs, setOrgs] = useState<OrgStats[]>([])
    const [loading, setLoading] = useState(true)
    const [counts, setCounts] = useState({ totalOrgs: 0, activeOrgs: 0, totalStudents: 0, totalUsers: 0 })

    useEffect(() => {
        async function load() {
            try {
                const token = localStorage.getItem("sis_access_token")
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/organizations/`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json()
                const list: OrgStats[] = Array.isArray(data) ? data : (data.results || [])
                setOrgs(list)
                setCounts({
                    totalOrgs: list.length,
                    activeOrgs: list.filter(o => o.is_active).length,
                    totalStudents: list.reduce((s, o) => s + (o.used_students || 0), 0),
                    totalUsers: list.reduce((s, o) => s + (o.used_users || 0), 0),
                })
            } catch { /* silent */ } finally { setLoading(false) }
        }
        load()
    }, [])

    const upCount   = SERVICES.filter(s => svcUp(live?.services?.[s.key]?.status)).length
    const downCount = SERVICES.filter(s => live?.services?.[s.key] && !svcUp(live?.services?.[s.key]?.status)).length
    const healthLabel = !isConnected ? 'Connecting...' : downCount === 0 ? 'All Systems OK' : `${downCount} Service${downCount > 1 ? 's' : ''} Down`
    const healthColor = !isConnected ? '#94a3b8' : downCount === 0 ? '#10b981' : '#ef4444'

    const chartData = [...orgs]
        .sort((a, b) => b.used_students - a.used_students)
        .slice(0, 10)
        .map(o => ({ name: o.name.length > 14 ? o.name.slice(0, 13) + '…' : o.name, students: o.used_students, users: o.used_users }))

    if (loading) {
        return (
            <div className="p-6 space-y-5 animate-pulse">
                <div className="h-9 w-72 bg-gray-200 rounded-xl" />
                <div className="grid grid-cols-4 gap-4">
                    {[0,1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
                </div>
                <div className="h-[420px] bg-gray-50 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-5 bg-gray-50 min-h-screen">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Platform Management</h1>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        Unified global observability · {counts.totalOrgs} organizations
                    </p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                    isConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                    {isConnected
                        ? <Wifi className="w-3 h-3" />
                        : <WifiOff className="w-3 h-3" />
                    }
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {isConnected ? 'Live Sync Active' : 'Offline'}
                </div>
            </div>

            {/* ── KPI cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Organizations" value={counts.totalOrgs}
                    sub={`${counts.activeOrgs} active`}
                    icon={Globe} color="#6366f1"
                    onClick={() => router.push('/admin/organizations')}
                />
                <StatCard
                    label="Platform Students" value={counts.totalStudents.toLocaleString()}
                    sub="across all organizations"
                    icon={GraduationCap} color="#10b981"
                />
                <StatCard
                    label="Platform Users" value={counts.totalUsers.toLocaleString()}
                    sub="staff + admins"
                    icon={Users} color="#8b5cf6"
                />
                <StatCard
                    label="System Health" value={healthLabel}
                    sub={isConnected ? `${upCount} / ${SERVICES.length} services up` : 'connecting to monitor...'}
                    icon={Activity} color={healthColor}
                    onClick={() => router.push('/admin/monitoring')}
                />
            </div>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Enrollment bar chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                <TrendingUp className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Enrollment Distribution</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Top organizations by student count</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/admin/organizations')}
                            className="flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                        >
                            Manage All <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="px-4 pt-2 pb-4">
                        {chartData.length === 0 ? (
                            <div className="h-[220px] flex flex-col items-center justify-center text-slate-300">
                                <Building2 className="w-12 h-12 mb-3 opacity-30" />
                                <p className="text-[11px] font-black uppercase tracking-widest">No organizations yet</p>
                            </div>
                        ) : (
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false} tickLine={false}
                                            tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                            interval={0} angle={-20} textAnchor="end"
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#cbd5e1' }} domain={[0, 'auto']} allowDataOverflow={false} />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                        />
                                        <Bar dataKey="students" name="Students" radius={[6, 6, 0, 0]} barSize={36}>
                                            {chartData.map((_, i) => (
                                                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                {/* Live Services Status */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-xl">
                                <ShieldCheck className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Services Status</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                    {upCount} up · {downCount} down
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/admin/monitoring')}
                            className="flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                        >
                            Monitor <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="px-3 py-3 space-y-0.5 overflow-y-auto max-h-[220px]">
                        {SERVICES.map(s => (
                            <ServiceRow key={s.key} name={s.label} status={live?.services?.[s.key]?.status} />
                        ))}
                    </div>

                    {/* CPU bar at bottom */}
                    <div className="px-5 py-4 border-t border-gray-50 bg-slate-50/50">
                        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <div className="flex items-center gap-1.5">
                                <Cpu className="w-3 h-3" />
                                <span>CPU Load</span>
                            </div>
                            <span className="text-slate-600">{Math.round(live?.cpu ?? 0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-indigo-500 to-sky-400"
                                style={{ width: `${live?.cpu ?? 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 mb-1">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3" />
                                <span>Memory</span>
                            </div>
                            <span className="text-slate-600">{Math.round(live?.memory ?? 0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-violet-500 to-purple-400"
                                style={{ width: `${live?.memory ?? 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
