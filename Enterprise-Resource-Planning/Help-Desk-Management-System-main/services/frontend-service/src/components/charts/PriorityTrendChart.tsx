'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { THEME } from '../../lib/theme';

interface PriorityTrendData {
  date: string;
  low: number;
  medium: number;
  high: number;
  urgent: number;
}

interface PriorityTrendChartProps {
  data?: PriorityTrendData[];
  height?: number;
}

export const PriorityTrendChart: React.FC<PriorityTrendChartProps> = ({
  data = [],
  height = 300,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: THEME.colors.gray }}>
        No trend data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.medium} opacity={0.3} />
          <XAxis dataKey="date" stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
          <YAxis                stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: THEME.colors.white,
              border: `1px solid ${THEME.colors.medium}`,
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="low"    stroke={THEME.colors.success} strokeWidth={2} name="Low"    dot={{ r: 4 }} />
          <Line type="monotone" dataKey="medium" stroke={THEME.colors.warning} strokeWidth={2} name="Medium" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="high"   stroke={THEME.colors.error}   strokeWidth={2} name="High"   dot={{ r: 4 }} />
          <Line type="monotone" dataKey="urgent" stroke="#7c3aed"              strokeWidth={2} name="Urgent" dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
