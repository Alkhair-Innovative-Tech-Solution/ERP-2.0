"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface TimelineStep {
  label: string;
  status: "completed" | "current" | "pending";
  timestamp?: string;
  user?: string;
}

interface ApprovalCardProps {
  title: string;
  description?: string;
  status: "pending" | "approved" | "rejected" | "in_progress";
  from?: string;
  to?: string;
  requestedBy?: string;
  requestedAt?: string;
  timeline?: TimelineStep[];
  onApprove?: () => void;
  onReject?: () => void;
  onComment?: () => void;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  in_progress: {
    label: "In Progress",
    icon: AlertCircle,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
};

export default function ApprovalCard({
  title,
  description,
  status,
  from,
  to,
  requestedBy,
  requestedAt,
  timeline,
  onApprove,
  onReject,
  onComment,
  className,
}: ApprovalCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "premium-card p-6 border-l-4",
        config.border,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
            config.bg,
            config.color
          )}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {config.label}
        </span>
      </div>

      {/* Transfer Details */}
      {(from || to) && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
          {from && (
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-400 mb-1">From</p>
              <p className="text-sm font-medium text-slate-700">{from}</p>
            </div>
          )}
          {from && to && (
            <svg
              className="w-5 h-5 text-slate-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          )}
          {to && (
            <div className="flex-1 text-center">
              <p className="text-xs text-slate-400 mb-1">To</p>
              <p className="text-sm font-medium text-slate-700">{to}</p>
            </div>
          )}
        </div>
      )}

      {/* Request Info */}
      {(requestedBy || requestedAt) && (
        <div className="text-xs text-slate-400 mb-4">
          {requestedBy && <span>Requested by {requestedBy}</span>}
          {requestedBy && requestedAt && <span> • </span>}
          {requestedAt && <span>{requestedAt}</span>}
        </div>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-500 mb-3">Timeline</p>
          <div className="space-y-3">
            {timeline.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    step.status === "completed" && "bg-emerald-100",
                    step.status === "current" && "bg-blue-100",
                    step.status === "pending" && "bg-slate-100"
                  )}
                >
                  {step.status === "completed" && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  {step.status === "current" && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                  {step.status === "pending" && (
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.status === "completed" && "text-slate-500",
                      step.status === "current" && "text-slate-800",
                      step.status === "pending" && "text-slate-400"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.timestamp && (
                    <p className="text-xs text-slate-400">
                      {step.timestamp}
                      {step.user && ` by ${step.user}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {status === "pending" && (onApprove || onReject || onComment) && (
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          {onApprove && (
            <button onClick={onApprove} className="btn-primary text-xs">
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          )}
          {onReject && (
            <button onClick={onReject} className="btn-danger text-xs">
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          )}
          {onComment && (
            <button onClick={onComment} className="btn-ghost text-xs ml-auto">
              Comment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
