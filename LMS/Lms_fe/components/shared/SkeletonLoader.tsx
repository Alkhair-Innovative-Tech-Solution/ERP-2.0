"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-100",
        className
      )}
    />
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="premium-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-100">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4 flex-1"
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn(
                "h-4",
                colIndex === 0 ? "w-8" : "flex-1"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
}

function SkeletonCards({ count = 4 }: SkeletonCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="premium-card p-6 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <Skeleton className="w-16 h-4" />
          </div>
          <Skeleton className="w-20 h-8 mb-2" />
          <Skeleton className="w-32 h-3" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonChartProps {
  className?: string;
}

function SkeletonChart({ className }: SkeletonChartProps) {
  return (
    <div className={cn("premium-card p-6 animate-pulse", className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="w-32 h-5 mb-2" />
          <Skeleton className="w-48 h-3" />
        </div>
        <Skeleton className="w-20 h-8" />
      </div>
      <Skeleton className="w-full h-64 rounded-xl" />
    </div>
  );
}

export { Skeleton, SkeletonTable, SkeletonCards, SkeletonChart };
