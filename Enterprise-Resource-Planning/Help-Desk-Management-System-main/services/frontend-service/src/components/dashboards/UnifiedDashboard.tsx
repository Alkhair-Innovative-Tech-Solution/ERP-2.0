'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { PageContainer } from '../layout/PageContainer';
import { DepartmentLoadChart } from '../charts/DepartmentLoadChart';
import { TicketVolumeChart } from '../charts/TicketVolumeChart';
import { StatusDistributionChart } from '../charts/StatusDistributionChart';
import { fetchInstitutions } from '../../services/institutionService';
import { fetchBranches } from '../../services/branchService';
import { fetchDepartments } from '../../services/departmentService';
import ticketService from '../../services/api/ticketService';
import userService from '../../services/api/userService';
import { Ticket, TicketPriority, User } from '../../types';
import { THEME } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/helpers';
import {
  FileText, Clock, AlertCircle, CheckCircle, Users, Activity,
  ArrowRight, AlertTriangle, Play, CheckCircle2, Eye, Edit,
  TrendingUp, Building2, MapPin, Shield, Plus, TicketCheck,
  Zap, Target, BarChart3, CalendarCheck, TimerOff, Flame, ChevronRight,
} from 'lucide-react';

// ─── Color helpers ────────────────────────────────────────────────────────────
/** Convert a hex color + alpha (0–1) into rgba() string */
function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Muted priority border colors — visible but not garish */
const P_BORDER: Record<string, string> = {
  urgent: alpha('#DC2626', 0.55),
  high:   alpha('#EA580C', 0.50),
  medium: alpha('#D97706', 0.45),
  low:    alpha('#6B7280', 0.30),
};

// ─── SLA Helpers ──────────────────────────────────────────────────────────────
const SLA_HOURS: Record<TicketPriority, number> = { urgent: 72, high: 72, medium: 120, low: 168 };

const hoursElapsed  = (date: string) => (Date.now() - new Date(date).getTime()) / 3_600_000;
const slaLimit      = (p: TicketPriority) => SLA_HOURS[p] ?? 120;
const isActive      = (t: Ticket) => !['resolved', 'closed', 'rejected', 'completed'].includes(t.status);
const isSLABreached = (t: Ticket) => isActive(t) && hoursElapsed(t.submittedDate) > slaLimit(t.priority);
const isSLAAtRisk   = (t: Ticket) => {
  const e = hoursElapsed(t.submittedDate), l = slaLimit(t.priority);
  return isActive(t) && e > l * 0.75 && e <= l;
};
const slaHoursLeft = (t: Ticket) => Math.max(0, slaLimit(t.priority) - hoursElapsed(t.submittedDate));
const slaHoursOver = (t: Ticket) => Math.max(0, hoursElapsed(t.submittedDate) - slaLimit(t.priority));

// ─── Shared Data Hooks ────────────────────────────────────────────────────────
function useTickets(role: string, userId?: string) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const doFetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params =
      role === 'requestor' ? { requestorId: userId } :
      role === 'assignee'  ? { assigneeId:  userId } : {};
    try {
      const r = await ticketService.getTickets(params);
      setTickets(Array.isArray(r) ? r : (r?.results ?? []));
      setError(null);
    } catch {
      setError('Could not load dashboard data.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    const needsUser = role === 'requestor' || role === 'assignee';
    if (needsUser && !userId) { setLoading(false); return; }
    doFetch();
  }, [doFetch, role, userId]);

  return { tickets, setTickets, loading, error, refetch: () => doFetch(true) };
}

function useAdminExtras(enabled: boolean) {
  const [users,             setUsers]             = useState<User[]>([]);
  const [institutionsCount, setInstitutionsCount] = useState(0);
  const [branchesCount,     setBranchesCount]     = useState(0);
  const [departmentsCount,  setDepartmentsCount]  = useState(0);
  const [loadingExtras,     setLoadingExtras]     = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const [u, i, b, d] = await Promise.allSettled([
        userService.getUsers(), fetchInstitutions(), fetchBranches(), fetchDepartments(),
      ]);
      if (u.status === 'fulfilled') { const r = u.value; setUsers(Array.isArray(r) ? r : (r?.results ?? [])); }
      if (i.status === 'fulfilled') setInstitutionsCount(i.value.data?.length ?? 0);
      if (b.status === 'fulfilled') setBranchesCount(b.value.data?.length ?? 0);
      if (d.status === 'fulfilled') setDepartmentsCount(d.value.data?.length ?? 0);
      setLoadingExtras(false);
    })();
  }, [enabled]);

  return { users, institutionsCount, branchesCount, departmentsCount, loadingExtras };
}

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <PageContainer className="space-y-4">
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-white rounded-xl shadow-sm" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-xl shadow-sm" />)}
        </div>
        <div className="h-72 bg-white rounded-xl shadow-sm" />
        <div className="h-48 bg-white rounded-xl shadow-sm" />
      </div>
    </PageContainer>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2.5">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

