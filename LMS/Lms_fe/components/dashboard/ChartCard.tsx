"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  actions,
  className,
  loading = false,
}: ChartCardProps) {
  if (loading) {
    return (
      <div className={cn("premium-card p-6 animate-pulse", className)}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="w-32 h-5 bg-slate-100 rounded mb-2" />
            <div className="w-48 h-3 bg-slate-100 rounded" />
          </div>
          <div className="w-20 h-8 bg-slate-100 rounded" />
        </div>
        <div className="w-full h-64 bg-slate-50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn("premium-card p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
