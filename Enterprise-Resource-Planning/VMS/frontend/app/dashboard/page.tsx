"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDashboardStats, getVisits, getEmployees, updateVisitHost } from "@/lib/api";
import { DashboardStats, Visit, Employee } from "@/lib/types";
import { VisitRow } from "@/components/VisitRow";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, UserCheck, Clock, CalendarClock, TrendingUp, Wifi, WifiOff, ArrowUpRight, Edit, Check, X, Search, Building2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // Edit modal state
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [employeeSearchQ, setEmployeeSearchQ] = useState("");
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([
        getDashboardStats(),
        getVisits({ today: "1" }),
      ]);
      setStats(s);
      setVisits(v.results || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Search employees when editing
  useEffect(() => {
    if (employeeSearchQ.length < 2) { setEmployeeResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getEmployees(employeeSearchQ);
        setEmployeeResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [employeeSearchQ]);

  const openEditModal = (visit: Visit) => {
    setEditingVisit(visit);
    setEmployeeSearchQ("");
    setSelectedEmployee(null);
    setEmployeeResults([]);
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeSearchQ(`${emp.name} — ${emp.designation} (${emp.department})`);
    setEmployeeResults([]);
  };

  // WebSocket — always relative to current host via nginx
  useEffect(() => {
    if (typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/ws/dashboard/`;
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryDelay = 2000;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => { setWsConnected(true); retryDelay = 2000; };
        ws.onclose = () => {
          setWsConnected(false);
          retryTimeout = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, 15000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === "visit_notification" || msg.type === "visit_update") fetchAll();
        };
      } catch {}
    };
    connect();
    return () => { ws?.close(); clearTimeout(retryTimeout); };
  }, [fetchAll]);

  const pendingVisits = visits.filter((v) => v.status === "pending_approval");
  const activeVisits = visits.filter((v) => v.status === "checked_in");

  const statCards = stats ? [
    { label: "Today's Visits", value: stats.today.total, icon: Users, accent: "#6366f1", bg: "#eef2ff", href: "/dashboard/visits?today=1" },
    { label: "Checked In", value: stats.currently_inside, icon: UserCheck, accent: "#059669", bg: "#d1fae5", href: "/dashboard/visits?status=checked_in" },
    { label: "Pending Approval", value: stats.pending_approval, icon: Clock, accent: "#d97706", bg: "#fef3c7", href: "/dashboard/visits?status=pending_approval" },
    { label: "Scheduled Today", value: stats.today.scheduled, icon: CalendarClock, accent: "#0284c7", bg: "#e0f2fe", href: "/dashboard/visits?status=scheduled" },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, color: "var(--color-ink-900)", margin: 0 }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
          </h1>
          <p style={{ color: "var(--color-ink-400)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.375rem 0.875rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 500,
          background: wsConnected ? "#d1fae5" : "#fef3c7",
          color: wsConnected ? "#065f46" : "#92400e",
          border: `1px solid ${wsConnected ? "#a7f3d0" : "#fde68a"}`,
        }}>
          {wsConnected
            ? <><Wifi style={{ width: 12, height: 12 }} /> Live</>
            : <><WifiOff style={{ width: 12, height: 12 }} /> Polling</>
          }
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {statCards.map(({ label, value, icon: Icon, accent, bg, href }) => (
            <div key={label}
              onClick={() => router.push(href)}
              style={{
                background: "white", borderRadius: "1.25rem",
                border: "1px solid #f0ede8", padding: "1.25rem",
                boxShadow: "0 1px 3px rgb(0,0,0,0.04)",
                position: "relative", overflow: "hidden",
                cursor: "pointer", transition: "box-shadow 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgb(0,0,0,0.1)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgb(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "#8a8679", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
                  <p style={{ fontSize: "2.25rem", fontWeight: 700, color: "#141310", margin: "0.5rem 0 0", fontFamily: "var(--font-display)", lineHeight: 1 }}>{value}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "0.75rem", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon style={{ width: 18, height: 18, color: accent }} />
                </div>
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}22, ${accent}66)`, borderRadius: "0 0 1.25rem 1.25rem" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
        {/* Left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Pending */}
          {pendingVisits.length > 0 && (
            <div style={{ background: "white", borderRadius: "1.25rem", border: "1px solid #fde68a", overflow: "hidden", boxShadow: "0 0 0 4px #fffbeb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem 1.25rem", background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400e" }}>
                  Pending Approval — {pendingVisits.length} visitor{pendingVisits.length > 1 ? "s" : ""} waiting
                </span>
              </div>
              <div style={{ padding: "0.5rem" }}>
                {pendingVisits.map((v) => (
                  <div key={v.id} className="relative">
                    <VisitRow visit={v} onRefresh={fetchAll} onApproved={() => {}} />
                    {/* PROMINENT ALERT for "Other" host (manual entry only) */}
                    {v.host_type === "manual" && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">ℹ️ Visitor selected "Other" host</span>
                          <button
                            onClick={() => openEditModal(v)}
                            className="ml-auto flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                            Assign Employee
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Host entered: <span className="font-medium text-slate-700">{v.host_name}</span> — Please assign the correct employee</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's activity */}
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1px solid #f0ede8", overflow: "hidden", boxShadow: "0 1px 3px rgb(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #f4f3f0" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#3a3834" }}>Today's Activity</span>
              <span style={{ fontSize: "0.75rem", color: "#8a8679", background: "#f4f3f0", padding: "0.25rem 0.625rem", borderRadius: "99px" }}>{visits.length} total</span>
            </div>
            <div style={{ padding: "0.5rem", maxHeight: "420px", overflowY: "auto" }}>
              {visits.length === 0
                ? <div style={{ padding: "3rem", textAlign: "center", color: "#b0aca0", fontSize: "0.875rem" }}>No visits today yet</div>
                : visits.map((v) => <VisitRow key={v.id} visit={v} onRefresh={fetchAll} onApproved={() => {}} />)
              }
            </div>
          </div>
        </div>

        {/* Right col */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* 7-day chart */}
          {stats && (
            <div style={{ background: "white", borderRadius: "1.25rem", border: "1px solid #f0ede8", padding: "1.25rem", boxShadow: "0 1px 3px rgb(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <TrendingUp style={{ width: 15, height: 15, color: "#8a8679" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#3a3834" }}>Last 7 Days</span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={stats.last_7_days} barSize={22} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "EEE")}
                    tick={{ fontSize: 10, fill: "#8a8679" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#141310", border: "none", borderRadius: "10px", fontSize: "12px", color: "#f4f3f0" }}
                    labelFormatter={(d) => format(new Date(d), "MMM d")}
                    itemStyle={{ color: "#f4f3f0" }} cursor={{ fill: "#f4f3f0" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.last_7_days.map((_, i) => (
                      <Cell key={i} fill={i === 6 ? "#6366f1" : "#e8e6e0"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Inside now */}
          {activeVisits.length > 0 && (
            <div style={{ background: "white", borderRadius: "1.25rem", border: "1px solid #f0ede8", padding: "1.25rem", boxShadow: "0 1px 3px rgb(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#3a3834" }}>Checked In</span>
                <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#059669", background: "#d1fae5", padding: "0.125rem 0.5rem", borderRadius: "99px", fontWeight: 500 }}>{activeVisits.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {activeVisits.slice(0, 5).map((v) => {
                  const initials = v.visitor_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "0.625rem", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#065f46", flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#141310", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.visitor_name}</p>
                        <p style={{ fontSize: "0.7rem", color: "#8a8679", margin: 0 }}>
                          {v.checked_in_at ? `In at ${format(new Date(v.checked_in_at), "HH:mm")}` : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Frequent visitors */}
          {stats && stats.most_visited.length > 0 && (
            <div style={{ background: "white", borderRadius: "1.25rem", border: "1px solid #f0ede8", padding: "1.25rem", boxShadow: "0 1px 3px rgb(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#3a3834" }}>Frequent Visitors</span>
                <ArrowUpRight style={{ width: 14, height: 14, color: "#b0aca0", marginLeft: "auto" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {stats.most_visited.map((v, i) => {
                  const initials = v.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                  const colors = ["#eef2ff", "#fce7f3", "#fef3c7", "#d1fae5", "#e0f2fe"];
                  const textColors = ["#4338ca", "#be185d", "#92400e", "#065f46", "#0369a1"];
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "0.75rem", background: colors[i % 5], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: textColors[i % 5], flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#141310", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.full_name}</p>
                        <p style={{ fontSize: "0.7rem", color: "#8a8679", margin: 0 }}>{v.company || "—"}</p>
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6366f1", background: "#eef2ff", padding: "0.125rem 0.5rem", borderRadius: "99px", flexShrink: 0 }}>{v.visit_count}×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal for "Other" Host */}
      {editingVisit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingVisit(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Assign Employee to Visitor</h2>
                <p className="text-sm text-gray-500 mt-1">Visitor: <span className="font-semibold">{editingVisit.visitor_name}</span></p>
              </div>
              <button onClick={() => setEditingVisit(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Current Info */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 font-medium uppercase">Current Host (Manual Entry)</p>
                <p className="text-lg font-medium text-slate-800 mt-1">{editingVisit.host_name}</p>
              </div>

              {/* Employee Search */}
              <div>
                <label className="label">Search Employee</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={employeeSearchQ}
                    onChange={(e) => {
                      setEmployeeSearchQ(e.target.value);
                      setSelectedEmployee(null);
                    }}
                    className="input pl-9"
                    placeholder="Search by name, department, or designation..."
                    autoFocus
                  />
                </div>
                
                {employeeResults.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {employeeResults.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => selectEmployee(emp)}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                          {emp.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-500">{emp.designation} — {emp.department}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Employee */}
              {selectedEmployee && (
                <div className="p-4 bg-slate-100 border border-slate-300 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-slate-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Selected Employee</p>
                      <p className="text-base font-medium text-slate-900">{selectedEmployee.name}</p>
                      <p className="text-xs text-slate-500">{selectedEmployee.designation} — {selectedEmployee.department}</p>
                      <p className="text-xs text-slate-400">{selectedEmployee.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setEditingVisit(null)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedEmployee || !editingVisit) return;
                  setSavingEdit(true);
                  try {
                    await updateVisitHost(editingVisit.id, { employee_host_id: selectedEmployee.id });
                    toast.success(`✅ Employee assigned: ${selectedEmployee.name}`);
                    setEditingVisit(null);
                    fetchAll();
                  } catch {
                    toast.error("Failed to assign employee");
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                disabled={!selectedEmployee || savingEdit}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                <Building2 className="w-4 h-4" />
                {savingEdit ? "Saving..." : "Assign & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
