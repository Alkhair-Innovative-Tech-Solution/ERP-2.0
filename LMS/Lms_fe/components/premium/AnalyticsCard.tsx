'use client';

import { ReactNode } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
    label: string;
  };
  gradient: 'blue' | 'teal' | 'purple' | 'orange' | 'rose' | 'emerald';
  className?: string;
}

const gradients = {
  blue: 'from-blue-500/10 to-transparent',
  teal: 'from-teal-500/10 to-transparent',
  purple: 'from-purple-500/10 to-transparent',
  orange: 'from-orange-500/10 to-transparent',
  rose: 'from-rose-500/10 to-transparent',
  emerald: 'from-emerald-500/10 to-transparent',
};

const iconColors = {
  blue: 'text-blue-600 bg-blue-100',
  teal: 'text-teal-600 bg-teal-100',
  purple: 'text-purple-600 bg-purple-100',
  orange: 'text-orange-600 bg-orange-100',
  rose: 'text-rose-600 bg-rose-100',
  emerald: 'text-emerald-600 bg-emerald-100',
};

export default function AnalyticsCard({
  title,
  value,
  icon: Icon,
  trend,
  gradient,
  className
}: AnalyticsCardProps) {
  return (
    <div className={cn(
      "premium-card p-6 overflow-hidden relative group premium-dashboard-scope",
      className
    )}>
      {/* Background Gradient */}
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl blur-3xl -mr-16 -mt-16 transition-opacity duration-500",
        gradients[gradient]
      )} />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl shadow-sm transition-transform duration-500 group-hover:scale-110", iconColors[gradient])}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          
          {trend && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight",
              trend.isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
              {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.isUp ? '+' : '-'}{trend.value}%
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-auto">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
              {value}
            </h3>
            {trend && (
              <span className="text-[11px] font-medium text-slate-400">
                {trend.label}
              </span>
            )}
          </div>
        </div>

        {/* Micro-Progress Bar (Optional Decor) */}
        <div className="mt-4 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              gradient === 'blue' && "bg-blue-500",
              gradient === 'teal' && "bg-teal-500",
              gradient === 'purple' && "bg-purple-500",
              gradient === 'orange' && "bg-orange-500",
              gradient === 'rose' && "bg-rose-500",
              gradient === 'emerald' && "bg-emerald-500"
            )} 
            style={{ width: trend ? `${Math.min(100, 40 + trend.value)}%` : '60%' }}
          />
        </div>
      </div>
    </div>
  );
}
