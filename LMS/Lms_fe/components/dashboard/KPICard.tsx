"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  icon: React.ReactNode;
  color?: "teal" | "blue" | "orange" | "green" | "purple";
  loading?: boolean;
}

const colorMap = {
  teal: {
    bg: "bg-teal-50",
    icon: "text-brand-teal",
    trend: "text-brand-teal",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    trend: "text-blue-600",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-brand-orange",
    trend: "text-brand-orange",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    trend: "text-emerald-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    trend: "text-purple-600",
  },
};

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "teal",
  loading = false,
}: KPICardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="premium-card p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-2xl", colors.bg)} />
          <div className="w-16 h-4 bg-slate-100 rounded" />
        </div>
        <div className="w-20 h-8 bg-slate-100 rounded mb-2" />
        <div className="w-32 h-3 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="premium-card p-6 group cursor-default">
      <div className="flex items-center justify-between mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            colors.bg
          )}
        >
          <span className={cn("w-6 h-6", colors.icon)}>{icon}</span>
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-bold",
              trend.direction === "up" && "text-emerald-600",
              trend.direction === "down" && "text-red-500",
              trend.direction === "neutral" && "text-slate-400"
            )}
          >
            {trend.direction === "up" && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {trend.direction === "down" && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </h3>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
