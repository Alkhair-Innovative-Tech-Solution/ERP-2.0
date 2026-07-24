"use client";
import { VisitStatus } from "@/lib/types";

const CONFIG: Record<VisitStatus, { label: string; className: string; dot: string }> = {
  pending_approval: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-400",
  },
  checked_in: {
    label: "Checked In",
    className: "bg-jade-50 text-jade-700 border border-jade-200",
    dot: "bg-jade-500",
  },
  checked_out: {
    label: "Checked Out",
    className: "bg-ink-100 text-ink-500 border border-ink-200",
    dot: "bg-ink-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border border-rose-200",
    dot: "bg-rose-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-ink-100 text-ink-400 border border-ink-200",
    dot: "bg-ink-300",
  },
};

export function StatusBadge({ status }: { status: VisitStatus }) {
  const c = CONFIG[status] || CONFIG.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === "pending_approval" ? "animate-pulse" : ""}`} />
      {c.label}
    </span>
  );
}

export function EntryTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    receptionist: { label: "Reception", className: "bg-ink-100 text-ink-600 border border-ink-200" },
    qr_self: { label: "QR Self", className: "bg-purple-50 text-purple-700 border border-purple-200" },
    scheduled: { label: "Scheduled", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  };
  const c = map[type] || map.receptionist;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
