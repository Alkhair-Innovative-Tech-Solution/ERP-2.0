'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
  trend?: string;
  delay?: number;
}

export default function StatsCard({ title, value, icon: Icon, color, trend, delay }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div
      className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition animate-fadeIn fill-mode-backwards"
      style={{ animationDelay: delay ? `${delay}ms` : '0ms' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
            ↑ {trend}
          </span>
        )}
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

