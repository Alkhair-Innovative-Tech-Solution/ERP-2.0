"use client";

import React from 'react';
import { Mail, Phone, Globe, ShieldCheck } from 'lucide-react';

interface IDCardProps {
  employee: {
    employee_code: string;
    full_name: string;
    designation?: { position_name: string } | null;
    department?: { dept_name: string } | null;
    email: string;
    phone: string;
    image?: string;
    join_date: string;
    cnic?: string;
  };
}

const IDCard: React.FC<IDCardProps> = ({ employee }) => {
  return (
    <div className="id-card-container p-8 bg-zinc-50 flex justify-center items-center">
      <div className="id-card w-87.5 h-137.5 bg-white rounded-4xl shadow-2xl relative overflow-hidden border border-zinc-200 flex flex-col items-center p-0 font-sans print:shadow-none print:border-zinc-300">
        
        {/* Top Accent */}
        <div className="absolute top-0 left-0 w-full h-45 bg-theme-800 flex flex-col items-center pt-8">
           <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-theme-800 flex items-center justify-center">
                 <ShieldCheck className="text-white" size={18} />
              </div>
              <span className="text-white font-black tracking-tighter text-lg">AL-KHIDMAT</span>
           </div>
        </div>

        {/* Photo Container */}
        <div className="relative mt-25 z-10">
          <div className="w-32 h-32 rounded-3xl bg-indigo-50 border-4 border-white shadow-xl flex items-center justify-center text-zinc-900 text-4xl font-black overflow-hidden ring-1 ring-zinc-100">
            {employee.image ? (
              <img src={employee.image} alt={employee.full_name} className="w-full h-full object-cover" />
            ) : (
              employee.full_name.charAt(0)
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-black text-white p-2 rounded-xl shadow-lg border-2 border-white">
            <ShieldCheck size={16} />
          </div>
        </div>

        {/* Employee Info */}
        <div className="mt-6 text-center px-8 w-full">
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight">{employee.full_name}</h2>
          <p className="text-blue-600 text-xs font-black uppercase tracking-[0.2em] mt-2 mb-6">{employee.designation?.position_name || 'Personnel'}</p>
          
          <div className="space-y-4 w-full">
            <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
               <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-400">
                  <Mail size={14} />
               </div>
               <div className="text-left">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Email</p>
                  <p className="text-xs font-bold text-zinc-700 truncate max-w-45">{employee.email}</p>
               </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
               <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-400">
                  <Phone size={14} />
               </div>
               <div className="text-left">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Phone</p>
                  <p className="text-xs font-bold text-zinc-700">{employee.phone}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Bottom ID Bar */}
        <div className="mt-auto w-full bg-zinc-50 border-t border-zinc-100 p-6 flex justify-between items-center">
           <div className="text-left">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Employee ID</p>
              <p className="text-sm font-black text-zinc-900">{employee.employee_code}</p>
           </div>
           <div className="text-right">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Join Date</p>
              <p className="text-xs font-bold text-zinc-700">{employee.join_date}</p>
           </div>
        </div>

      </div>
      
      <style jsx>{`
        @media print {
          .id-card-container {
            padding: 0;
            background: white;
          }
          .id-card {
            box-shadow: none;
            border: 1px solid #e4e4e7;
          }
        }
      `}</style>
    </div>
  );
};

export default IDCard;

