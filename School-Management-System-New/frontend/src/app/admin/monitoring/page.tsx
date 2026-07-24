"use client"

import { useMemo } from "react"
import {
    Zap, ShieldCheck, CheckCircle2, Users, FileText, Calendar, Banknote,
    Bell, HelpCircle, Building2, GraduationCap, Monitor, Database,
    Server, type LucideIcon,
} from "lucide-react"
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useSystemMonitoring } from "@/hooks/useSystemMonitoring"
import type { ServiceStat } from "@/hooks/useSystemMonitoring"

// ── Service registry ───────────────────────────────────────────────────────

interface Svc { id: string; name: string; port?: number; icon: LucideIcon; color: string }

const MICROSERVICES: Svc[] = [
    { id: 'auth',         name: 'Auth',        port: 8001, icon: ShieldCheck,   color: '#6366f1' },
    { id: 'org',          name: 'Org',         port: 8002, icon: Building2,     color: '#8b5cf6' },
    { id: 'campus',       name: 'Campus',      port: 8003, icon: Server,        color: '#0ea5e9' },
    { id: 'staff',        name: 'Staff',       port: 8004, icon: Users,         color: '#10b981' },
    { id: 'student',      name: 'Student',     port: 8005, icon: GraduationCap, color: '#14b8a6' },
    { id: 'attendance',   name: 'Attendance',  port: 8006, icon: CheckCircle2,  color: '#f59e0b' },
    { id: 'result',       name: 'Result',      port: 8007, icon: FileText,      color: '#f97316' },
    { id: 'timetable',    name: 'Timetable',   port: 8009, icon: Calendar,      color: '#06b6d4' },
    { id: 'fees',         name: 'Fees',        port: 8008, icon: Banknote,      color: '#22c55e' },
    { id: 'notification', name: 'Notify',      port: 8010, icon: Bell,          color: '#eab308' },
    { id: 'support',      name: 'Support',     port: 8011, icon: HelpCircle,    color: '#ef4444' },
]

const INFRA: Svc[] = [
    { id: 'frontend', name: 'Frontend (Next.js)',  icon: Monitor,  color: '#0ea5e9' },
    { id: 'redis',    name: 'Redis Cache',          icon: Zap,      color: '#ef4444' },
    { id: 'database', name: 'PostgreSQL Cluster',   icon: Database, color: '#10b981' },
]

function svcStatus(svc: ServiceStat | undefined): 'up' | 'down' | 'unknown' {
    if (!svc) return 'unknown'
    return svc.status === 'Healthy' ? 'up' : 'down'
}

function parseMs(latency: string | undefined): number {
    if (!latency) return 0
    const m = latency.match(/^(\d+)/)
    return m ? parseInt(m[1]) : 0
}

// ── SVG Gauge Meter (180° semicircle with smooth needle) ───────────────────


function GaugeMeter({ value, max = 150, active = false }: { value: number; max?: number; active?: boolean }) {
    const cx = 60, cy = 60, r = 46
    const circumference = Math.PI * r  // semicircle arc length ≈ 144.51

    const pt = (deg: number, radius = r) => {
        const rad = (deg * Math.PI) / 180
        return {
            x: +(cx + radius * Math.cos(rad)).toFixed(2),
            y: +(cy - radius * Math.sin(rad)).toFixed(2),
        }
    }

    const fullArc = `M ${pt(180).x} ${pt(180).y} A ${r} ${r} 0 0 1 ${pt(0).x} ${pt(0).y}`

    const pct = Math.min(Math.max(value / max, 0), 1)
    const rotateDeg = pct * 180
    // dashOffset 0 = full arc shown, circumference = nothing shown
    const dashOffset = circumference * (1 - pct)

    return (
        <svg viewBox="-5 -4 130 82" className="h-full w-auto mx-auto block">
            <defs>
                {/* Green → Yellow → Red horizontal gradient */}
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#10b981" />
                    <stop offset="40%"  stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
            </defs>

            {/* Background track — thin grey border */}
            <path d={fullArc} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" strokeOpacity="0.45" />

            {/* Gradient progress fill — animated via dashOffset */}
            {active && (
                <path
                    d={fullArc}
                    fill="none"
                    stroke="url(#gaugeGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeOpacity="0.85"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />
            )}

            {/* Smooth needle */}
            <g
                style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: `rotate(${rotateDeg}deg)`,
                    transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                <polygon
                    points={`${cx - (r - 12)},${cy} ${cx},${cy - 5} ${cx},${cy + 5}`}
                    fill="#1e293b"
                />
            </g>

            {/* Hub */}
            <circle cx={cx} cy={cy} r="6"   fill="#1e293b" />
            <circle cx={cx} cy={cy} r="3.5" fill="white" />
        </svg>
    )
}

// ── Service gauge card ─────────────────────────────────────────────────────

const LATENCY_MAX = 150

