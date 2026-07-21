'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface KpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number; // percentage change
    label?: string; // e.g., "vs last month"
  };
  color?: string;
  backgroundColor?: string;
  description?: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = '#365486',
  backgroundColor,
  description,
  onClick
}) => {
  const isPositiveTrend = trend ? trend.value >= 0 : null;
  const TrendIcon = isPositiveTrend !== null ? (isPositiveTrend ? TrendingUp : TrendingDown) : null;
  
  // Determine if background is dark or light
  const hasColoredBg = !!backgroundColor;
  const darkBgs = ['#274c77', '#365486', '#6096ba'];
  const isDarkBg = hasColoredBg && darkBgs.some(bg => backgroundColor.toLowerCase().includes(bg.toLowerCase()) || backgroundColor === bg);
  
  // Text colors based on background
  const titleColor = hasColoredBg ? (isDarkBg ? 'rgba(255, 255, 255, 0.9)' : '#374151') : '#8b8c89';
  const valueColor = hasColoredBg ? (isDarkBg ? '#ffffff' : '#111827') : color;
  const descColor = hasColoredBg ? (isDarkBg ? 'rgba(255, 255, 255, 0.8)' : '#6b7280') : '#8b8c89';
  // Trend colors: on dark backgrounds use white, on light backgrounds use green/red
  const trendColor = hasColoredBg 
    ? (isDarkBg ? '#ffffff' : (isPositiveTrend !== null ? (isPositiveTrend ? '#22c55e' : '#ef4444') : '#6b7280'))
    : (isPositiveTrend !== null ? (isPositiveTrend ? '#22c55e' : '#ef4444') : '#6b7280');
  const iconBgColor = hasColoredBg ? (isDarkBg ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)') : `${color}15`;
  const iconColor = hasColoredBg ? (isDarkBg ? '#ffffff' : '#6b7280') : color;

  return (
    <Card 
      className={`rounded-xl border shadow-md hover:shadow-lg transition-shadow duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ 
        backgroundColor: backgroundColor || '#ffffff',
        borderColor: backgroundColor ? 'transparent' : '#e5e7eb'
      }}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p 
              className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: titleColor }}
            >
              {title}
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <p 
                className="text-3xl font-bold"
                style={{ color: valueColor }}
              >
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {trend && TrendIcon && (
                <div className="flex items-center gap-1 text-sm font-medium" style={{ color: trendColor }}>
                  <TrendIcon className="w-4 h-4" />
                  <span>{Math.abs(trend.value)}%</span>
                </div>
              )}
            </div>
            {trend?.label && (
              <p className="text-xs" style={{ color: descColor }}>
                {trend.label}
              </p>
            )}
            {description && (
              <p className="text-xs mt-1" style={{ color: descColor }}>
                {description}
              </p>
            )}
          </div>
          <div 
            className="flex-shrink-0 p-3 rounded-lg"
            style={{ 
              backgroundColor: iconBgColor
            }}
          >
            <Icon className="w-6 h-6" style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
