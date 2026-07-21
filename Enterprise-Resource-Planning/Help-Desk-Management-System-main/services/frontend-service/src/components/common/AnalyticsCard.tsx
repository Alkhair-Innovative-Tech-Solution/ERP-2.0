'use client';

import React from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { LucideIcon } from 'lucide-react';
import { THEME } from '../../lib/theme';

interface AnalyticsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: string;
  description?: string;
  onClick?: () => void;
  hoverDescription?: string;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  title,
  value,
  icon: Icon,
  color = THEME.colors.primary,
  description,
  onClick,
  hoverDescription
}) => {
  return (
    <div 
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer group' : ''} h-full`}
    >
      <Card 
        className="rounded-xl bg-white border-2 hover:shadow-xl transition-all duration-300 card-hover h-full flex flex-col"
        style={{ 
          borderColor: color + '40',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
        variant="elevated"
      >
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between flex-1">
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1 uppercase tracking-wide" style={{ color: THEME.colors.gray }}>
                {title}
              </p>
              <p className="text-3xl font-bold mb-2" style={{ color: color }}>
                {value}
              </p>
              {hoverDescription && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-2">
                  <p className="text-xs text-gray-600">{hoverDescription}</p>
                </div>
              )}
              {description && !hoverDescription && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
            <div 
              className="flex-shrink-0 p-3 rounded-lg"
              style={{ backgroundColor: color + '15' }}
            >
              <Icon className="w-7 h-7" style={{ color: color }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

