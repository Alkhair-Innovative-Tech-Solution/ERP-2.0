'use client';

import React, { useMemo } from 'react';
import { Clock, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface SLACardProps {
  submittedDate: string;
  dueDate?: string;
  slaHours?: number;
  status: string;
}

export const SLACard: React.FC<SLACardProps> = ({
  submittedDate,
  dueDate,
  slaHours = 72,
  status,
}) => {
  const sla = useMemo(() => {
    const now = new Date();
    const submitted = new Date(submittedDate);
    const due = dueDate
      ? new Date(dueDate)
      : new Date(submitted.getTime() + slaHours * 3600 * 1000);

    const totalMs = due.getTime() - submitted.getTime();
    const remainMs = due.getTime() - now.getTime();
    const elapsedPct = totalMs > 0
      ? Math.min(100, Math.max(0, ((totalMs - remainMs) / totalMs) * 100))
      : 100;

    const isBreached = remainMs < 0;
    const absMs = Math.abs(remainMs);
    const days = Math.floor(absMs / 86400000);
    const hours = Math.floor((absMs % 86400000) / 3600000);
    const mins = Math.floor((absMs % 3600000) / 60000);

    let label = '';
    if (isBreached) {
      label = days > 0 ? `${days}d ${hours}h overdue` : hours > 0 ? `${hours}h overdue` : `${mins}m overdue`;
    } else {
      label = days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h left` : `${mins}m left`;
    }

    const pct = Math.min(100, Math.max(0, elapsedPct));
    const healthPct = 100 - pct;

    let color = '#10b981';
    let bgColor = '#f0fdf4';
    let borderColor = '#bbf7d0';
    let level: 'healthy' | 'warning' | 'critical' | 'breached' = 'healthy';

    if (isBreached) {
      color = '#ef4444'; bgColor = '#fef2f2'; borderColor = '#fecaca'; level = 'breached';
    } else if (healthPct < 20) {
      color = '#ef4444'; bgColor = '#fef2f2'; borderColor = '#fecaca'; level = 'critical';
    } else if (healthPct < 40) {
      color = '#f59e0b'; bgColor = '#fffbeb'; borderColor = '#fde68a'; level = 'warning';
    }

    return { label, pct, color, bgColor, borderColor, level, isBreached, healthPct };
  }, [submittedDate, dueDate, slaHours]);

  if (['resolved', 'closed', 'completed'].includes(status)) return null;

  const Icon = sla.isBreached
    ? AlertTriangle
    : sla.level === 'warning'
    ? TrendingDown
    : sla.level === 'healthy'
    ? CheckCircle2
    : AlertTriangle;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: sla.bgColor,
        borderColor: sla.borderColor,
        boxShadow: `0 2px 8px ${sla.color}18`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: sla.color + '20' }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: sla.color }} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: sla.color }}>
              SLA Status
            </p>
            <p className="text-sm font-bold leading-tight" style={{ color: sla.color }}>
              {sla.label}
            </p>
          </div>
        </div>
        <div
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: sla.color + '18', color: sla.color }}
        >
          {Math.round(sla.healthPct)}% remaining
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: sla.color + '20' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${sla.healthPct}%`,
            backgroundColor: sla.color,
            boxShadow: `0 0 6px ${sla.color}60`,
          }}
        />
      </div>

      {sla.isBreached && (
        <p className="text-[11px] mt-2 font-medium" style={{ color: sla.color }}>
          This ticket has exceeded its response SLA target.
        </p>
      )}
    </div>
  );
};
