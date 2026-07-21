'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { campusAPI, organizationAPI } from '@/lib/api';
import { School, Plus, MapPin, Phone, Users, Building2, Loader2, Search, ChevronRight, Wifi, Zap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Campus {
  id: string;
  organization_id: string;
  campus_id: string;
  campus_code: string;
  campus_name: string;
  campus_type: string;
  status: string;
  shift_available: string;
  city: string | null;
  address: string | null;
  contact_phone: string | null;
  official_email: string | null;
  campus_head_name: string | null;
  student_capacity: number;
  total_classrooms: number;
  labs: boolean;
  library: boolean;
  transport: boolean;
  internet_available: boolean;
  power_backup: boolean;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
}

export default function CampusesPage() {
  const router = useRouter();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campusData, orgData] = await Promise.all([
        campusAPI.getAll(selectedOrg || undefined),
        organizationAPI.getAll(),
      ]);
      setCampuses(campusData);
      setOrganizations(orgData);
    } catch (error) {
      toast.error('Failed to load campuses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedOrg]);

  const filteredCampuses = campuses.filter(c =>
    c.campus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.campus_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-slate-100 text-slate-400';
    if (status === 'active') return 'bg-emerald-50 text-emerald-600';
    return 'bg-amber-50 text-amber-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <School className="w-7 h-7 text-brand-teal" />
            Campus Management
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Manage campus locations and academic structure</p>
        </div>
        <button
          onClick={() => router.push('/admin/campuses/create')}
          className="flex items-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-lg shadow-brand-teal/20"
        >
          <Plus size={16} /> Add Campus
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Campuses</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{campuses.length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</p>
          <p className="text-3xl font-black text-emerald-500 mt-1">{campuses.filter(c => c.is_active).length}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Capacity</p>
          <p className="text-3xl font-black text-brand-teal mt-1">{campuses.reduce((sum, c) => sum + c.student_capacity, 0)}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Classrooms</p>
          <p className="text-3xl font-black text-brand-teal mt-1">{campuses.reduce((sum, c) => sum + c.total_classrooms, 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="premium-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campuses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
            />
          </div>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
          >
            <option value="">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Campus Grid */}
      {loading ? (
        <div className="premium-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
        </div>
      ) : filteredCampuses.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <School className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-xl font-black text-slate-900">No campuses found</p>
          <p className="text-slate-400 font-medium mt-1">
            {searchTerm ? 'Try a different search term' : 'Create your first campus to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampuses.map((campus) => (
            <div
              key={campus.id}
              onClick={() => router.push(`/admin/campuses/${campus.id}`)}
              className={cn(
                "premium-card p-5 border-l-4 transition-all hover:shadow-lg cursor-pointer group",
                campus.is_active ? "border-l-brand-teal" : "border-l-slate-300 opacity-70"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-brand-teal bg-brand-teal/5 px-2 py-0.5 rounded uppercase tracking-widest border border-brand-teal/10">
                      {campus.campus_code}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      campus.campus_type === 'main' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    )}>
                      {campus.campus_type}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      getStatusColor(campus.status, campus.is_active)
                    )}>
                      {campus.is_active ? campus.status : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2 group-hover:text-brand-teal transition-colors">
                    {campus.campus_name}
                  </h3>
                  {campus.city && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 font-bold">
                      <MapPin size={12} className="text-brand-teal" />
                      {campus.city}{campus.address ? `, ${campus.address}` : ''}
                    </div>
                  )}
                  {campus.campus_head_name && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-bold">
                      <Users size={12} className="text-brand-teal" />
                      {campus.campus_head_name}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-bold">
                      <School size={12} className="text-brand-teal" />
                      {campus.total_classrooms} rooms
                    </div>
                    <div className="text-xs text-slate-400">|</div>
                    <span className="text-xs text-slate-500 font-bold capitalize">{campus.shift_available}</span>
                  </div>
                  {/* Facilities */}
                  <div className="flex items-center gap-2 mt-3">
                    {campus.labs && <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Labs</span>}
                    {campus.library && <span className="text-[8px] font-black bg-green-50 text-green-600 px-1.5 py-0.5 rounded">Library</span>}
                    {campus.transport && <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Transport</span>}
                    {campus.internet_available && <span className="text-[8px] font-black bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded">Internet</span>}
                    {campus.power_backup && <span className="text-[8px] font-black bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Power</span>}
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-teal transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
