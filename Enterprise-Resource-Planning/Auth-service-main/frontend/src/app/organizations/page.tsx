"use client";

import React, { useEffect, useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import {
  Building, Globe, Shield, Activity, Search,
  CheckCircle2, Info, ArrowRight, Database
} from "lucide-react";

type Organization = {
  id: string;
  name: string;
  org_code: string;
  description?: string;
  created_at?: string;
};

const Skeleton = ({ className, height, width }: any) => (
  <div className={`animate-pulse bg-zinc-100 rounded-2xl ${className}`} style={{ height, width }} />
);

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/employees/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(Array.isArray(data) ? data : (data.organizations || []));
      }
    } catch (err) {
      console.error("Failed to load organizations:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = organizations.filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.org_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedLayout>
      <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto space-y-12 animate-in fade-in duration-1000">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-zinc-100 pb-12">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="h-1.5 w-8 bg-zinc-900 rounded-full" />
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">Global Master Registry</p>
             </div>
             <h1 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Organizations</h1>
             <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.5em] italic opacity-60">High-level Corporate structures & Frameworks</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
           <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[120%] bg-white/5 blur-[80px] rounded-full rotate-12 transition-transform duration-1000 group-hover:rotate-45" />
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="space-y-6 max-w-2xl">
                 <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10"><Shield size={24} /></div>
                 <h2 className="text-3xl font-black tracking-tighter leading-tight uppercase">Strategic Registry Control</h2>
                 <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                   Currently managing the global organizational framework. This module provides a high-level overview of the root entities registered within the ERP system. 
                   <span className="text-white block mt-2 font-bold uppercase tracking-widest text-[10px]">Registry Status: Synchronized</span>
                 </p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                 <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Active Orgs</p>
                    <h3 className="text-3xl font-black tracking-tighter">{organizations.length}</h3>
                 </div>
                 <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Global Sync</p>
                    <h3 className="text-3xl font-black tracking-tighter">100%</h3>
                 </div>
              </div>
           </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto w-full">
           <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
              <input type="text" placeholder="FILTER GLOBAL ENTITIES..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-14 pr-6 py-5 bg-white border border-zinc-100 focus:border-zinc-200 rounded-full text-[11px] font-black text-zinc-900 uppercase tracking-widest outline-none transition-all shadow-xl shadow-zinc-200/20" />
           </div>
        </div>

        {/* Grid of Orgs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {loading ? [1, 2, 3].map(i => <Skeleton key={i} height={200} />) : 
             filtered.map(org => (
               <div key={org.id} className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col justify-between min-h-[250px]">
                  <div className="space-y-6">
                     <div className="flex items-start justify-between">
                        <div className="h-14 w-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500">
                           <Building size={28} />
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Master Code</span>
                           <h4 className="text-lg font-black text-zinc-900 tracking-tighter">{org.org_code}</h4>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tight leading-none group-hover:text-indigo-600 transition-colors">{org.name}</h3>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Principal Legal Entity</p>
                     </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-50 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-[9px]">Operational</span>
                     </div>
                     <button className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all">
                        <ArrowRight size={16} />
                     </button>
                  </div>
               </div>
             ))
           }
        </div>

        {/* Quick Help */}
        <div className="bg-zinc-50 rounded-[2.5rem] p-8 flex items-center gap-6 border border-zinc-100 max-w-3xl mx-auto">
           <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-zinc-400 shadow-sm"><Info size={24} /></div>
           <div>
              <h4 className="text-sm font-black text-zinc-900 uppercase tracking-tighter">Registry Management Note</h4>
              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mt-1">
                Organizations are fixed root entities. To manage underlying institutions, branches, or departments, please use their respective specialized modules found in the <span className="text-zinc-900 font-bold">Intelligence Hub</span>.
              </p>
           </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
