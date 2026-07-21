'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { THEME } from '../../lib/theme';

interface StatusData {
  name: string;
  count: number;
  color: string;
}

interface StatusDistributionChartProps {
  data: StatusData[];
  height?: number;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  data = [],
  height = 260,
}) => {
  const nonZero = data.filter(d => d.count > 0);

  if (nonZero.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: THEME.colors.gray }}>
        No tickets to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={nonZero} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.medium} opacity={0.3} />
        <XAxis dataKey="name" stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
        <YAxis stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: THEME.colors.white,
            border: `1px solid ${THEME.colors.medium}`,
            borderRadius: '8px',
          }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {nonZero.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
