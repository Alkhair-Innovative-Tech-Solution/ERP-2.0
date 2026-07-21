'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { THEME } from '../../lib/theme';

interface ResolutionTimeData {
  date: string;
  averageDays: number;
}

interface ResolutionTimeTrendChartProps {
  data: ResolutionTimeData[];
  height?: number;
}

export const ResolutionTimeTrendChart: React.FC<ResolutionTimeTrendChartProps> = ({
  data = [],
  height = 300,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: THEME.colors.gray }}>
        No resolution data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.medium} opacity={0.3} />
        <XAxis
          dataKey="date"
          stroke={THEME.colors.gray}
          style={{ fontSize: '11px' }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke={THEME.colors.gray}
          style={{ fontSize: '12px' }}
          label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fill: THEME.colors.gray } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: THEME.colors.white,
            border: `1px solid ${THEME.colors.medium}`,
            borderRadius: '8px',
          }}
          formatter={(value: number) => [`${value} days`, 'Avg Resolution']}
        />
        <Line
          type="monotone"
          dataKey="averageDays"
          stroke={THEME.colors.primary}
          strokeWidth={2}
          dot={{ fill: THEME.colors.primary, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
