'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, Mail, Shield, CheckCircle2,
  X, Loader2, Lock, Briefcase, ChevronDown, Activity, 
  UserX, GraduationCap, Filter, MoreHorizontal
} from 'lucide-react';
import { userAPI, branchAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'STUDENT',
    cnic: '',
    phone: '',
    is_active: true,
    is_staff: false,
    must_change_password: false,
    branch_id: '',
    // 🔹 Multi-Tenancy
    organization_id: '',
    campus_id: '',
    // Student-specific fields
    gender: '',
    whatsapp_number: '',
    father_name: '',
    address: '',
    dob: '',
  });

  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await branchAPI.getAll();
      setBranches(data);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [showArchived, currentPage, debouncedSearch, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // 🔹 Multi-Tenancy: Get org_id from localStorage
      const orgId = localStorage.getItem('selected_org_id') || '';
      const campusId = localStorage.getItem('selected_campus_id') || '';
      const data: any = await userAPI.getList({
        page: currentPage,
        limit: 100,
        search: debouncedSearch,
        role: roleFilter,
        archived: showArchived,
        organization_id: orgId,
        campus_id: campusId,
      });
      setUsers(data.items || []);
      setTotalPages(data.pages || 1);
      setTotalUsers(data.total || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'STUDENT',
      cnic: '',
      phone: '',
      is_active: true,
      is_staff: false,
      must_change_password: false,
      branch_id: '',
      gender: '',
      whatsapp_number: '',
      father_name: '',
      address: '',
      dob: '',
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setFormData({
      email: user.email || '',
      password: '', 
      full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      role: user.role || 'STUDENT',
      cnic: user.cnic || '',
      phone: user.phone || '',
      is_active: user.is_active !== false,
      is_staff: user.is_staff === true,
      must_change_password: user.must_change_password === true,
      branch_id: user.branch_id || '',
      gender: user.gender || '',
      whatsapp_number: user.whatsapp_number || '',
      father_name: user.father_name || '',
      address: user.address || '',
      dob: user.date_of_birth || '',
    });
    setEditingId(user.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      const payload: any = {
        email: formData.email,
        role: formData.role,
        full_name: formData.full_name,
        cnic: formData.cnic,
        phone: formData.phone,
        is_active: formData.is_active,
        is_staff: formData.is_staff,
        must_change_password: formData.must_change_password,
        branch_id: formData.branch_id || null,
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }
      
      payload.username = formData.email.split('@')[0];

      // Include student-specific fields when applicable
      if (formData.role === 'STUDENT') {
        if (formData.gender) payload.gender = formData.gender;
        if (formData.whatsapp_number) payload.whatsapp_number = formData.whatsapp_number;
        if (formData.father_name) payload.father_name = formData.father_name;
        if (formData.address) payload.address = formData.address;
        if (formData.dob) payload.dob = formData.dob;
      }

      if (isEditMode && editingId) {
        payload.branch_id = formData.branch_id || null;
        await userAPI.update(editingId, payload);
        toast.success('User updated successfully');
      } else {
        await userAPI.create(payload);
        toast.success('User created successfully');
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Operation failed';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to archive(soft-delete) this user access?')) return;
    try {
      await userAPI.delete(id);
      toast.success('User archived successfully');
      setUsers(users.filter((user) => user.id !== id));
    } catch (error) {
      toast.error('Failed to archive user');
    }
  };

  const handleRestoreUser = async (id: string) => {
    try {
      await userAPI.restore(id);
      toast.success('User restored successfully');
      setUsers(users.filter((user) => user.id !== id));
    } catch (error) {
      toast.error('Failed to restore user');
    }
  };

  const filteredUsers = users; // Server-side filtered already
  const { sortedData, sortConfig, requestSort } = useSortableData(filteredUsers);

  const getRoleIcon = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return <Shield className="w-4 h-4" />;
      case 'TEACHER': return <Briefcase className="w-4 h-4" />;
      case 'STUDENT': return <GraduationCap className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN': return 'bg-slate-900 shadow-slate-900/10';
      case 'TEACHER': return 'bg-brand-teal shadow-brand-teal/20';
      case 'STUDENT': return 'bg-amber-500 shadow-amber-500/20';
      case 'COORDINATOR': return 'bg-purple-600 shadow-purple-600/20';
      case 'ACCOUNT_OFFICER': return 'bg-emerald-600 shadow-emerald-600/20';
      default: return 'bg-slate-400 shadow-slate-400/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Directory...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Platform Infrastructure</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Users className="w-7 h-7 text-brand-teal" />
              User Management
          </h1>
          <p className="text-slate-500 font-medium mt-1">Configure user access, roles, and administrative permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setShowArchived(!showArchived)} 
            variant="outline" 
            className={cn(
              "rounded-2xl border-slate-200 h-11 px-5 font-bold transition-all flex gap-2",
              showArchived ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {showArchived ? <Archive className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            {showArchived ? "Viewing Archived" : "View Archived"}
          </Button>
          <Button 
            onClick={fetchUsers} 
            variant="outline" 
            className="rounded-2xl border-slate-200 h-11 px-5 font-bold text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </Button>
          <Button 
            onClick={handleOpenAdd} 
            className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-11 px-6 font-bold shadow-lg shadow-brand-teal/20 flex gap-2"
          >
            <Plus className="w-5 h-5" /> Add New Portal Access
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Base', val: totalUsers, icon: Users, color: 'blue' },
          { label: 'Admins', val: users.filter(u => u.role === 'ADMIN').length, icon: Shield, color: 'slate' },
          { label: 'Faculty', val: users.filter(u => u.role === 'TEACHER').length, icon: Briefcase, color: 'teal' },
          { label: 'Officers', val: users.filter(u => u.role === 'ACCOUNT_OFFICER').length, icon: Shield, color: 'emerald' },
          { label: 'Learners', val: users.filter(u => u.role === 'STUDENT').length, icon: GraduationCap, color: 'orange' },
        ].map((s, idx) => (
          <div key={idx} className="premium-card p-6 flex items-center gap-5 group">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 duration-500 shadow-sm",
              s.color === 'blue' ? "bg-blue-50 text-blue-600" : 
              s.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
              s.color === 'orange' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-700"
            )}>
              <s.icon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Container ── */}
      <div className="premium-card overflow-hidden flex flex-col border-none shadow-premium">
        
        {/* Filters TopBar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
            <input
              placeholder="Search by name, email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/50 transition-all placeholder:text-slate-300"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative min-w-[160px]">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-200 rounded-2xl py-2.5 pl-4 pr-10 text-xs font-black text-slate-600 uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Administrators</option>
                <option value="TEACHER">Faculty Members</option>
                <option value="COORDINATOR">Coordinators</option>
                <option value="ACCOUNT_OFFICER">Account Officers</option>
                <option value="STUDENT">Learners</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <Button variant="outline" className="rounded-2xl h-10 border-slate-200 px-4 flex gap-2 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
              <Filter className="w-3.5 h-3.5" /> Filter
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] border-b border-slate-100">
              <tr>
                <SortableTableHeader label="Identity" sortKey="full_name" currentSort={sortConfig} onSort={requestSort} className="px-8 py-5 text-[10px]" />
                <SortableTableHeader label="Role" sortKey="role" currentSort={sortConfig} onSort={requestSort} className="px-8 py-5 text-[10px]" />
                <SortableTableHeader label="Status" sortKey="is_active" currentSort={sortConfig} onSort={requestSort} className="px-8 py-5 text-[10px]" />
                <SortableTableHeader label="Registry Date" sortKey="created_at" currentSort={sortConfig} onSort={requestSort} className="px-8 py-5 text-[10px]" />
                <th className="px-8 py-5 text-right text-[10px] uppercase font-black text-slate-400 tracking-[0.15em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                       <UserX className="w-16 h-16 text-slate-200" />
                       <div>
                         <p className="text-xl font-black text-slate-800 tracking-tight">No records discovered</p>
                         <p className="text-sm font-medium text-slate-400">Try refining your search parameters.</p>
                       </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((user) => {
                  const fn = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown Entity';
                  const roleCol = getRoleColor(user.role);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-lg shrink-0 transition-transform group-hover:scale-105 duration-300",
                            roleCol
                          )}>
                            {fn[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 tracking-tight truncate leading-none mb-1.5">{fn}</p>
                            <p className="text-xs font-medium text-slate-400 truncate leading-none">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100/50 border border-slate-200/50">
                          <div className={cn("p-1 rounded-md text-white", roleCol)}>
                            {getRoleIcon(user.role)}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                             {user.role || 'STUDENT'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-full", user.is_active !== false ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-rose-400")} />
                           <span className={cn(
                             "text-[10px] font-black uppercase tracking-widest",
                             user.is_active !== false ? "text-emerald-700" : "text-rose-700"
                           )}>
                              {user.is_active !== false ? "Active Session" : "Access Locked"}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2 text-slate-500">
                            <Activity size={14} className="text-slate-300" />
                            <span className="text-sm font-bold tracking-tight">
                               {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all">
                              <MoreHorizontal className="w-5 h-5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 premium-dashboard-scope shadow-xl border-slate-100">
                             <DropdownMenuItem onClick={() => handleOpenEdit(user)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer focus:bg-brand-teal/10 focus:text-brand-teal font-bold text-sm">
                                <Edit size={16} /> Edit Persona
                             </DropdownMenuItem>
                             {showArchived ? (
                               <DropdownMenuItem onClick={() => handleRestoreUser(user.id)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 font-bold text-sm">
                                  <RefreshCcw size={16} /> Restore Access
                               </DropdownMenuItem>
                             ) : (
                               <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700 font-bold text-sm">
                                  <Trash2 size={16} /> Terminate Access
                               </DropdownMenuItem>
                             )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination */}
        <div className="p-5 bg-slate-50/30 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {(currentPage - 1) * 100 + 1} - {Math.min(currentPage * 100, totalUsers)} of {totalUsers} entities
           </div>
           <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-brand-teal disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  // Only show current, first, last, and neighbors
                  if (
                    pageNum === 1 || 
                    pageNum === totalPages || 
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all",
                          currentPage === pageNum 
                            ? "bg-brand-teal text-white shadow-lg shadow-brand-teal/20" 
                            : "bg-white border border-slate-100 text-slate-400 hover:border-brand-teal/30"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === currentPage - 2 || 
                    pageNum === currentPage + 2
                  ) {
                    return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-brand-teal disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Next
              </button>
           </div>
        </div>
      </div>

      {/* ── Modal (High Fidelity) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] shadow-2xl p-8 md:p-10 animate-in zoom-in-95 duration-300 border border-white">
            
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-1">System Configuration</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                  {isEditMode ? 'Modify Entity' : 'Onboard New Access'}
                </h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Configure security credentials and portal permissions.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition-all hover:rotate-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Legal Full Name</label>
                  <input
                    required
                    placeholder="Enter full name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Operational Role</label>
                  <div className="relative">
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                    >
                      <option value="STUDENT">Student Learner</option>
                      <option value="TEACHER">Faculty Member</option>
                      <option value="COORDINATOR">Admin Coordinator</option>
                      <option value="ACCOUNT_OFFICER">Account Officer</option>
                      <option value="ADMIN">System Administrator</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assigned Branch</label>
                <div className="relative">
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value || null })}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  >
                    <option value="">No Branch (Global / Admin)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Email Identity</label>
                  <input
                    required
                    type="email"
                    placeholder="identity@iak.ngo"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Status</label>
                  <div className="flex items-center gap-3 h-[46px] bg-slate-50 border border-slate-200 rounded-2xl px-4">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                    />
                    <label htmlFor="is_active" className="text-sm font-bold text-slate-700 cursor-pointer text-xs">
                      {formData.is_active ? 'Active / Access Granted' : 'Locked / Access Denied'}
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Security Policy</label>
                  <div className="flex items-center gap-3 h-[46px] bg-slate-50 border border-slate-200 rounded-2xl px-4">
                    <input
                      type="checkbox"
                      id="must_change_password"
                      checked={formData.must_change_password}
                      onChange={(e) => setFormData({ ...formData, must_change_password: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                    />
                    <label htmlFor="must_change_password" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Force Password Reset
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Staff Access</label>
                  <div className="flex items-center gap-3 h-[46px] bg-slate-50 border border-slate-200 rounded-2xl px-4">
                    <input
                      type="checkbox"
                      id="is_staff"
                      checked={formData.is_staff}
                      onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                    />
                    <label htmlFor="is_staff" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Grant Staff Privileges
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                  <input
                    placeholder="+923..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">CNIC / ID Number</label>
                  <input
                    placeholder="42101-..."
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
              </div>

              {/* Student-specific fields — conditionally shown */}
              {formData.role === 'STUDENT' && (
                <>
                  <div className="pt-2 pb-1">
                    <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest">Student Profile Fields</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Gender</label>
                      <div className="relative">
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp Number</label>
                      <input
                        placeholder="+923..."
                        value={formData.whatsapp_number}
                        onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Father / Guardian Name</label>
                      <input
                        placeholder="Enter father's name"
                        value={formData.father_name}
                        onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Residential Address</label>
                    <input
                      placeholder="Full address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  {isEditMode ? 'Security Credential Update (Optional)' : 'Initial Password Credential'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required={!isEditMode}
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all"
                  />
                </div>
                {isEditMode && <p className="text-[10px] text-slate-400 pl-1">Leave blank to maintain current security credential.</p>}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl h-12 font-bold text-slate-500 border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-12 font-black shadow-xl shadow-brand-teal/20"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin" /> <span>Syncing...</span>
                    </div>
                  ) : (isEditMode ? 'Save Global Updates' : 'Confirm Access Onboarding')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