/** Zendesk-style compact stat chip */
function StatChip({
  label, value, accent, onClick, sub,
}: { label: string; value: string | number; accent: string; onClick?: () => void; sub?: string }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-4 border-b-2 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      style={{ borderBottomColor: accent }}
    >
      <span className="text-xs font-medium" style={{ color: THEME.colors.gray }}>{label}</span>
      <span className="text-2xl font-bold leading-none" style={{ color: THEME.colors.primary }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: THEME.colors.gray }}>{sub}</span>}
    </div>
  );
}

/** Page header — minimal, inline */
function DashHeader({
  title, sub, cta,
}: { title: string; sub?: string; cta?: { label: string; icon?: React.ReactNode; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold" style={{ color: THEME.colors.primary }}>{title}</h1>
        {sub && <p className="text-xs mt-0.5" style={{ color: THEME.colors.gray }}>{sub}</p>}
      </div>
      {cta && (
        <Button variant="primary" size="sm" leftIcon={cta.icon} onClick={cta.onClick} className="shrink-0">
          {cta.label}
        </Button>
      )}
    </div>
  );
}

/** Section header with optional count badge + link */
function SectionHead({
  title, count, href, accent,
}: { title: string; count?: number; href?: string; accent?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: accent ?? THEME.colors.primary }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: accent ?? THEME.colors.primary }}>{count}</span>
        )}
      </div>
      {href && (
        <button onClick={() => router.push(href)} className="text-xs flex items-center gap-0.5" style={{ color: THEME.colors.medium }}>
          View all <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/** Zendesk-style ticket row — left priority border */
function TicketRow({
  ticket, onClick, actions,
}: { ticket: Ticket; onClick: () => void; actions?: React.ReactNode }) {
  const breached = isSLABreached(ticket);
  const atRisk   = isSLAAtRisk(ticket);
  const slaColor = breached ? THEME.colors.error : atRisk ? THEME.colors.warning : THEME.colors.success;
  const slaText  = isActive(ticket)
    ? breached ? `${Math.round(slaHoursOver(ticket))}h overdue` : `${Math.round(slaHoursLeft(ticket))}h left`
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-white border-b border-l-[3px] hover:bg-slate-50 transition-colors cursor-pointer group"
      style={{ borderLeftColor: P_BORDER[ticket.priority] ?? THEME.colors.gray, borderBottomColor: THEME.colors.background }}
      onClick={onClick}
    >
      {/* ID + Subject */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold" style={{ color: THEME.colors.medium }}>{ticket.ticketId}</span>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-sm font-medium truncate mt-0.5" style={{ color: THEME.colors.primary }}>{ticket.subject}</p>
        {ticket.department && <p className="text-xs mt-0.5" style={{ color: THEME.colors.gray }}>{ticket.department}</p>}
      </div>

      {/* SLA */}
      {slaText && (
        <span className="text-xs font-semibold whitespace-nowrap flex-shrink-0" style={{ color: slaColor }}>{slaText}</span>
      )}

      {/* Time */}
      <span className="text-xs whitespace-nowrap flex-shrink-0" style={{ color: THEME.colors.gray }}>{formatRelativeTime(ticket.submittedDate)}</span>

      {/* Actions (stop click propagation) */}
      {actions && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Empty state */
function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${THEME.colors.primary}10` }}>
        <Icon className="w-6 h-6" style={{ color: THEME.colors.primary }} />
      </div>
      <p className="font-semibold text-gray-700 text-sm mb-1">{title}</p>
      <p className="text-xs max-w-xs" style={{ color: THEME.colors.gray }}>{body}</p>
    </div>
  );
}

// ─── REQUESTOR DASHBOARD ──────────────────────────────────────────────────────

function RequestorContent({ tickets }: { tickets: Ticket[] }) {
  const { user } = useAuth();
  const router   = useRouter();
  const [tab, setTab] = useState<'all' | 'open' | 'resolved' | 'draft'>('all');

  const total    = tickets.length;
  const open     = tickets.filter(t => ['submitted', 'assigned', 'in_progress', 'pending'].includes(t.status)).length;
  const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
  const drafts   = tickets.filter(t => t.status === 'draft').length;

  const TABS = [
    { key: 'all'      as const, label: 'All',      count: total    },
    { key: 'open'     as const, label: 'Open',     count: open     },
    { key: 'resolved' as const, label: 'Resolved', count: resolved },
    { key: 'draft'    as const, label: 'Drafts',   count: drafts   },
  ];

  const displayed = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime());
    if (tab === 'open')     return sorted.filter(t => ['submitted','assigned','in_progress','pending'].includes(t.status));
    if (tab === 'resolved') return sorted.filter(t => ['resolved','closed'].includes(t.status));
    if (tab === 'draft')    return sorted.filter(t => t.status === 'draft');
    return sorted;
  }, [tickets, tab]).slice(0, 20);

  const avgResolutionDays = useMemo(() => {
    const done = tickets.filter(t => t.resolvedDate && ['resolved','closed'].includes(t.status));
    if (!done.length) return null;
    return Math.round(done.reduce((s, t) =>
      s + (new Date(t.resolvedDate!).getTime() - new Date(t.submittedDate).getTime()) / 86_400_000, 0
    ) / done.length * 10) / 10;
  }, [tickets]);

  return (
    <>
      <DashHeader
        title={user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'My Requests'}
        sub="Track and manage your help desk requests"
        cta={{ label: 'New Request', icon: <Plus className="w-4 h-4" />, onClick: () => router.push('/requestor/new-request') }}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatChip label="Total Requests"      value={total}    accent={THEME.colors.primary} onClick={() => router.push('/requestor/requests')} />
        <StatChip label="Open"                value={open}     accent={THEME.colors.warning}  onClick={() => router.push('/requestor/requests?filter=open')} sub="Awaiting resolution" />
        <StatChip label="Resolved"            value={resolved} accent={THEME.colors.success}  sub="Closed tickets" />
        <StatChip label="Avg Resolution"      value={avgResolutionDays !== null ? `${avgResolutionDays}d` : '—'} accent={THEME.colors.medium} sub="Days to close" />
      </div>

      {/* Draft warning */}
      {drafts > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 bg-white shadow-sm" style={{ borderLeftColor: THEME.colors.warning }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: THEME.colors.warning }} />
          <p className="text-sm flex-1">
            You have <strong>{drafts}</strong> unsaved draft{drafts > 1 ? 's' : ''} — complete and submit them.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setTab('draft')}>View</Button>
        </div>
      )}

      {/* Ticket list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b" style={{ borderColor: THEME.colors.background }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="pb-3 px-3 text-xs font-medium border-b-2 transition-colors"
              style={tab === t.key
                ? { borderColor: THEME.colors.primary, color: THEME.colors.primary }
                : { borderColor: 'transparent', color: THEME.colors.gray }}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === t.key ? `${THEME.colors.primary}15` : THEME.colors.background, color: tab === t.key ? THEME.colors.primary : THEME.colors.gray }}>{t.count}</span>}
            </button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />} onClick={() => router.push('/requestor/requests')} className="text-xs mb-2">
            All requests
          </Button>
        </div>

        {/* Rows */}
        {displayed.length === 0 ? (
          <EmptyState icon={FileText} title="No requests" body={tab === 'draft' ? 'No drafts saved.' : 'No requests in this view.'} />
        ) : (
          <div>
            {displayed.map(t => (
              <TicketRow
                key={t.id}
                ticket={t}
                onClick={() => router.push(`/requestor/ticket/${t.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── MODERATOR DASHBOARD ──────────────────────────────────────────────────────

function ModeratorContent({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();

  const active        = tickets.filter(isActive);
  const unassigned    = tickets.filter(t => ['submitted', 'pending'].includes(t.status));
  const slaBreaches   = tickets.filter(isSLABreached);
  const slaAtRisk     = tickets.filter(isSLAAtRisk);
  const today         = new Date(); today.setHours(0,0,0,0);
  const resolvedToday = tickets.filter(t => t.resolvedDate && new Date(t.resolvedDate) >= today && ['resolved','closed'].includes(t.status));

  const avgResHours = useMemo(() => {
    const done = tickets.filter(t => t.resolvedDate);
    if (!done.length) return null;
    const avg = done.reduce((s, t) =>
      s + (new Date(t.resolvedDate!).getTime() - new Date(t.submittedDate).getTime()) / 3_600_000, 0
    ) / done.length;
    return Math.round(avg);
  }, [tickets]);

  // Dept workload: in_progress = "Active", completed, pending
  const deptWorkload = useMemo(() => {
    const m = new Map<string, { assigned: number; completed: number; pending: number }>();
    tickets.forEach(t => {
      const d = t.department; if (!d) return;
      const cur = m.get(d) ?? { assigned: 0, completed: 0, pending: 0 };
      if (t.status === 'in_progress') cur.assigned++;
      else if (['resolved','closed','completed'].includes(t.status)) cur.completed++;
      else if (['assigned','submitted','pending'].includes(t.status)) cur.pending++;
      m.set(d, cur);
    });
    return Array.from(m.entries())
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => (b.assigned + b.pending) - (a.assigned + a.pending));
  }, [tickets]);

  // Top action queue: SLA breached first, then unassigned >24h, deduped
  const actionQueue = [...slaBreaches, ...unassigned.filter(t => hoursElapsed(t.submittedDate) > 24)]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .sort((a, b) => hoursElapsed(b.submittedDate) - hoursElapsed(a.submittedDate))
    .slice(0, 10);

  // Recent activity
  const recentActivity = useMemo(() => {
    const acts: { id: string; label: string; sub: string; ts: string; color: string }[] = [];
    tickets.forEach(t => {
      if (t.assignedDate)  acts.push({ id: `${t.id}-a`, label: `Assigned: ${t.ticketId}`,  sub: t.subject, ts: t.assignedDate,  color: THEME.colors.info });
      if (t.resolvedDate)  acts.push({ id: `${t.id}-r`, label: `Resolved: ${t.ticketId}`,  sub: t.subject, ts: t.resolvedDate,  color: THEME.colors.success });
      const hrs = hoursElapsed(t.submittedDate);
      if (hrs < 24) acts.push({ id: `${t.id}-n`, label: `New: ${t.ticketId}`, sub: t.subject, ts: t.submittedDate, color: THEME.colors.warning });
    });
    return acts.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10);
  }, [tickets]);

  return (
    <>
      <DashHeader
        title="Ticket Queue"
        sub="System-wide helpdesk overview"
        cta={{ label: 'Ticket Pool', icon: <TicketCheck className="w-4 h-4" />, onClick: () => router.push('/moderator/ticket-pool') }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatChip label="Active Tickets"  value={active.length}        accent={THEME.colors.primary} />
        <StatChip label="Unassigned"      value={unassigned.length}    accent={THEME.colors.warning}  onClick={() => router.push('/moderator/ticket-pool')} sub="Needs assignment" />
        <StatChip label="SLA Breached"    value={slaBreaches.length}   accent={slaBreaches.length > 0 ? THEME.colors.error : THEME.colors.success} sub={slaBreaches.length === 0 ? 'All clear ✓' : 'Requires action'} />
        <StatChip label="SLA At Risk"     value={slaAtRisk.length}     accent={THEME.colors.warning}  sub="Approaching breach" />
        <StatChip label="Resolved Today"  value={resolvedToday.length} accent={THEME.colors.success}  sub={avgResHours !== null ? `Avg ${avgResHours}h` : undefined} />
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: Action queue (2 cols) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Needs Immediate Action */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
              <SectionHead
                title="Needs Immediate Action"
                count={actionQueue.length}
                href="/moderator/ticket-pool"
                accent={THEME.colors.error}
              />
            </div>
            {actionQueue.length === 0 ? (
              <EmptyState icon={CheckCircle} title="All clear!" body="No tickets require immediate attention." />
            ) : (
              actionQueue.map(t => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onClick={() => router.push(`/moderator/review?id=${t.id}`)}
                />
              ))
            )}
          </div>

          {/* Unassigned queue */}
          {unassigned.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
                <SectionHead title="Unassigned" count={unassigned.length} href="/moderator/ticket-pool" accent={THEME.colors.warning} />
              </div>
              {unassigned.slice(0, 8).map(t => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  onClick={() => router.push(`/moderator/ticket-pool`)}
                />
              ))}
            </div>
          )}

          {/* Dept Workload chart */}
          {deptWorkload.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="px-4 pt-4 pb-2 border-b" style={{ borderColor: THEME.colors.background }}>
                <SectionHead title="Department Workload" />
              </div>
              <div className="px-4 pb-4 pt-2">
                <DepartmentLoadChart data={deptWorkload} height={220} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: SLA sidebar + Activity */}
        <div className="space-y-4">

          {/* SLA At Risk list */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
              <SectionHead title="SLA Monitor" accent={THEME.colors.warning} />
            </div>
            {[...slaBreaches, ...slaAtRisk].filter((t, i, a) => a.findIndex(x => x.id === t.id) === i).length === 0 ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: THEME.colors.gray }}>All tickets within SLA ✓</div>
            ) : (
              <div className="divide-y" style={{ borderColor: THEME.colors.background }}>
                {[...slaBreaches, ...slaAtRisk]
                  .filter((t, i, a) => a.findIndex(x => x.id === t.id) === i)
                  .slice(0, 10)
                  .map(t => {
                    const breached = isSLABreached(t);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-l-[3px]"
                        style={{ borderLeftColor: breached ? THEME.colors.error : THEME.colors.warning }}
                        onClick={() => router.push(`/moderator/review?id=${t.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs font-semibold" style={{ color: THEME.colors.primary }}>{t.ticketId}</span>
                          <p className="text-xs truncate mt-0.5" style={{ color: THEME.colors.gray }}>{t.subject}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: breached ? THEME.colors.error : THEME.colors.warning }}>
                          {breached ? `-${Math.round(slaHoursOver(t))}h` : `${Math.round(slaHoursLeft(t))}h`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
              <SectionHead title="Recent Activity" />
            </div>
            {recentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: THEME.colors.gray }}>No recent activity</div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: THEME.colors.background }}>
                {recentActivity.map(a => (
                  <div key={a.id} className="flex gap-3 px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: a.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: THEME.colors.primary }}>{a.label}</p>
                      <p className="text-xs truncate" style={{ color: THEME.colors.gray }}>{a.sub}</p>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: THEME.colors.gray }}>{formatRelativeTime(a.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ASSIGNEE DASHBOARD ───────────────────────────────────────────────────────

function AssigneeContent({ tickets, setTickets, refetch }: {
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  refetch: () => void;
}) {
  const { user } = useAuth();
  const router   = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const inProgress  = tickets.filter(t => t.status === 'in_progress');
  const pending     = tickets.filter(t => t.status === 'assigned');
  const doneMonth   = tickets.filter(t => ['resolved','completed','closed'].includes(t.status) && (t.resolvedDate || t.completedDate) && new Date(t.resolvedDate ?? t.completedDate!) >= monthStart);
  const needsAction = tickets.filter(t => isActive(t) && (isSLABreached(t) || isSLAAtRisk(t)));

  const completionRate = useMemo(() => {
    if (!tickets.length) return 0;
    return Math.round((tickets.filter(t => ['resolved','completed','closed'].includes(t.status)).length / tickets.length) * 100);
  }, [tickets]);

  const avgResolutionDays = useMemo(() => {
    const done = tickets.filter(t => (t.resolvedDate || t.completedDate) && ['resolved','completed','closed'].includes(t.status));
    if (!done.length) return null;
    return Math.round(done.reduce((s, t) =>
      s + (new Date(t.resolvedDate ?? t.completedDate!).getTime() - new Date(t.submittedDate).getTime()) / 86_400_000, 0
    ) / done.length * 10) / 10;
  }, [tickets]);

  const handleStart = async (id: string) => {
    setBusyId(id);
    try {
      await ticketService.changeStatus(id, 'in_progress');
      refetch();
    } catch {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' as const } : t));
    } finally { setBusyId(null); }
  };

  const handleComplete = async (id: string) => {
    setBusyId(id);
    try {
      await ticketService.changeStatus(id, 'completed', 'Task completed by assignee');
      refetch();
    } catch {
      const ts = new Date().toISOString();
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const, completedDate: ts, resolvedDate: ts } : t));
    } finally { setBusyId(null); }
  };

  const TaskActions = ({ t }: { t: Ticket }) => {
    const busy = busyId === t.id;
    if (t.status === 'assigned') {
      return (
        <Button variant="primary" size="sm" leftIcon={<Play className="w-3 h-3" />} onClick={() => handleStart(t.id)} disabled={busy} className="text-xs">
          {busy ? '...' : 'Start'}
        </Button>
      );
    }
    if (t.status === 'in_progress') {
      return (
        <div className="flex gap-1">
          <Button variant="success" size="sm" leftIcon={<CheckCircle2 className="w-3 h-3" />} onClick={() => handleComplete(t.id)} disabled={busy} className="text-xs">
            {busy ? '...' : 'Done'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/assignee/ticket/${t.id}`)} className="text-xs">
            <Edit className="w-3 h-3" />
          </Button>
        </div>
      );
    }
    return <Button variant="ghost" size="sm" onClick={() => router.push(`/assignee/ticket/${t.id}`)} className="text-xs"><Eye className="w-3 h-3" /></Button>;
  };

  return (
    <>
      <DashHeader
        title={user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'My Tasks'}
        sub={user?.department ? `${user.department} · Your assigned tasks` : 'Your assigned tasks'}
        cta={{ label: 'All Tasks', icon: <Target className="w-4 h-4" />, onClick: () => router.push('/assignee/tasks') }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatChip label="In Progress"   value={inProgress.length}  accent={THEME.colors.primary} sub="Currently working"      onClick={() => router.push('/assignee/tasks')} />
        <StatChip label="Pending Start" value={pending.length}     accent={THEME.colors.warning}  sub="Assigned, not started"  onClick={() => router.push('/assignee/tasks')} />
        <StatChip label="Done This Month" value={doneMonth.length} accent={THEME.colors.success}  sub={avgResolutionDays !== null ? `Avg ${avgResolutionDays}d` : undefined} />
        <StatChip label="SLA Alert"     value={needsAction.length} accent={needsAction.length > 0 ? THEME.colors.error : THEME.colors.success} sub={needsAction.length === 0 ? 'All within SLA ✓' : 'At risk or breached'} />
      </div>

      {/* Progress bar */}
      {tickets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: THEME.colors.gray }}>Completion Rate</span>
            <span className="text-sm font-bold" style={{ color: THEME.colors.primary }}>{completionRate}%</span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: THEME.colors.background }}>
            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${completionRate}%`, backgroundColor: THEME.colors.success }} />
          </div>
          <p className="text-xs mt-1" style={{ color: THEME.colors.gray }}>
            {tickets.filter(t => ['resolved','completed','closed'].includes(t.status)).length} of {tickets.length} completed
          </p>
        </div>
      )}

      {/* SLA Alert section */}
      {needsAction.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
            <SectionHead title="SLA Alert — Needs Action" count={needsAction.length} accent={THEME.colors.error} />
          </div>
          {needsAction.map(t => (
            <TicketRow key={t.id} ticket={t} onClick={() => router.push(`/assignee/ticket/${t.id}`)} actions={<TaskActions t={t} />} />
          ))}
        </div>
      )}

      {/* In Progress */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
          <SectionHead title="In Progress" count={inProgress.length} href="/assignee/tasks" accent={THEME.colors.primary} />
        </div>
        {inProgress.length === 0 ? (
          <EmptyState icon={Zap} title="Nothing in progress" body="Start a task to see it here." />
        ) : (
          inProgress.map(t => (
            <TicketRow key={t.id} ticket={t} onClick={() => router.push(`/assignee/ticket/${t.id}`)} actions={<TaskActions t={t} />} />
          ))
        )}
      </div>

      {/* Pending Start */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
            <SectionHead title="Pending Start" count={pending.length} href="/assignee/tasks" accent={THEME.colors.warning} />
          </div>
          {pending.slice(0, 8).map(t => (
            <TicketRow key={t.id} ticket={t} onClick={() => router.push(`/assignee/ticket/${t.id}`)} actions={<TaskActions t={t} />} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

function AdminContent({ tickets, users, institutionsCount, branchesCount, departmentsCount }: {
  tickets: Ticket[];
  users: User[];
  institutionsCount: number;
  branchesCount: number;
  departmentsCount: number;
}) {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<30 | 180 | 365>(30);

  const activeTickets = tickets.filter(isActive).length;
  const activeUsers   = users.filter(u => u.status === 'active').length;
  const today         = new Date(); today.setHours(0,0,0,0);
  const resolvedToday = tickets.filter(t => t.resolvedDate && new Date(t.resolvedDate) >= today).length;

  const slaComplianceRate = useMemo(() => {
    const done = tickets.filter(t => t.resolvedDate || t.completedDate);
    if (!done.length) return 100;
    const ok = done.filter(t => {
      const h = (new Date(t.resolvedDate ?? t.completedDate!).getTime() - new Date(t.submittedDate).getTime()) / 3_600_000;
      return h <= slaLimit(t.priority);
    }).length;
    return Math.round((ok / done.length) * 100);
  }, [tickets]);

  const avgResolutionDays = useMemo(() => {
    const done = tickets.filter(t => t.resolvedDate || t.completedDate);
    if (!done.length) return null;
    return Math.round(done.reduce((s, t) =>
      s + (new Date(t.resolvedDate ?? t.completedDate!).getTime() - new Date(t.submittedDate).getTime()) / 86_400_000, 0
    ) / done.length * 10) / 10;
  }, [tickets]);

  const ticketVolumeData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: timeRange }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (timeRange - 1 - i));
      const label = timeRange <= 30
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : date.toLocaleDateString('en-US', { month: 'short' });
      const day = tickets.filter(t => new Date(t.submittedDate).toDateString() === date.toDateString());
      return {
        date: label,
        created:  day.length,
        resolved: day.filter(t => t.resolvedDate && new Date(t.resolvedDate).toDateString() === date.toDateString()).length,
      };
    });
  }, [tickets, timeRange]);

  const deptWorkloadData = useMemo(() => {
    const depts = Array.from(new Set(tickets.map(t => t.department).filter(Boolean)));
    return depts.map(department => {
      const dt = tickets.filter(t => t.department === department);
      return {
        department,
        assigned:  dt.filter(t => t.status === 'in_progress').length,
        completed: dt.filter(t => ['resolved','completed','closed'].includes(t.status)).length,
        pending:   dt.filter(t => ['assigned','submitted','pending'].includes(t.status)).length,
      };
    });
  }, [tickets]);

  const statusDistData = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach(t => {
      const label = t.status.charAt(0).toUpperCase() + t.status.slice(1).replace('_', ' ');
      m[label] = (m[label] ?? 0) + 1;
    });
    const statusColors: Record<string, string> = {
      'Draft': THEME.colors.gray, 'Submitted': THEME.colors.info, 'Pending': THEME.colors.warning,
      'Assigned': THEME.colors.medium, 'In progress': THEME.colors.primary, 'Resolved': THEME.colors.success,
      'Completed': THEME.colors.success, 'Closed': THEME.colors.gray, 'Rejected': THEME.colors.error,
    };
    return Object.entries(m).map(([name, count]) => ({ name, count, color: statusColors[name] ?? THEME.colors.primary }));
  }, [tickets]);

  const systemAlerts = useMemo(() => {
    const alerts: { id: string; type: 'error' | 'warning' | 'success'; title: string; msg: string; icon: React.ElementType }[] = [];
    const breaches  = tickets.filter(isSLABreached);
    const highWait  = tickets.filter(t => ['high','urgent'].includes(t.priority) && ['assigned','pending','submitted'].includes(t.status));
    if (breaches.length > 0) alerts.push({ id: 'sla',  type: 'error',   title: `${breaches.length} SLA Breach${breaches.length > 1 ? 'es' : ''}`,      msg: 'Tickets have exceeded their SLA limits',      icon: TimerOff });
    if (highWait.length > 0) alerts.push({ id: 'high', type: 'warning', title: `${highWait.length} High-Priority Waiting`,                              msg: 'Urgent/high tickets awaiting assignment',     icon: Flame });
    if (!breaches.length && !highWait.length) alerts.push({ id: 'ok', type: 'success', title: 'System Operational', msg: 'All services running normally', icon: CheckCircle });
    return alerts;
  }, [tickets]);

  const recentUsers = useMemo(() =>
    users.filter(u => u.lastLogin).sort((a, b) => new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime()).slice(0, 8),
    [users]
  );

  const RANGES = [{ label: '30d', value: 30 as const }, { label: '6m', value: 180 as const }, { label: '1y', value: 365 as const }];

  return (
    <>
      <DashHeader
        title={user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Admin Overview'}
        sub="Full system overview and management"
      />

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatChip label="Total Users"    value={users.length}    accent={THEME.colors.primary} sub={`${activeUsers} active`} />
        <StatChip label="Active Tickets" value={activeTickets}   accent={THEME.colors.warning}  sub="Currently open" />
        <StatChip label="SLA Compliance" value={`${slaComplianceRate}%`} accent={slaComplianceRate >= 80 ? THEME.colors.success : THEME.colors.error} sub="Resolved within SLA" />
        <StatChip label="Resolved Today" value={resolvedToday}   accent={THEME.colors.success}  sub={avgResolutionDays !== null ? `Avg ${avgResolutionDays}d resolution` : 'No data'} />
      </div>

      {/* KPI Row 2 — org structure */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatChip label="Institutions"  value={institutionsCount} accent={THEME.colors.medium} sub="Global entities" />
        <StatChip label="Branches"      value={branchesCount}     accent={THEME.colors.medium} sub="Physical locations" />
        <StatChip label="Departments"   value={departmentsCount}  accent={THEME.colors.medium} sub="Organizational units" />
        <StatChip label="Total Tickets" value={tickets.length}    accent={THEME.colors.primary} sub="All time" />
      </div>

      {/* Charts card */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
          <span className="text-sm font-semibold" style={{ color: THEME.colors.primary }}>Ticket Analytics</span>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setTimeRange(r.value)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={timeRange === r.value
                  ? { backgroundColor: THEME.colors.primary, color: '#fff' }
                  : { backgroundColor: THEME.colors.background, color: THEME.colors.gray }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: THEME.colors.gray }}>Volume — Created vs Resolved</p>
            <TicketVolumeChart data={ticketVolumeData} height={200} />
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: THEME.colors.gray }}>Department Performance</p>
            <DepartmentLoadChart data={deptWorkloadData} height={200} />
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: THEME.colors.gray }}>Status Distribution</p>
            <StatusDistributionChart data={statusDistData} height={200} />
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: THEME.colors.gray }}>Org Structure</p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: 'Institutions', value: institutionsCount, icon: Building2 },
                { label: 'Branches',     value: branchesCount,     icon: MapPin },
                { label: 'Departments',  value: departmentsCount,  icon: Shield },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex flex-col items-center justify-center p-4 rounded-xl" style={{ backgroundColor: THEME.colors.background }}>
                  <Icon className="w-5 h-5 mb-2" style={{ color: THEME.colors.medium }} />
                  <span className="text-2xl font-bold" style={{ color: THEME.colors.primary }}>{value}</span>
                  <span className="text-xs mt-1" style={{ color: THEME.colors.gray }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent user activity */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
            <SectionHead title="Recent User Activity" />
          </div>
          {recentUsers.length === 0 ? (
            <EmptyState icon={Users} title="No activity" body="User login activity will appear here." />
          ) : (
            <div className="divide-y" style={{ borderColor: THEME.colors.background }}>
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: THEME.colors.primary }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: THEME.colors.primary }}>{u.name}</p>
                    <p className="text-xs" style={{ color: THEME.colors.gray }}>{u.department} · {u.role}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: THEME.colors.gray }}>{formatRelativeTime(u.lastLogin!)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Alerts */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: THEME.colors.background }}>
            <SectionHead title="System Alerts" />
          </div>
          <div className="p-4 space-y-3">
            {systemAlerts.map(a => {
              const Icon = a.icon;
              const { bg, bdr, clr } = a.type === 'error'
                ? { bg: '#FEE2E2', bdr: '#FECACA', clr: THEME.colors.error }
                : a.type === 'warning'
                ? { bg: '#FEF3C7', bdr: '#FDE68A', clr: THEME.colors.warning }
                : { bg: '#D1FAE5', bdr: '#A7F3D0', clr: THEME.colors.success };
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ backgroundColor: bg, borderColor: bdr }}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: clr }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: THEME.colors.primary }}>{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: THEME.colors.gray }}>{a.msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const role     = user?.role ?? '';

  const { tickets, setTickets, loading, error, refetch } = useTickets(role, user?.id);
  const adminExtras = useAdminExtras(role === 'admin');

  if (loading || (role === 'admin' && adminExtras.loadingExtras)) {
    return <DashboardSkeleton />;
  }

  return (
    <PageContainer className="space-y-4">
      {error && <ErrorBanner message={error} />}

      {role === 'admin' && (
        <AdminContent
          tickets={tickets}
          users={adminExtras.users}
          institutionsCount={adminExtras.institutionsCount}
          branchesCount={adminExtras.branchesCount}
          departmentsCount={adminExtras.departmentsCount}
        />
      )}
      {role === 'moderator' && <ModeratorContent tickets={tickets} />}
      {role === 'assignee'  && <AssigneeContent tickets={tickets} setTickets={setTickets} refetch={refetch} />}
      {role === 'requestor' && <RequestorContent tickets={tickets} />}

      {!['admin','moderator','assignee','requestor'].includes(role) && (
        <EmptyState icon={Shield} title="No dashboard configured" body={`Role "${role}" does not have a dashboard.`} />
      )}
    </PageContainer>
  );
}
