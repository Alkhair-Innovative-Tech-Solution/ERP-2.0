'use client';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { cn } from '@/lib/utils';

// --- Registration Data ---
const registrationData = [
  { name: 'Mar 10', value: 400 },
  { name: 'Mar 17', value: 300 },
  { name: 'Mar 24', value: 200 },
  { name: 'Mar 31', value: 350 },
  { name: 'Apr 07', value: 500 },
  { name: 'Apr 14', value: 480 },
  { name: 'Apr 21', value: 740 },
];

// --- Gender Data ---
const genderData = [
  { name: 'Male', value: 45, color: '#2a9f90' },
  { name: 'Female', value: 39, color: '#c96928' },
  { name: 'Other', value: 16, color: '#94a3b8' },
];

export function RegistrationGrowth() {
  return (
    <div className="premium-card p-6 min-h-[400px] flex flex-col premium-dashboard-scope">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Student Registration Growth</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time enrollment trends</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100">
           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           +180% Year/Year
        </div>
      </div>
      
      <div className="flex-1 w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={registrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2a9f90" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#2a9f90" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} 
              dy={10} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} 
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '12px 16px'
              }}
              itemStyle={{ fontWeight: 800, fontSize: '12px' }}
              labelStyle={{ fontWeight: 800, color: '#64748b', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#2a9f90" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorGrowth)" 
              activeDot={{ r: 6, strokeWidth: 0, fill: '#2a9f90' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GenderDistribution() {
  return (
    <div className="premium-card p-6 min-h-[400px] flex flex-col premium-dashboard-scope">
      <div className="mb-8">
        <h3 className="text-xl font-black text-slate-800 tracking-tight">Gender Distribution</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Student demographics</p>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={genderData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={8}
              dataKey="value"
              stroke="none"
            >
              {genderData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[20px] text-center pointer-events-none">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total</p>
          <p className="text-3xl font-black text-slate-800 tracking-tighter">741</p>
        </div>

        {/* Legend */}
        <div className="mt-8 w-full grid grid-cols-3 gap-3">
          {genderData.map((item, idx) => (
            <div key={idx} className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div 
                   className="w-2 h-2 rounded-full" 
                   style={{ backgroundColor: item.color }} 
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.name}</span>
              </div>
              <p className="text-lg font-black text-slate-800">{item.value}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
