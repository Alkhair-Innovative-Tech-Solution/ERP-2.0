'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { THEME } from '../../lib/theme';

interface DepartmentLoadData {
  department: string;
  assigned: number;
  completed: number;
  pending: number;
}

interface DepartmentLoadChartProps {
  data?: DepartmentLoadData[];
  height?: number;
}

export const DepartmentLoadChart: React.FC<DepartmentLoadChartProps> = ({
  data = [],
  height = 300,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: THEME.colors.gray }}>
        No department data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.medium} opacity={0.3} />
          <XAxis dataKey="department" stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
          <YAxis stroke={THEME.colors.gray} style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: THEME.colors.white,
              border: `1px solid ${THEME.colors.medium}`,
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Bar dataKey="assigned"  fill={THEME.colors.primary} name="Assigned"  radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" fill={THEME.colors.success} name="Completed" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending"   fill={THEME.colors.warning} name="Pending"   radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