function ServiceGaugeCard({ def, svc }: { def: Svc; svc: ServiceStat | undefined }) {
    const Icon = def.icon
    const status = svcStatus(svc)
    const latencyMs = parseMs(svc?.latency)

    return (
        <div className="w-full bg-white rounded-2xl border-2 shadow-sm p-3" style={{ borderColor: `${def.color}22` }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: def.color }} />
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{def.name}</span>
                    {def.port && <span className="text-[9px] text-slate-400 font-bold shrink-0">:{def.port}</span>}
                </div>
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                    status === 'up'   ? 'bg-emerald-50 text-emerald-600' :
                    status === 'down' ? 'bg-rose-50 text-rose-600' :
                    'bg-slate-100 text-slate-400'
                }`}>
                    {status === 'up' ? 'UP' : status === 'down' ? 'DN' : 'N/A'}
                </span>
            </div>

            {/* Gauge */}
            <div className="h-[160px] flex justify-center">
                <GaugeMeter value={status === 'up' ? latencyMs : 0} max={LATENCY_MAX} active={status === 'up'} />
            </div>

            {/* Latency value */}
            <div className="text-center -mt-1">
                <span className="text-base font-black tabular-nums" style={{ color: def.color }}>
                    {status === 'up' ? svc?.latency || '—' : '—'}
                </span>
            </div>
        </div>
    )
}

// ── Combined CPU + Memory chart ────────────────────────────────────────────

function CombinedSysChart({ data, cpu, memory }: { data: any[]; cpu: number; memory: number }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">System Performance</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Real-time CPU &amp; Memory utilization</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CPU</p>
                        <p className="text-xl font-black tabular-nums text-indigo-600">{Math.round(cpu)}%</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">RAM</p>
                        <p className="text-xl font-black tabular-nums text-sky-500">{Math.round(memory)}%</p>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-[3px] rounded-full bg-indigo-500" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CPU</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-[3px] rounded-full bg-sky-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Memory</span>
                </div>
            </div>

            <div className="flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <defs>
                            <linearGradient id="g-cpu" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                            </linearGradient>
                            <linearGradient id="g-mem" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="#0ea5e9" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: any, name: any) => [`${Math.round(v)}%`, name === 'cpu' ? 'CPU' : 'Memory']}
                        />
                        <Area type="monotone" dataKey="memory" stroke="#0ea5e9" strokeWidth={2}   fill="url(#g-mem)" dot={false} isAnimationActive={false} />
                        <Area type="monotone" dataKey="cpu"    stroke="#6366f1" strokeWidth={2.5} fill="url(#g-cpu)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
            {sub && <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    )
}

// ── Infra card ─────────────────────────────────────────────────────────────

function InfraCard({ def, svc }: { def: Svc; svc: ServiceStat | undefined }) {
    const Icon = def.icon
    const status = svcStatus(svc)
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${def.color}18` }}>
                <Icon className="w-5 h-5" style={{ color: def.color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-slate-700 truncate">{def.name}</p>
                <p className="text-[10px] text-slate-400">{svc?.latency || '—'} · {svc?.uptime || '—'}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                    status === 'up'   ? 'bg-emerald-500' :
                    status === 'down' ? 'bg-rose-500 animate-pulse' :
                    'bg-slate-300'
                }`} />
                <span className={`text-[9px] font-black uppercase ${
                    status === 'up' ? 'text-emerald-600' : status === 'down' ? 'text-rose-600' : 'text-slate-400'
                }`}>{status === 'up' ? 'Online' : status === 'down' ? 'Down' : 'N/A'}</span>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MonitoringPage() {
    const { stats, history, isConnected } = useSystemMonitoring()

    const allSvcs  = [...MICROSERVICES, ...INFRA]
    const upCount   = useMemo(() => allSvcs.filter(s => svcStatus(stats?.services?.[s.id]) === 'up').length,   [stats])
    const downCount = useMemo(() => allSvcs.filter(s => svcStatus(stats?.services?.[s.id]) === 'down').length, [stats])

    return (
        <div className="p-5 space-y-4 bg-gray-50 min-h-screen">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">System Monitoring</h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {MICROSERVICES.length} microservices · {INFRA.length} infrastructure · real-time
                    </p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                    isConnected
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        : 'bg-rose-50 border-rose-100 text-rose-500'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {isConnected ? 'Live' : 'Offline'}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard label="Services Up"   value={`${upCount} / ${allSvcs.length}`} color="#10b981" sub="healthy services" />
                <KpiCard label="Services Down" value={downCount} color={downCount > 0 ? '#ef4444' : '#10b981'} sub={downCount > 0 ? 'need attention' : 'all systems go'} />
                <KpiCard label="CPU Load"      value={`${Math.round(stats?.cpu ?? 0)}%`} color="#6366f1" sub="server utilization" />
                <KpiCard label="RAM Usage"     value={`${Math.round(stats?.memory ?? 0)}%`} color="#0ea5e9" sub="memory consumption" />
            </div>

            {/* Infrastructure cards (left) + Combined chart (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch">
                {/* Left: 3 infra cards stacked */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Infrastructure</p>
                    {INFRA.map(def => (
                        <InfraCard key={def.id} def={def} svc={stats?.services?.[def.id]} />
                    ))}
                </div>
                {/* Right: combined CPU + Memory chart */}
                <div className="lg:col-span-3">
                    <CombinedSysChart data={history} cpu={stats?.cpu ?? 0} memory={stats?.memory ?? 0} />
                </div>
            </div>

            {/* Microservices gauge grid */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Microservices — Response Time Gauge</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {upCount} / {MICROSERVICES.length} online
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {MICROSERVICES.map(def => (
                        <ServiceGaugeCard
                            key={def.id}
                            def={def}
                            svc={stats?.services?.[def.id]}
                        />
                    ))}
                </div>
            </div>


        </div>
    )
}
