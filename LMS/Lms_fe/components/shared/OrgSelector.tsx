'use client';

import { useState, useEffect } from 'react';
import { organizationAPI, campusAPI } from '@/lib/api';
import { Building2, ChevronDown, Check, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgSelectorProps {
  className?: string;
}

export default function OrgSelector({ className }: OrgSelectorProps) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);

  useEffect(() => {
    // Load saved selections from localStorage
    const savedOrg = localStorage.getItem('selected_org_id') || '';
    const savedCampus = localStorage.getItem('selected_campus_id') || '';
    setSelectedOrg(savedOrg);
    setSelectedCampus(savedCampus);
    
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchCampuses(selectedOrg);
      localStorage.setItem('selected_org_id', selectedOrg);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedCampus) {
      localStorage.setItem('selected_campus_id', selectedCampus);
    }
  }, [selectedCampus]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await organizationAPI.getAll();
      setOrganizations(data);
      
      // Auto-select first org if none selected
      if (!selectedOrg && data.length > 0) {
        setSelectedOrg(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async (orgId: string) => {
    try {
      const data = await campusAPI.getAll(orgId);
      setCampuses(data);
    } catch (error) {
      console.error('Failed to load campuses:', error);
    }
  };

  const handleOrgChange = (orgId: string) => {
    setSelectedOrg(orgId);
    setSelectedCampus(''); // Reset campus when org changes
    setShowOrgDropdown(false);
  };

  const handleCampusChange = (campusId: string) => {
    setSelectedCampus(campusId);
    setShowCampusDropdown(false);
  };

  const getSelectedOrgName = () => {
    const org = organizations.find(o => o.id === selectedOrg);
    return org?.name || 'Select Organization';
  };

  const getSelectedCampusName = () => {
    const campus = campuses.find(c => c.id === selectedCampus);
    return campus?.campus_name || 'All Campuses';
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-slate-400", className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs font-bold">Loading...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Organization Selector */}
      <div className="relative">
        <button
          onClick={() => { setShowOrgDropdown(!showOrgDropdown); setShowCampusDropdown(false); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all text-xs font-bold text-slate-700"
        >
          <Building2 size={14} className="text-brand-teal" />
          <span className="max-w-[150px] truncate">{getSelectedOrgName()}</span>
          <ChevronDown size={14} className={cn("transition-transform", showOrgDropdown && "rotate-180")} />
        </button>
        
        {showOrgDropdown && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-60 overflow-y-auto">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => handleOrgChange(org.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-all",
                  selectedOrg === org.id && "bg-brand-teal/5"
                )}
              >
                <Building2 size={14} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-700">{org.name}</span>
                {selectedOrg === org.id && <Check size={14} className="text-brand-teal ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campus Selector */}
      <div className="relative">
        <button
          onClick={() => { setShowCampusDropdown(!showCampusDropdown); setShowOrgDropdown(false); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all text-xs font-bold text-slate-700"
        >
          <MapPin size={14} className="text-brand-teal" />
          <span className="max-w-[150px] truncate">{getSelectedCampusName()}</span>
          <ChevronDown size={14} className={cn("transition-transform", showCampusDropdown && "rotate-180")} />
        </button>
        
        {showCampusDropdown && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-60 overflow-y-auto">
            <button
              onClick={() => handleCampusChange('')}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-all",
                !selectedCampus && "bg-brand-teal/5"
              )}
            >
              <MapPin size={14} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700">All Campuses</span>
              {!selectedCampus && <Check size={14} className="text-brand-teal ml-auto" />}
            </button>
            {campuses.map(campus => (
              <button
                key={campus.id}
                onClick={() => handleCampusChange(campus.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-all",
                  selectedCampus === campus.id && "bg-brand-teal/5"
                )}
              >
                <MapPin size={14} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-700">{campus.campus_name}</span>
                {selectedCampus === campus.id && <Check size={14} className="text-brand-teal ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
