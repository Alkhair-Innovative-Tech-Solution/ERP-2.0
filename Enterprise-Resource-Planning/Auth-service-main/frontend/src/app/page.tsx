"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/utils/api";
import {
  Building2,
  LayoutGrid,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Activity,
  Settings,
  UserPlus,
  FolderPlus,
  FilePlus,
  ArrowRight,
  FileWarning,
  Clock,
  Briefcase,
  GitBranch,
  Edit2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StreamEvent {
  name: string;
  action: string;
  time: string;
  icon: "create" | "update" | "delete" | "system";
  type: string;
}

// ─── Simple SVG Bar Chart ────────────────────────────────────────────────────
function BarChart({ data }: { data: number[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const W = 220,
    H = 90;
  const max = Math.max(...data);
  const range = max > 0 ? max : 1;
  const barWidth = (W - 20) / data.length - 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
      {data.map((v, i) => {
        const barHeight = Math.max((v / range) * (H - 20), 4);
        const x = 10 + i * ((W - 20) / data.length) + 6;
        const y = H - 10 - barHeight;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill="currentColor"
              opacity={activeIndex === null ? 0.3 : (activeIndex === i ? 1 : 0.1)}
              className="text-theme-800 cursor-pointer transition-colors duration-300 hover:opacity-100"
              onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            />
            {/* Flat bottom for the bar */}
            <rect
              x={x}
              y={y + barHeight - 4}
              width={barWidth}
              height={4}
              fill="currentColor"
              opacity={activeIndex === null ? 0.3 : (activeIndex === i ? 1 : 0.1)}
              className="text-theme-800 pointer-events-none transition-colors duration-300"
            />
            {activeIndex === i && (
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="900"
                className="text-theme-800 pointer-events-none drop-shadow-sm"
              >
                {data[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
  color = "indigo",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  loading: boolean;
  color?: string;
}) {
  type ColorConfig = {
    text: string;
    bg: string;
    shadow: string;
    blob: string;
  };

  const colorMap: Record<string, ColorConfig> = {
    indigo: {
      text: "text-indigo-600",
      bg: "bg-indigo-50",
      shadow: "hover:shadow-indigo-500/20",
      blob: "bg-indigo-400/30",
    },
    emerald: {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      shadow: "hover:shadow-emerald-500/20",
      blob: "bg-emerald-400/30",
    },
    amber: {
      text: "text-amber-600",
      bg: "bg-amber-50",
      shadow: "hover:shadow-amber-500/20",
      blob: "bg-amber-400/30",
    },
    rose: {
      text: "text-rose-600",
      bg: "bg-rose-50",
      shadow: "hover:shadow-rose-500/20",
      blob: "bg-rose-400/30",
    },
  };

  const theme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl ${theme.shadow} hover:-translate-y-1 transition-all duration-300 group flex items-center justify-between  sm:p-4 relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-20 h-20 ${theme.blob} blur-[60px] rounded-full -mr-2 -mt-4`} />
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
        {loading ? (
          <div className="h-8 w-15 bg-slate-50 rounded animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none tracking-tighter">
              {value}
            </h2>
            {sub && (
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                {sub === "Workforce" ? "Live" : "Active"}
              </span>
            )}
          </div>
        )}
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme.bg} ${theme.text} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm`}>
        <Icon size={26} strokeWidth={2.5} />
      </div>
    </div>
  );
}

// ─── System Status Card ───────────────────────────────────────────────────────
function SystemStatusCard({
  active,
  inactive,
  color = "blue"
}: {
  active: number;
  inactive: number;
  color?: string;
}) {
  const colorMap: Record<string, any> = {
    blue: { text: "text-blue-600", bg: "bg-blue-400", shadow: "hover:shadow-blue-500/20", blob: "bg-blue-500/5" },
    emerald: { text: "text-emerald-600", bg: "bg-emerald-400", shadow: "hover:shadow-emerald-500/20", blob: "bg-emerald-500/5" },
    purple: { text: "text-theme-800", bg: "bg-theme-800", shadow: "hover:shadow-theme-800/20", blob: "bg-theme-800/5" },
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-2 sm:p-2 hover:shadow-2xl ${theme.shadow} hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${theme.blob} blur-[60px] rounded-full -mr-2 -mt-3`} />
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
        System Status
      </p>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-xs font-semibold text-slate-600">
          ACTIVE &nbsp;
          <span className="text-slate-900 font-black">{active}</span>
        </span>
        <span className="text-xs font-semibold text-slate-600">
          INACTIVE &nbsp;
          <span className="text-slate-900 font-black">{inactive}</span>
        </span>
        <span className="text-xs font-semibold text-slate-500">IS</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className={`h-2 ${theme.bg} rounded-full transition-all duration-700`}
          style={{
            width: `${active + inactive > 0 ? (active / (active + inactive)) * 100 : 80}%`,
          }}
        />
      </div>
      <div className={`flex items-center gap-1.5 text-[11px] ${theme.text} font-semibold`}>
        <CheckCircle2 size={13} />
        ALL SYSTEMS OPERATIONAL
      </div>
    </div>
  );
}

function OrgMixRow({
  label,
  count,
  total,
  color = "indigo",
}: {
  label: string;
  count: number;
  total: number;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    purple: "bg-theme-800",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
  };
  const bg = colorMap[color] || colorMap.indigo;
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="py-2 border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 px-2 rounded-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-5 rounded-full ${bg} opacity-40 group-hover:opacity-100 transition-all`} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-700 transition-colors">
            {label}
          </span>
        </div>
        <span className="text-sm font-black text-slate-800">{count}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${bg} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── Alert Item ───────────────────────────────────────────────────────────────
function AlertItem({
  color,
  icon: Icon,
  title,
  sub,
}: {
  color: "red" | "amber";
  icon: React.ElementType;
  title: string;
  sub: string;
}) {
  const palette = {
    red: "bg-red-50 border-red-100 text-red-500",
    amber: "bg-amber-50 border-amber-100 text-amber-500",
  };
  return (
    <div
      className={`rounded-lg border p-3.5 flex items-start gap-3 ${palette[color]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wide">{title}</p>
        <p className="text-[11px] mt-0.5 opacity-80 truncate">{sub}</p>
      </div>
      <ArrowRight size={14} className="mt-0.5 shrink-0 opacity-60" />
    </div>
  );
}

function EmployeeAlertItem({
  employee,
}: {
  employee: any;
}) {
  return (
    <a
      href={`/employees/${employee.employee_id}`}
      className="rounded-xl border border-slate-50 bg-slate-50/50 p-2.5 flex items-center gap-3 hover:bg-white hover:shadow-xl hover:shadow-theme-800/5 hover:-translate-y-0.5 transition-all duration-300 group"
    >
      <div className="w-10 h-10 rounded-xl bg-theme-800/10 flex items-center justify-center text-theme-800 font-black text-sm group-hover:bg-theme-800 group-hover:text-white transition-all duration-500 shadow-sm">
        {employee.full_name?.charAt(0) || "E"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight group-hover:text-theme-800 transition-colors">
          {employee.full_name}
        </p>
        <p className="text-[9px] text-slate-400 truncate uppercase tracking-widest font-black mt-0.5">
          {employee.designation?.position_name || "Employee"} 
        </p>
      </div>
      <ArrowRight size={14} className="shrink-0 text-slate-300 group-hover:text-theme-800 group-hover:translate-x-1 transition-all" />
    </a>
  );
}


// ─── Stream Row ───────────────────────────────────────────────────────────────
function StreamRow({ event }: { event: StreamEvent }) {
  const iconMap = {
    create: (
      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
        <FolderPlus size={16} className="text-emerald-500" />
      </div>
    ),
    update: (
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
        <Edit2 size={16} className="text-blue-500" />
      </div>
    ),
    delete: (
      <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-100">
        <XCircle size={16} className="text-rose-500" />
      </div>
    ),
    system: (
      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
        <Activity size={16} className="text-slate-400" />
      </div>
    ),
  };
  return (
    <div className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
      {iconMap[event.icon] || iconMap.system}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
            {event.name}
          </p>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">{event.type}</span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{event.action}</p>
      </div>
      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0">{event.time}</span>
    </div>
  );
}

// ─── Intelligence Hub Action ───────────────────────────────────────────────────
function HubAction({
  icon: Icon,
  label,
  sub,
  color = "indigo",
  href,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  color?: string;
  href: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    purple: "text-theme-800 bg-theme-800/10",
    blue: "text-blue-600 bg-blue-50",
  };

  const selectedColor = colorMap[color] || colorMap.indigo;

  return (
    <a
      href={href}
      className="flex flex-col items-center text-center gap-2 p-2 sm:p-3 bg-white border border-slate-100 rounded-2xl hover:shadow-2xl hover:shadow-theme-800/10 hover:-translate-y-1.5 transition-all duration-500 group"
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center ${selectedColor} shadow-sm transition-transform group-hover:scale-110`}
      >
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">
          {label}
        </p>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
      </div>
    </a>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    employees: 0,
    institutions: 0,
    departments: 0,
    designations: 0,
    branches: 0,
  });

  const [recentEmployees, setRecentEmployees] = useState<any[]>([]);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);

  const [deptMix, setDeptMix] = useState<{ name: string; count: number }[]>([]);

  const [trendData, setTrendData] = useState<{ trend: number[], labels: string[] }>({
    trend: [0, 0, 0, 0, 0, 0, 0],
    labels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [empRes, instRes, deptRes, desigRes, branchRes, auditRes] = await Promise.all([
          fetchWithAuth("/employees/employees?per_page=100"),
          fetchWithAuth("/employees/institutions"),
          fetchWithAuth("/employees/departments"),
          fetchWithAuth("/employees/designations"),
          fetchWithAuth("/employees/branches"),
          fetchWithAuth("/audit/logs?limit=8"),
        ]);

        const employees = empRes.ok ? await empRes.json() : { employees: [] };
        const institutions = instRes.ok ? await instRes.json() : [];
        const departments = deptRes.ok ? await deptRes.json() : [];
        const designations = desigRes.ok ? await desigRes.json() : [];
        const branches = branchRes.ok ? await branchRes.json() : [];
        const auditLogs = auditRes.ok ? await auditRes.json() : [];

        const empArr = Array.isArray(employees) ? employees : employees.employees || [];
        const instArr = Array.isArray(institutions) ? institutions : institutions.institutions || [];
        const deptArr = Array.isArray(departments) ? departments : departments.departments || [];
        const desigArr = Array.isArray(designations) ? designations : designations.designations || [];
        const branchArr = Array.isArray(branches) ? branches : [];

        setStats({
          employees: Array.isArray(employees) ? employees.length : (employees.total || 0),
          institutions: instArr.length,
          departments: deptArr.length,
          designations: desigArr.length,
          branches: branchArr.length,
        });

        // Set recent employees (first 5 from the sorted list)
        setRecentEmployees(empArr.slice(0, 4));

        // Map audit logs to stream events

        const events: StreamEvent[] = auditLogs.map((log: any) => {
          const timestamp = new Date(log.timestamp);
          const now = new Date();
          const diffMin = Math.floor((now.getTime() - timestamp.getTime()) / 60000);

          let timeMsg = "Just now";
          if (diffMin > 0) {
            if (diffMin < 60) timeMsg = `${diffMin}m ago`;
            else if (diffMin < 1440) timeMsg = `${Math.floor(diffMin / 60)}h ago`;
            else timeMsg = `${Math.floor(diffMin / 1440)}d ago`;
          }

          return {
            name: log.changed_by || "System",
            action: log.action,
            time: timeMsg,
            icon: log.action.toLowerCase() === 'created' ? 'create' : (log.action.toLowerCase() === 'deleted' ? 'delete' : 'update'),
            type: log.content_type
          };
        });
        setStreamEvents(events);
        // Calculate daily hiring trend for the last 7 days
        const now = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          last7Days.push(d);
        }
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const computedLabels = last7Days.map(d => dayNames[d.getDay()]);
        
        const computedTrend = last7Days.map(dayDate => {
          return empArr.filter((emp: any) => {
            if (!emp.created_at) return false;
            const empDate = new Date(emp.created_at);
            return empDate.getDate() === dayDate.getDate() && 
                   empDate.getMonth() === dayDate.getMonth() && 
                   empDate.getFullYear() === dayDate.getFullYear();
          }).length;
        });
        setTrendData({ trend: computedTrend, labels: computedLabels });

        // Build org mix from departments by counting employees in frontend
        if (deptArr.length > 0) {
          const counts: Record<string, number> = {};
          empArr.forEach((emp: any) => {
            const code = emp.department?.dept_code || "UNKNOWN";
            counts[code] = (counts[code] || 0) + 1;
          });

          const mix = deptArr.slice(0, 5).map((d: any) => ({
            name: d.dept_name || "Department",
            count: counts[d.dept_code] || 0,
          }));
          setDeptMix(mix.sort((a: any, b: any) => b.count - a.count));
        } else {
          setDeptMix([
            { name: "Engineering", count: 145 },
            { name: "Marketing", count: 85 },
            { name: "Sales", count: 170 },
            { name: "Administration", count: 110 },
            { name: "Strategy", count: 100 },
          ]);
        }
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <ProtectedLayout>
      <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 max-w-350 mx-auto animate-in fade-in duration-500">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 backdrop-blur-md ">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-theme-800 flex items-center justify-center text-white shadow-lg shadow-theme-800/20 font-black text-xl">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{greeting},</span>
                <span className="text-sm font-black text-theme-800 uppercase tracking-widest">{user?.full_name || "Guest"}</span>
              </div>

            </div>
          </div>
          {/* <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-4 py-2.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">
                Registry Sync
              </span>
              <span className="font-black text-slate-700">{today}</span>
            </div>

          </div> */}
        </div>

        {/* ── Row 1: Stat Cards + System Status ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 ">
          <StatCard
            title="Total Institutions"
            value={stats.institutions}
            sub="Strategic Base"
            icon={Building2}
            loading={loading}
            color="purple"
          />
          <StatCard
            title="Active Branchs"
            value={stats.departments}
            sub="Functional Hubs"
            icon={LayoutGrid}
            loading={loading}
            color="amber"
          />
          <StatCard
            title="Total Employees"
            value={stats.employees}
            sub="+1.2% growth"
            icon={Users}
            loading={loading}
            color="emerald"
          />
          <SystemStatusCard active={stats.employees} inactive={stats.branches} />
        </div>

        {/* ── Row 2: Org Mix | Monthly Growth | Alerts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">

          {/* Org Mix */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-500 p-3 sm:p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[80px] rounded-full -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
               Per Department Employees
              </h2>
              {/* <span className="text-[10px] font-black uppercase tracking-widest text-theme-800 bg-theme-800/10 px-2 py-1 rounded-full">
                Personnel Hubs
              </span> */}
            </div>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-6 bg-slate-50 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const totalMix = deptMix.reduce((acc: number, d: { count: number }) => acc + d.count, 0);
                  return deptMix.map((d: { name: string; count: number; }, index: number) => (
                    <OrgMixRow
                      key={index}
                      label={d.name}
                      count={d.count}
                      total={totalMix}
                      color={["purple", "amber", "emerald", "blue", "rose", "violet"][index % 6]}
                    />
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Monthly Growth */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-500 p-3 sm:p-4 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-8">
              <TrendingUp size={20} className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-800">
                Last 7 Days
              </h2>
            </div>
            <div className="h-32">
              <BarChart data={trendData.trend} />
            </div>
            <div className="flex justify-between mt-3 px-1">
              {trendData.labels.map((m, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold text-slate-400"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Recently Added Employees */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-500 p-3 sm:p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[80px] rounded-full -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                Recently Added 
              </h2>
              <Users size={18} className="text-emerald-500 shadow-lg shadow-emerald-200" />
            </div>
            
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulseimate-puls" />
                ))}
              </div>
            ) : recentEmployees.length > 0 ? (
              <div className="space-y-2">
                {recentEmployees.map((emp, i) => (
                  <EmployeeAlertItem key={i} employee={emp} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No recent data</p>
              </div>
            )}
          </div>

        </div>

        {/* ── Row 3: Intelligence Hub | Real-time Stream ── */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">


          {/* Intelligence Hub */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-theme-800/10 hover:-translate-y-1 transition-all duration-500 p-4 sm:p-5 relative overflow-hidden group/hub h-fit">
            <div className="absolute top-0 right-0 w-30 h-30 bg-theme-800/5 blur-[100px] rounded-full " />
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-1xl font-black text-slate-900 tracking-tighter uppercase">
                Intelligence Hub
              </h2>
              {/* <Settings size={22} className="text-slate-300 hover:rotate-90 transition-transform cursor-pointer" /> */}
            </div>
            {/* <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4 opacity-60 italic">
              Strategic Control & Monitoring
            </p> */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              <HubAction
                icon={UserPlus}
                label="Employees"
                sub="Workforce"
                color="purple"
                href="/employees"
              />
              <HubAction
                icon={FolderPlus}
                label="Departments"
                sub="Departments"
                color="amber"
                href="/departments"
              />
              <HubAction
                icon={FilePlus}
                label="Institutions"
                sub="Institutions"
                color="emerald"
                href="/institutions"
              />
              <HubAction
                icon={Briefcase}
                label="Desingnations"
                sub="Designation"
                color="blue"
                href="/designations"
              />
              <HubAction
                icon={GitBranch}
                label="Branches"
                sub="Branches"
                color="rose"
                href="/institutions?view=branches"
              />
            </div>
          </div>

          {/* Real-time Stream */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-500 p-3 sm:p-4 relative overflow-hidden group h-fit">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[80px] rounded-full -mr-10 -mt-10" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                System Stream
              </h2>
              <div className="relative">
                <Activity size={15} className="text-theme-800" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
              </div>
            </div>
            {loading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-2">
                    <div className="w-9 h-9 bg-slate-50 rounded-xl animate-pulse" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-1/2 bg-slate-50 rounded animate-pulse" />
                      <div className="h-2 w-1/3 bg-slate-50 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : streamEvents.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No activities detected</p>
              </div>
            ) : (
              <div className="space-y-1">
                {streamEvents.map((ev, i) => (
                  <StreamRow key={i} event={ev} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}


