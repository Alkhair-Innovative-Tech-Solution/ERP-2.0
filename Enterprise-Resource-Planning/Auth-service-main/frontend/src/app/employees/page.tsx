"use client";

import React, { useEffect, useState, useRef } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import Link from 'next/link';
import {
  Plus, Search, Filter, Phone, Mail, MoreHorizontal,
  Users, UserPlus, UserCheck, UserMinus,
  ChevronLeft, ChevronRight, X, Calendar,
  LayoutGrid, List as ListIcon, MoreVertical, Download, CreditCard,
  ShieldCheck, Smartphone, User as UserIcon,
  ShieldAlert, MoreVertical as Dots, Trash2, Edit2, ExternalLink
} from 'lucide-react';
import IDCard from '@/components/IDCard';
import Skeleton from '@/components/Skeleton';
import { fetchWithAuth } from '@/utils/api';
import AccessDenied from '@/components/AccessDenied';
import toast from "react-hot-toast";

// --- Types ---
interface Employee {
  employee_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  department?: { dept_name: string; dept_code: string } | null;
  designation?: { position_name: string; position_code: string } | null;
  is_active: boolean;
  created_at: string;
  image?: string;
  employment_type?: string;
  gender?: string;
  bio?: string;
  location?: string;
  cnic?: string;
}

// --- Utils ---
const getDeptColor = (deptName: string = '') => {
  const name = deptName.toLowerCase();
  if (name.includes('food')) return 'bg-orange-50 text-orange-600 border-orange-100/50';
  if (name.includes('acad')) return 'bg-blue-50 text-blue-600 border-blue-100/50';
  if (name.includes('health') || name.includes('medic')) return 'bg-rose-50 text-rose-600 border-rose-100/50';
  if (name.includes('it') || name.includes('tech') || name.includes('design')) return 'bg-purple-50 text-purple-600 border-purple-100/50';
  if (name.includes('admin') || name.includes('sales')) return 'bg-amber-50 text-amber-600 border-amber-100/50';
  return 'bg-slate-50 text-slate-600 border-slate-100/50';
};

// --- Components ---

