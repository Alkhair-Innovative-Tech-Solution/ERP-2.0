"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  backLink?: {
    label: string;
    href: string;
  };
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  backLink,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      {backLink && (
        <a
          href={backLink.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-teal mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLink.label}
        </a>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          {badge && (
            <span className="page-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
              {badge}
            </span>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
