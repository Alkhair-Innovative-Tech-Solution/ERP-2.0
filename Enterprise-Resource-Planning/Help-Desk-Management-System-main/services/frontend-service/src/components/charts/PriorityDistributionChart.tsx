'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { THEME } from '../../lib/theme';

interface PriorityData {
  name: string;
  value: number;
  color: string;
}

interface PriorityDistributionChartProps {
  data: PriorityData[];
  height?: number;
}

export const PriorityDistributionChart: React.FC<PriorityDistributionChartProps> = ({
  data = [],
  height = 260,
}) => {
  const nonZero = data.filter(d => d.value > 0);

  if (nonZero.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: THEME.colors.gray }}>
        No tickets to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={nonZero}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          dataKey="value"
        >
          {nonZero.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: THEME.colors.white,
            border: `1px solid ${THEME.colors.medium}`,
            borderRadius: '8px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};