const StatsCard = ({ title, count, icon: Icon, color, bgColor, loading }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex items-center justify-between">
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      {loading ? (
        <div className="h-8 w-16 bg-slate-50 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{count}</h3>
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
        </div>
      )}
    </div>
    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${bgColor} ${color} transition-all duration-500 group-hover:scale-110 shadow-sm`}>
      <Icon size={24} strokeWidth={2.5} />
    </div>
  </div>
);

const EmployeeCard = ({ employee, onClick, onDelete }: { employee: Employee, onClick: () => void, onDelete: (id: string) => void }) => (
  <div
    className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col items-center text-center relative"
  >
    {/* Status Indicator Dot */}
    <div className={`absolute top-6 right-6 h-2 w-2 rounded-full ${employee.is_active ? 'bg-emerald-400' : 'bg-rose-500'}`} />

    {/* Profile Initial */}
    <div onClick={onClick} className="h-13 w-13 rounded-2xl hover:bg-theme-800 bg-gray-400  flex items-center justify-center text-white text-lg font-black mb-4 shadow-lg shadow-blue-600/20 cursor-pointer transition-transform hover:scale-110">
      {employee.full_name.charAt(0)}
    </div>

    {/* Name & Designation & Gender */}
    <div className="mb-6 cursor-pointer flex flex-col items-center" onClick={onClick}>
      <h4 className="text-[14px] font-black text-zinc-900 tracking-tight">{employee.full_name}</h4>
      <div className="flex items-center gap-2 mt-2">
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${getDeptColor(employee.department?.dept_name)}`}>
          {employee.designation?.position_name || 'Personnel'}
        </p>
        <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${employee.gender === 'male' ? 'bg-blue-50 text-blue-600 border-blue-100' : employee.gender === 'female' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          {employee.gender || 'N/A'}
        </span>
      </div>
    </div>

    {/* Metrics Pills */}
    <div className="flex gap-2 w-full mb-5">
      <div className="flex-1 bg-emerald-50 border border-emerald-100/50 rounded-lg p-2 text-center">
        <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mb-1">Emp ID</p>
        <p className="text-[9px] font-black text-emerald-600">{employee.employee_code}</p>
      </div>
      <div className="flex-1 bg-zinc-50 border border-zinc-100/50 rounded-lg p-1 text-center">
        <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest mb-1">Join Date</p>
        <p className="text-[9px] font-black text-zinc-900">{new Date(employee.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>
    </div>

    {/* Action Footer */}
    <div className="flex items-center gap-3 w-full">
      <Link href={`/employees/${employee.employee_id}`} className="h-12 w-12 bg-white text-black rounded-xl flex items-center justify-center hover:bg-gray-300 transition-all active:scale-95 shadow-lg shadow-zinc-900/10">
        <Edit2 size={16} />
      </Link>
      <button
        onClick={() => onDelete(employee.employee_id)}
        className="h-12 w-12 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
      >
        <Trash2 size={16} />
      </button>
      <button
        onClick={onClick}
        className="flex-1 h-12 bg-white border border-zinc-100 text-zinc-400 rounded-lg flex items-center justify-center hover:text-zinc-900 hover:border-zinc-300 transition-all active:scale-95 shadow-sm"
      >
        <ShieldCheck size={18} />
      </button>
    </div>
  </div>
);

const ActionMenu = ({ emp, onDelete, onDetailClick }: { emp: Employee, onDelete: (id: string) => void, onDetailClick: (emp: Employee) => void }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 relative" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => { e.stopPropagation(); onDetailClick(emp); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
      >
        View profile <ExternalLink size={13} className="text-slate-400" />
      </button>
      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className={`h-[30px] w-[30px] flex items-center justify-center rounded-lg border transition-colors ${open ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <MoreVertical size={14} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200/50 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <Link href={`/service?employee_id=${emp.employee_id}`} className="w-full text-left px-4 py-2 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 flex items-center">
              Setup permissions
            </Link>
            <Link href={`/employees/${emp.employee_id}`} className="w-full text-left px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 flex items-center">
              Edit employee
            </Link>
            <button className="w-full text-left px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 flex items-center">
              Disable user
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(emp.employee_id); }}
              className="w-full text-left px-4 py-2 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 flex items-center mt-1 pt-2 border-t border-slate-50"
            >
              Remove user
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EmployeeTable = ({ employees, onDetailClick, onDelete, loading }: { employees: Employee[], onDetailClick: (emp: Employee) => void, onDelete: (id: string) => void, loading: boolean }) => (
  <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm mt-8">
    <div className="overflow-x-auto">
      <table className="w-full text-left ">
        <thead className='bg-slate-50/30'>
          <tr className="border-b border-zinc-400 bg-slate-50/50">
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Name</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Gender</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Employee ID</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Phone</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Join Date</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Department</th>
            <th className="py-6 px-8 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50/50">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="p-8" colSpan={6}><Skeleton height={40} className="w-full" /></td>
              </tr>
            ))
          ) : employees.length === 0 ? (
            <tr>
              <td className="p-20 text-center" colSpan={6}>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No personnel records found</p>
              </td>
            </tr>
          ) : (
            employees.map((emp) => (
              <tr
                key={emp.employee_id}
                onClick={() => onDetailClick(emp)}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer border-b border-slate-50 last:border-0"
              >
                <td className="py-5 px-8">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-full bg-slate-50/50 overflow-hidden flex items-center justify-center text-white text-sm font-black shadow-lg shadow-slate-900/10 transition-transform group-hover:scale-105">
                      {emp.image ? (
                        <img src={emp.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        emp.full_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h5 className="text-[14px] font-bold text-slate-900 group-hover:text-theme-800 transition-colors leading-tight">{emp.full_name}</h5>
                      <p className="text-[11px] font-medium text-slate-400 lowercase">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-5 px-8">
                  <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${emp.gender === 'male' ? 'bg-blue-50 text-blue-600 border-blue-100' : emp.gender === 'female' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                    {emp.gender || 'N/A'}
                  </span>
                </td>
                <td className="py-5 px-8">
                  <span className="text-[11px] font-black text-theme-800 bg-purple-50/50 px-3 py-1.5 rounded-lg tracking-wider border border-purple-100/50">
                    {emp.employee_code}
                  </span>
                </td>
                <td className="py-5 px-8 text-[12px] font-semibold text-slate-500 italic">
                  {emp.phone}
                </td>
                <td className="py-5 px-8 text-[12px] font-bold text-slate-700">
                  {new Date(emp.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-5 px-8">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${getDeptColor(emp.department?.dept_name)}`}>
                    {emp.department?.dept_name || 'General'}
                  </span>
                </td>
                <td className="py-5 px-8">
                  <ActionMenu emp={emp} onDelete={onDelete} onDetailClick={onDetailClick} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const DetailModal = ({ employee, open, onClose }: { employee: Employee | null, open: boolean, onClose: () => void }) => {
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    if (!open) setShowCard(false);
  }, [open]);

  if (!open || !employee) return null;

  const handlePrint = () => {
    window.print();
  };
  ///employees first  card 
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2">
      <div className="fixed inset-0 bg-zinc-900/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative z-70 overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-7 relative flex flex-col items-center max-h-[90vh] overflow-y-auto custom-scrollbar">
          <button onClick={onClose} className="absolute top-10 right-10 text-zinc-400 hover:text-zinc-900 border border-zinc-100 p-2 rounded-lg transition-all print:hidden"><X size={24} /></button>

          {!showCard ? (
            <>
              <div className="h-25 w-25 rounded-2xl bg-theme-800 flex items-center justify-center text-white text-5xl font-black mb-3 shadow-2xl shadow-blue-600/20">
                {employee.full_name.charAt(0)}
              </div>
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{employee.full_name}</h3>
              <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em] mt-3 bg-blue-50 px-6 py-2 rounded-full border border-blue-100">{employee.designation?.position_name || 'No Designation'}</p>

              <div className="grid grid-cols-2 gap-4 w-full mt-5 pt-5 border-t border-zinc-100">
                <div className="bg-zinc-100 p-4 rounded-2xl border border-zinc-100">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ">Email Address</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{employee.email}</p>
                </div>
                <div className="bg-zinc-100 p-4 rounded-2xl border border-zinc-100">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Phone Access</p>
                  <p className="text-sm font-bold text-zinc-900">{employee.phone}</p>
                </div>
              </div>

              <div className="mt-5 w-100 flex gap-4">
                <button
                  onClick={() => setShowCard(true)}
                  className="flex-1 h-14 bg-theme-800 text-white rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:[var(--color-theme-800)] transition-all shadow-xl active:scale-95"
                >
                  <CreditCard size={18} /> Generate ID Card
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center w-full animate-in slide-in-from-bottom-4 duration-500">
              <IDCard employee={{
                ...employee,
                join_date: new Date(employee.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                designation: { position_name: employee.designation?.position_name || 'Personnel' },
                department: { dept_name: employee.department?.dept_name || 'General' }
              }} />

              <div className=" flex gap-4 w-full px-8 print:hidden">
                <button
                  onClick={() => setShowCard(false)}
                  className="flex-1 h-14 bg-zinc-100 text-zinc-400 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 transition-all"
                >
                  Back to Profile
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 h-14 bg-theme-800 text-white rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-theme-800 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                >
                  <Download size={18} /> Print Card
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/employees/employees')
      if (res.status === 403) { setForbidden(true); return; }
      if (res.ok) {
        const data = await res.json();
        // Handle both Array response and { employees: Array } response
        const employeeArray = Array.isArray(data) ? data : (data.employees || []);
        setEmployees(employeeArray);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
      setEmployees([]); // Fallback to empty array on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = Array.isArray(employees) ? employees.filter(e => {
    const matchesSearch = (e.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_code || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? e.is_active : !e.is_active);
    const matchesEmploymentType = employmentTypeFilter === 'All' || (e.employment_type === employmentTypeFilter);
    const matchesGender = genderFilter === 'All' || (e.gender === genderFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesEmploymentType && matchesGender;
  }) : [];

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to archive this employee? The record will be preserved and can be restored by an admin.")) return;
    
    try {
      const res = await fetchWithAuth(`/employees/employees/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setEmployees(employees.filter(emp => emp.employee_id !== id));
        toast.success("Employee Deleted Successfully", { style: { backgroundColor: '#ef4444', color: '#fff' }, icon: '🗑️' });
      } else {
        const error = await res.json();
        alert(`Failed to delete employee: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete employee. Please try again.");
    }
  }

  const stats = {
    total: Array.isArray(employees) ? employees.length : 0,
    new: Array.isArray(employees) ? employees.filter(e => (new Date().getTime() - new Date(e.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000).length : 0,
    male: Array.isArray(employees) ? employees.filter(e => (e.gender || '').toLowerCase() === 'male').length : 0,
    female: Array.isArray(employees) ? employees.filter(e => (e.gender || '').toLowerCase() === 'female').length : 0,
  };
  if (forbidden) return <ProtectedLayout><AccessDenied permission="employee.view" /></ProtectedLayout>;

  // employees main page
  return (
    <ProtectedLayout>
      <div className="p-4 sm:p-4 lg:p-6 max-w-400 mx-auto space-y-6 animate-in fade-in duration-70">

        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-theme-800 text-white p-3 rounded-xl shadow-md">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-theme-800 tracking-tight uppercase">
                EMPLOYEES
              </h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                PERSONNEL REGISTRY
              </p>
            </div>
          </div>

          <Link
            href="/employees/new"
            className="flex items-center gap-2 bg-theme-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-theme-900 transition-colors shadow-sm whitespace-nowrap uppercase tracking-widest active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} /> ADD EMPLOYEE
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div onClick={() => { setStatusFilter('All'); setGenderFilter('All'); setEmploymentTypeFilter('All'); }} className="cursor-pointer">
            <StatsCard title="Total Employee" count={stats.total} icon={Users} color="text-purple-600" bgColor="bg-purple-50/50" loading={loading} />
          </div>
          <StatsCard title="New Employee" count={stats.new} icon={UserPlus} color="text-amber-600" bgColor="bg-amber-50/50" loading={loading} />
          <div onClick={() => setGenderFilter('Male')} className="cursor-pointer">
            <StatsCard title="Male" count={stats.male} icon={UserIcon} color="text-blue-600" bgColor="bg-blue-50/50" loading={loading} />
          </div>
          <div onClick={() => setGenderFilter('Female')} className="cursor-pointer">
            <StatsCard title="Female" count={stats.female} icon={UserIcon} color="text-emerald-600" bgColor="bg-emerald-50/50" loading={loading} />
          </div>
        </div>


        {/* Filter Section */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 items-end mt-6  p-3 rounded-2xl ">

          <div className="space-y-3">

            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Employee Name / ID</label>

            <div className="relative group">

              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />

              <input

                type="text"

                placeholder="Search here..."

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                className="w-full h-14 pl-10 pr-4 bg-white border border-zinc-100 rounded-2xl outline-none focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 transition-all text-sm font-bold"

              />

            </div>

          </div>



          <div className="space-y-3">

            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Select Status</label>

            <select

              value={statusFilter}

              onChange={(e) => setStatusFilter(e.target.value)}

              className="w-full h-14 px-5 bg-white border border-zinc-100 rounded-2xl outline-none focus:border-zinc-900 transition-all text-sm font-bold appearance-none cursor-pointer"

            >

              <option value="All">All</option>

              <option value="Active">Active</option>

              <option value="Inactive">Inactive</option>

            </select>

          </div>

          <div className="space-y-3">

            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Select Gender</label>

            <select

              value={genderFilter}

              onChange={(e) => setGenderFilter(e.target.value)}

              className="w-full h-14 px-5 bg-white border border-zinc-100 rounded-2xl outline-none focus:border-zinc-900 transition-all text-sm font-bold appearance-none cursor-pointer"

            >

              <option value="All">All Gender</option>

              <option value="Male">Male</option>

              <option value="Female">Female</option>

            </select>

          </div>
          <div className="space-y-3">

            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Select Employment Type</label>

            <select

              value={employmentTypeFilter}

              onChange={(e) => setEmploymentTypeFilter(e.target.value)}

              className="w-full h-14 px-5 bg-white border border-zinc-100 rounded-2xl outline-none focus:border-zinc-900 transition-all text-sm font-bold appearance-none cursor-pointer"

            >

              <option value="All">All Types</option>

              <option value="Full-time">Full-time</option>

              <option value="Part-time">Part-time</option>

              {/* <option value="Contract">Contract</option>

              <option value="Intern">Intern</option> */}

            </select>

          </div>
        </div>

        {/* Options Row
        <div className="flex items-center justify-between ">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Show Entries</p>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(e.target.value)}
              className="h-10 px-2 bg-white border border-zinc-100 rounded-lg outline-none text-[10px] font-black uppercase cursor-pointer"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
          <div className="flex items-center p-1 bg-zinc-100 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`h-10 w-10 flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white rounded-lg shadow-sm text-blue-600' : 'text-zinc-400 hover:text-zinc-900'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`h-10 w-10 flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white rounded-lg shadow-sm text-blue-600' : 'text-zinc-400 hover:text-zinc-900'}`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div> */}

        {/* View Content */}
        {viewMode === 'list' ? (
          <EmployeeTable
            employees={filtered.slice(0, entriesPerPage === 'All' ? filtered.length : parseInt(entriesPerPage))}
            loading={loading}
            onDetailClick={(emp) => {
              setSelectedEmployee(emp);
              setIsModalOpen(true);
            }}
            onDelete={handleDelete}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 mt-5">
            {loading ? (
              [...Array(entriesPerPage === 'All' ? 10 : parseInt(entriesPerPage))].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-zinc-100 p-8 shadow-sm h-80">
                  <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-3/4 mx-auto mt-5" />
                  <Skeleton className="h-3 w-1/2 mx-auto mt-2" />
                  <div className="flex gap-2 mt-8">
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                    <Skeleton className="h-10 flex-1 rounded-lg" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-zinc-100">
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No personnel records found</p>
              </div>
            ) : (
              filtered.slice(0, entriesPerPage === 'All' ? filtered.length : parseInt(entriesPerPage)).map((emp) => (
                <EmployeeCard
                  key={emp.employee_id}
                  employee={emp}
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}

      </div>

      <DetailModal
        employee={selectedEmployee}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </ProtectedLayout>
  );
}

