"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fetchWithAuth } from '@/utils/api';
import { rbacService, type EmployeeRoleAssignment, type RbacRole, type RbacRoleDetail, type RbacPermission } from '@/services/rbacService';
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  ChevronsUpDown,
  Plus,
  Search,
  Filter,
  Power,
  X,
  Calendar,
  Building,
  Edit
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================
interface SelectOption {
  id: number;
  name: string;
  code?: string;
}

interface AccessPayload {
  access_type: 'employee' | 'superadmin';
  employee_id?: string | number | null;
  superadmin_id?: string | number | null;
  service_code: string;
  is_active: boolean;
  password?: string;
  role?: string;
  granted_at: string;
  granted_by: number;
  notes?: string;
}

// ==========================================
// 2. API SERVICE LAYER
// ==========================================
const accessService = {
  getEmployees: async (search?: string): Promise<SelectOption[]> => {
    try {
      const url = `/employees/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) return [];
      const data = await res.json();
      const employeeArray = Array.isArray(data) ? data : (data.employees || data.results || []);
      return employeeArray.map((emp: any) => ({
        id: emp.id || emp.employee_id,
        name: `${emp.full_name} (${emp.employee_code})`,
        code: emp.employee_id
      }));
    } catch {
      return [];
    }
  },
  getSuperadmins: async (search?: string): Promise<SelectOption[]> => {
    return [
      { id: 1, name: "Alexander Wright (SA-001)", code: "SA-001" },
      { id: 2, name: "Sarah Connor (SA-002)", code: "SA-002" }
    ];
  },
  getServices: async (): Promise<SelectOption[]> => {
    return [
      { id: 1, name: "HDMS (Help Desk)", code: "hdms" },
      { id: 2, name: "VMS (Visitor Management)", code: "vms" },
      { id: 3, name: "Auth (RBAC Roles)", code: "auth" },
      { id: 4, name: "SIS (Student Information)", code: "sis" },
    ];
  },
  getHdmsUsers: async (params: { search?: string; role?: string; status?: string }): Promise<{ results: any[] }> => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.role) query.append('role', params.role);
    if (params.status) query.append('status', params.status);
    
    const res = await fetchWithAuth(`/permissions/hdms-users?${query.toString()}`);
    if (!res.ok) return { results: [] };
    return res.json();
  },
  getVmsUsers: async (params: { search?: string; role?: string; status?: string }): Promise<{ results: any[] }> => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.role) query.append('role', params.role);
    if (params.status) query.append('status', params.status);
    
    const res = await fetchWithAuth(`/permissions/vms-users?${query.toString()}`);
    if (!res.ok) return { results: [] };
    return res.json();
  },
  toggleAccess: async (employeeId: string, service: string): Promise<any> => {
    const res = await fetchWithAuth(`/permissions/toggle-access?employee_id=${encodeURIComponent(employeeId)}&service=${encodeURIComponent(service)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to toggle service access.');
    }
    return res.json();
  },
  createAccess: async (payload: AccessPayload): Promise<{ message?: string }> => {
    if (payload.service_code === 'auth') {
      const res = await fetchWithAuth('/permissions/rbac/employee-roles', {
        method: 'POST',
        body: JSON.stringify({ employee_id: payload.employee_id, role_id: payload.role }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || 'Failed to assign auth role.');
      }
      return { message: 'Auth role assigned successfully.' };
    }

    let url = '';
    const bodyPayload: Record<string, unknown> = {
      employee_id: payload.employee_id,
      password: payload.password,
      role: payload.role,
      change_password: true
    };

    if (payload.service_code === 'hdms') {
      url = '/permissions/grant-hdms-access';
    } else if (payload.service_code === 'vms') {
      url = '/permissions/grant-vms-access';
    } else {
      throw new Error(`Manual access grant is not supported for ${payload.service_code.toUpperCase()}.`);
    }

    const res = await fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error || 'Target server rejected access transaction configuration.');
    }
    return res.json();
  }
};

// ==========================================
// 3. ZOD RUNTIME VALIDATION SCHEMA
// ==========================================
const serviceRoles: Record<string, { value: string; label: string }[]> = {
  hdms: [
    { value: 'requestor', label: 'Requestor (Can only create tickets)' },
    { value: 'assignee', label: 'Assignee (Can be assigned tickets)' },
    { value: 'moderator', label: 'Moderator (Full ticket management)' },
    { value: 'admin', label: 'Administrator (Full system access)' },
  ],
  vms: [
    { value: 'security_staff', label: 'Security Staff' },
    { value: 'receptionist', label: 'Receptionist' },
    { value: 'admin', label: 'Administrator (Full control)' },
  ]
};

const accessFormSchema = z.object({
  access_type: z.enum(['employee', 'superadmin']),
  employee_id: z.union([z.string(), z.number()]).nullable().optional(),
  superadmin_id: z.union([z.string(), z.number()]).nullable().optional(),
  service_code: z.string().min(1, 'Service selection is required'),
  role: z.string().optional(),
  is_active: z.boolean(),
  password: z.string(),
  confirm_password: z.string(),
  granted_at: z.string().min(1, 'Grant date/time is required'),
  granted_by: z.number(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
}).refine((data) => {
  if (data.access_type === 'employee' && !data.employee_id) return false;
  return true;
}, {
  message: "Employee selection is required",
  path: ["employee_id"]
}).refine((data) => {
  if (data.access_type === 'superadmin' && !data.superadmin_id) return false;
  return true;
}, {
  message: "SuperAdmin selection is required",
  path: ["superadmin_id"]
}).refine((data) => {
  if ((data.service_code === 'hdms' || data.service_code === 'vms' || data.service_code === 'auth') && !data.role) return false;
  return true;
}, {
  message: "Role selection is required for this service",
  path: ["role"]
}).refine((data) => {
  if (data.service_code === 'auth') return true;
  const pwd = data.password || '';
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd) && /^[A-Za-z0-9]+$/.test(pwd);
}, {
  message: "Password must be 8+ chars, alphanumeric with upper, lower, and digit",
  path: ["password"]
}).refine((data) => {
  if (data.service_code === 'auth') return true;
  return data.password === data.confirm_password;
}, {
  message: "Passwords do not match",
  path: ["confirm_password"]
});

type AccessFormValues = z.infer<typeof accessFormSchema>;

// ==========================================
// 4. AUTH TAB COMPONENTS
// ==========================================

function RoleManagementPanel() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<RbacPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRoleDetail | null>(null);
  const [processing, setProcessing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([rbacService.listRoles('auth'), rbacService.listPermissions('auth')])
      .then(([rolesData, permsData]) => {
        setRoles(rolesData.roles);
        setAllPermissions(permsData.permissions);
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setFormName(''); setFormDescription(''); setFormPermissions([]);
    setEditingRole(null); setShowModal(true);
  };

  const openEdit = async (role: RbacRole) => {
    const detail = await rbacService.getRole(role.id);
    setFormName(detail.name); setFormDescription(detail.description);
    setFormPermissions(detail.permission_codenames);
    setEditingRole(detail); setShowModal(true);
  };

  const handleSave = async () => {
    setProcessing(true);
    try {
      if (editingRole) {
        await rbacService.updateRole(editingRole.id, {
          name: formName, description: formDescription, permission_codenames: formPermissions,
        });
        toast.success('Role updated');
      } else {
        await rbacService.createRole({
          name: formName, service: 'auth', description: formDescription, permission_codenames: formPermissions,
        });
        toast.success('Role created');
      }
      const updated = await rbacService.listRoles('auth');
      setRoles(updated.roles);
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (role: RbacRole) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await rbacService.deleteRole(role.id);
      setRoles(prev => prev.filter(r => r.id !== role.id));
      toast.success('Role deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role');
    }
  };

  const togglePermission = (codename: string) =>
    setFormPermissions(prev =>
      prev.includes(codename) ? prev.filter(c => c !== codename) : [...prev, codename],
    );

  if (loading) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-5 flex items-center gap-3 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-xs">Loading roles...</span>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Auth Roles</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-theme-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-theme-900 transition"
        >
          <Plus className="h-3.5 w-3.5" /> New Role
        </button>
      </div>

      {roles.length === 0 ? (
        <p className="text-xs text-slate-400">No auth roles defined. Create one above.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-xs font-semibold text-slate-700">{role.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">{role.permission_count} perms</span>
              <button onClick={() => openEdit(role)} className="text-slate-400 hover:text-theme-600 transition">
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(role)} className="text-slate-400 hover:text-rose-600 transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">
                  {editingRole ? 'Edit Role' : 'Create Auth Role'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Role Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. HR Manager"
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-theme-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Brief description"
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-theme-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-2">Permissions</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-100 rounded-lg">
                    {allPermissions.map(perm => (
                      <label key={perm.codename} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={formPermissions.includes(perm.codename)}
                          onChange={() => togglePermission(perm.codename)}
                          className="rounded border-slate-300 text-theme-600"
                        />
                        <span className="text-xs text-slate-600">{perm.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{formPermissions.length} selected</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
                <button onClick={() => setShowModal(false)} className="px-4 h-9 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formName.trim() || processing}
                  className="px-4 h-9 text-xs font-semibold bg-theme-600 text-white rounded-lg hover:bg-theme-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverridesPanel({ employeeId }: { employeeId: string }) {
  const [allPermissions, setAllPermissions] = useState<RbacPermission[]>([]);
  const [overrides, setOverrides] = useState<Array<{ id: string; permission_codename: string; is_allowed: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedPerm, setSelectedPerm] = useState('');
  const [isAllowed, setIsAllowed] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rbacService.listPermissions('auth')
      .then(data => setAllPermissions(data.permissions))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const handleAdd = async (force = false) => {
    if (!selectedPerm) return;
    setSaving(true);
    try {
      const ov = await rbacService.createOverride(employeeId, selectedPerm, isAllowed, force);
      setOverrides(prev => [...prev, { id: ov.id, permission_codename: ov.permission_codename, is_allowed: ov.is_allowed }]);
      setSelectedPerm('');
      setAdding(false);
      toast.success(`${isAllowed ? 'ALLOW' : 'DENY'} override added`);
    } catch (err: any) {
      if (err.status === 409) {
        const confirmed = window.confirm(`⚠️ ${err.message}\n\nProceed anyway?`);
        if (confirmed) {
          setSaving(false);
          return handleAdd(true);
        }
      } else {
        toast.error(err.message || 'Failed to add override');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await rbacService.removeOverride(id);
      setOverrides(prev => prev.filter(o => o.id !== id));
      toast.success('Override removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove override');
    }
  };

  if (loading) return (
    <div className="bg-slate-50 rounded-xl p-4 mt-1 border border-slate-100 flex items-center gap-2 text-slate-400 text-xs">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading permissions...
    </div>
  );

  return (
    <div className="bg-slate-50 rounded-xl p-4 mt-1 border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Permission Overrides</h4>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-theme-800 text-white rounded-lg hover:bg-theme-900 transition"
        >
          <Plus className="h-3 w-3" /> Add Override
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-white rounded-lg border border-slate-100">
          <select
            value={selectedPerm}
            onChange={e => setSelectedPerm(e.target.value)}
            className="flex-1 min-w-40 h-8 px-2 text-xs border border-slate-200 rounded-md"
          >
            <option value="">Select permission...</option>
            {allPermissions.map(p => (
              <option key={p.codename} value={p.codename}>{p.name} ({p.codename})</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsAllowed(true)}
              className={`px-2 py-1 text-[10px] font-semibold rounded ${isAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
            >ALLOW</button>
            <button
              type="button"
              onClick={() => setIsAllowed(false)}
              className={`px-2 py-1 text-[10px] font-semibold rounded ${!isAllowed ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
            >DENY</button>
          </div>
          <button
            onClick={() => handleAdd()}
            disabled={!selectedPerm || saving}
            className="px-3 h-8 text-[10px] font-semibold bg-theme-600 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
          </button>
        </div>
      )}

      {overrides.length === 0 ? (
        <p className="text-[10px] text-slate-400">No overrides. Use &quot;Add Override&quot; to grant or block specific permissions.</p>
      ) : (
        <div className="space-y-1">
          {overrides.map(ov => (
            <div key={ov.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${ov.is_allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {ov.is_allowed ? 'ALLOW' : 'DENY'}
                </span>
                <span className="text-[11px] font-mono text-slate-600">{ov.permission_codename}</span>
              </div>
              <button onClick={() => handleRemove(ov.id)} className="text-slate-400 hover:text-rose-500 transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthAssignmentRow({
  assignment,
  onRemove,
}: {
  assignment: EmployeeRoleAssignment;
  onRemove: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <>
      <tr className="hover:bg-slate-50/50 transition">
        <td className="px-6 py-4 font-mono text-[11px]">{assignment.employee_id}</td>
        <td className="px-6 py-4">
          <span className="px-2 py-1 bg-theme-50 text-theme-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
            {assignment.role_name}
          </span>
        </td>
        <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
          {new Date(assignment.granted_at).toLocaleDateString()}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600"
            >
              <Edit className="h-3 w-3" /> Overrides
            </button>
            <button
              onClick={async () => {
                setRemoving(true);
                try { await onRemove(assignment.id); } finally { setRemoving(false); }
              }}
              disabled={removing}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 transition"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="px-6 pb-4">
            <OverridesPanel employeeId={assignment.employee_id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ==========================================
// 5. INLINE COMPONENT: ASYNC SEARCH SELECT
// ==========================================
function AsyncSearchSelect({
  fetchOptions,
  value,
  onChange,
  placeholder
}: {
  fetchOptions: (search?: string) => Promise<SelectOption[]>;
  value?: number | string;
  onChange: (value: any) => void;
  placeholder: string;
}) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchOptions();
        setOptions(data);
      } catch (err) {
        console.error("Error pulling dropdown details: ", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchOptions]);

  return (
    <div className="relative w-full">
      <select
        className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-theme-500 transition-colors cursor-pointer appearance-none text-slate-600 "
        value={value || ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(isNaN(Number(val)) ? val : Number(val));
        }}
      >
        <option value="" disabled hidden>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.code || opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4" />}
      </div>
    </div>
  );
}

// ==========================================
// 5. MAIN service  PAGE COMPONENT
// ==========================================
export default function ServiceAccessManagement() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSubsystem, setSelectedSubsystem] = useState<'hdms' | 'vms' | 'auth'>('hdms');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authAssignments, setAuthAssignments] = useState<EmployeeRoleAssignment[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(false);

  const currentAdmin = { id: 1, name: "Alexander Wright (Superadmin)" };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<AccessFormValues>({
    resolver: zodResolver(accessFormSchema),
    defaultValues: {
      access_type: 'employee',
      employee_id: null,
      superadmin_id: null,
      service_code: '',
      role: '',
      is_active: true,
      password: '',
      confirm_password: '',
      granted_at: new Date().toISOString().slice(0, 16),
      granted_by: currentAdmin.id,
      notes: '',
    },
  });

  const currentAccessType = watch('access_type');
  const passwordVal = watch('password') || '';
  const isActiveVal = watch('is_active');
  const serviceCodeVal = watch('service_code');
  const [dynamicRoles, setDynamicRoles] = useState<{ value: string; label: string }[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const empId = params.get('employee_id');
      if (empId) {
        setModalOpen(true);
        setValue('access_type', 'employee');
        setValue('employee_id', empId);
      }
    }
  }, [setValue]);

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const params = {
        search: searchQuery,
        role: roleFilter,
        status: statusFilter
      };
      const data = selectedSubsystem === 'hdms' 
        ? await accessService.getHdmsUsers(params)
        : await accessService.getVmsUsers(params);
      setUsers(data.results || []);
    } catch (err) {
      console.error("Failed to fetch service users:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (selectedSubsystem === 'auth') {
      setLoadingAuth(true);
      rbacService.listEmployeeRoles()
        .then(data => setAuthAssignments(data.assignments))
        .catch(() => setAuthAssignments([]))
        .finally(() => setLoadingAuth(false));
    } else {
      fetchUsersList();
    }
  }, [selectedSubsystem, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    if (currentAccessType === 'employee') setValue('superadmin_id', null);
    if (currentAccessType === 'superadmin') setValue('employee_id', null);
  }, [currentAccessType, setValue]);

  useEffect(() => {
    setValue('role', '');
  }, [serviceCodeVal, setValue]);

  useEffect(() => {
    if (!serviceCodeVal) { setDynamicRoles([]); return; }
    if (serviceCodeVal === 'hdms') {
      setDynamicRoles([
        { value: 'requestor', label: 'Requestor (Can only create tickets)' },
        { value: 'assignee', label: 'Assignee (Can be assigned tickets)' },
        { value: 'moderator', label: 'Moderator (Full ticket management)' },
        { value: 'admin', label: 'Administrator (Full system access)' },
      ]);
      return;
    }
    if (serviceCodeVal === 'vms') {
      setDynamicRoles([
        { value: 'security_staff', label: 'Security Staff' },
        { value: 'receptionist', label: 'Receptionist' },
        { value: 'admin', label: 'Administrator (Full control)' },
      ]);
      return;
    }
    if (serviceCodeVal === 'auth') {
      setLoadingRoles(true);
      rbacService.listRoles('auth')
        .then(data => setDynamicRoles(data.roles.map(r => ({ value: r.id, label: r.name }))))
        .catch(() => setDynamicRoles([]))
        .finally(() => setLoadingRoles(false));
      return;
    }
    setDynamicRoles([]);
  }, [serviceCodeVal]);

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    return score;
  };

  const onSubmit = async (values: AccessFormValues) => {
    setIsSubmitting(true);
    try {
      const payload: AccessPayload = {
        access_type: values.access_type,
        employee_id: values.access_type === 'employee' ? values.employee_id : null,
        superadmin_id: values.access_type === 'superadmin' ? values.superadmin_id : null,
        service_code: values.service_code,
        is_active: values.is_active,
        password: values.password,
        role: values.role,
        granted_at: new Date(values.granted_at).toISOString(),
        granted_by: values.granted_by,
        notes: values.notes,
      };

      const result = await accessService.createAccess(payload);
      toast.success(result?.message || "Access tokens successfully established.");
      setModalOpen(false);
      fetchUsersList();
      reset({
        access_type: 'employee',
        employee_id: null,
        superadmin_id: null,
        service_code: '',
        role: '',
        is_active: true,
        password: '',
        confirm_password: '',
        granted_at: new Date().toISOString().slice(0, 16),
        granted_by: currentAdmin.id,
        notes: ''
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Pipeline Sync Error: Target server rejected transaction.";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    //header
    <ProtectedLayout>
      <div className="p-2 sm:p-4 lg:p-6 max-w-400 mx-auto space-y-6 animate-in fade-in duration-500">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-theme-800 text-white p-3 rounded-xl shadow-md">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-theme-800 tracking-tight uppercase">
                SERVICES
              </h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                ACCESS REGISTRY
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-theme-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs hover:bg-theme-900 transition-colors shadow-sm whitespace-nowrap uppercase tracking-widest active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} /> ADD SERVICE
          </button>
        </div>

        <main className="max-w-8xl  py-5 ">
          {/* Filter Bar Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              {/* Subsystem tabs */}
              <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl">
                <button
                  onClick={() => { setSelectedSubsystem('hdms'); setRoleFilter(''); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${selectedSubsystem === 'hdms' ? 'bg-white text-theme-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  HDMS Subsystem
                </button>
                <button
                  onClick={() => { setSelectedSubsystem('vms'); setRoleFilter(''); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${selectedSubsystem === 'vms' ? 'bg-white text-theme-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  VMS Subsystem
                </button>
                <button
                  onClick={() => { setSelectedSubsystem('auth'); setRoleFilter(''); }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${selectedSubsystem === 'auth' ? 'bg-white text-theme-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Auth Subsystem
                </button>
              </div>
              
              <div className="text-xs text-slate-400 font-mono">
                {selectedSubsystem === 'auth'
                  ? `${authAssignments.length} auth role assignments`
                  : `${users.length} provisioned ${selectedSubsystem.toUpperCase()} credentials`}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 h-10 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-theme-500 transition-all text-slate-600 placeholder-slate-400"
                />
              </div>

              {/* Role filter */}
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-3 h-10 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-theme-500 transition-all text-slate-600 cursor-pointer appearance-none"
                >
                  <option value="">All Roles</option>
                  {selectedSubsystem === 'hdms' ? (
                    <>
                      <option value="requestor">Requestor</option>
                      <option value="assignee">Assignee</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Administrator</option>
                    </>
                  ) : (
                    <>
                      <option value="security_staff">Security Staff</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Administrator</option>
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-3 h-10 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-theme-500 transition-all text-slate-600 cursor-pointer appearance-none"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </div>
              </div>
              
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('');
                  setStatusFilter('');
                }}
                className="h-10 text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition rounded-xl flex items-center justify-center gap-1.5 text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
              </button>
            </div>
          </div>

          {/* Role Management Panel — Auth only */}
          {selectedSubsystem === 'auth' && <RoleManagementPanel />}

          {/* Table Listing */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {selectedSubsystem === 'auth' ? (
              loadingAuth ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-theme-500" />
                  <span className="text-xs font-medium">Loading Auth role assignments...</span>
                </div>
              ) : authAssignments.length === 0 ? (
                <div className="p-20 text-center text-slate-400 text-xs font-medium">
                  No Auth service role assignments found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-4">Employee ID</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Granted At</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                      {authAssignments.map((assignment) => (
                        <AuthAssignmentRow
                          key={assignment.id}
                          assignment={assignment}
                          onRemove={async (id) => {
                            await rbacService.removeRoleAssignment(id);
                            setAuthAssignments(prev => prev.filter(a => a.id !== id));
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              loadingUsers ? (
                <div className="p-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-theme-500" />
                  <span className="text-xs font-medium">Resolving access profiles directory...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="p-20 text-center text-slate-400 text-xs font-medium">
                  No active service access records found matching the criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-6 py-4">Employee Details</th>
                        <th className="px-6 py-4">System Service</th>
                        <th className="px-6 py-4">Assigned Role</th>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Last Interaction</th>
                        <th className="px-6 py-4">Provision Date</th>
                        <th className="px-6 py-4 text-right">Access Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{user.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.employee_code}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-theme-50 text-theme-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                              {selectedSubsystem}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] capitalize">{user.role}</td>
                          <td className="px-6 py-4 text-slate-500">{user.department || '—'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                            {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                            {user.join_date ? new Date(user.join_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await accessService.toggleAccess(user.employee_code, selectedSubsystem);
                                  toast.success(res.message || "Successfully toggled access status.");
                                  fetchUsersList();
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to toggle status.");
                                }
                              }}
                              className={`inline-flex items-center justify-center p-2 rounded-lg border transition ${user.status === 'active' ? 'border-rose-100 text-rose-600 hover:bg-rose-50' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'}`}
                              title={user.status === 'active' ? 'Deactivate Access' : 'Activate Access'}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </main>

        {/* Slide-out Drawer / Modal for Provision Access from service  */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setModalOpen(false)}
            />
            
            <div className="flex min-h-full items-center justify-center p-3">
              <div className="relative transform overflow-hidden rounded-2xl bg-slate-50 p-5 shadow-2xl transition-all w-full max-w-2xl border border-slate-100">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-theme-600" /> Provision System Subsystem Access
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Setup secure credential profiles and subsystem authorization rules.</p>
                  </div>
                  <button 
                    onClick={() => setModalOpen(false)}
                    className="p-1.5 hover:bg-slate-200/50 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* SECTION 1: Identity Matrix Selector */}
                  <div className="rounded-xl bg-white p-5 border border-slate-100 shadow-sm space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">01. Identity Matrix Selector</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Security Principal Mode</label>
                        <div className="flex p-1 bg-slate-100 rounded-lg gap-1">
                          <button
                            type="button"
                            onClick={() => setValue('access_type', 'employee')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${currentAccessType === 'employee' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Employee
                          </button>
                          <button
                            type="button"
                            onClick={() => setValue('access_type', 'superadmin')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${currentAccessType === 'superadmin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            SuperAdmin
                          </button>
                        </div>
                      </div>

                      {currentAccessType === 'employee' ? (
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1.5">Target Employee Reference</label>
                          <AsyncSearchSelect
                            fetchOptions={accessService.getEmployees}
                            value={watch('employee_id') || ''}
                            onChange={(val) => setValue('employee_id', val)}
                            placeholder="Query employee database index..."
                          />
                          {errors.employee_id && <p className="text-xs text-rose-500 mt-1">{errors.employee_id.message}</p>}
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1.5">Target SuperAdmin Reference</label>
                          <AsyncSearchSelect
                            fetchOptions={accessService.getSuperadmins}
                            value={watch('superadmin_id') || ''}
                            onChange={(val) => setValue('superadmin_id', val)}
                            placeholder="Select validation authority engine..."
                          />
                          {errors.superadmin_id && <p className="text-xs text-rose-500 mt-1">{errors.superadmin_id.message}</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: Service Layer Config */}
                  <div className="rounded-xl bg-white p-5 border border-slate-100 shadow-sm space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">02. Platform Routing Profiles</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Target Core Application Subsystem</label>
                        <AsyncSearchSelect
                          fetchOptions={accessService.getServices}
                          value={watch('service_code')}
                          onChange={(val) => setValue('service_code', val)}
                          placeholder="Select linked microservice..."
                        />
                        {errors.service_code && <p className="text-xs text-rose-500 mt-1">{errors.service_code.message}</p>}
                      </div>

                      {watch('service_code') && watch('service_code') !== 'sis' && (
                        <div>
                          <label className="text-xs font-medium text-slate-500 block mb-1.5">Access Role Assignment</label>
                          <div className="relative w-full">
                            <select
                              {...register('role')}
                              className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-theme-500 transition-colors cursor-pointer appearance-none text-slate-600"
                              defaultValue=""
                              disabled={loadingRoles}
                            >
                              <option value="" disabled hidden>
                                {loadingRoles ? 'Loading roles...' : 'Select assigned system role...'}
                              </option>
                              {dynamicRoles.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                              {loadingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4" />}
                            </div>
                          </div>
                          {errors.role && <p className="text-xs text-rose-500 mt-1">{errors.role.message}</p>}
                        </div>
                      )}

                      {watch('service_code') === 'sis' && (
                        <div className="p-4 border border-slate-100 bg-amber-50/50 rounded-lg text-xs text-amber-800 sm:col-span-2">
                          <strong>SIS Role Policy Note:</strong> SIS role is dynamically determined by the employee&apos;s current designation. Separate role configuration is not required.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 border border-slate-100 bg-slate-50/50 rounded-lg">
                      <div>
                        <label className="text-xs font-semibold block text-slate-700">Live Access Policy Status</label>
                        <span className="text-[11px] text-slate-400 block">Can user currently access this service?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setValue('is_active', !isActiveVal)}
                        className={`w-11 h-6 rounded-full transition-colors relative ${isActiveVal ? 'bg-theme-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isActiveVal ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* SECTION 3: Credentials & Handshakes — hidden for auth service (no password needed) */}
                  {watch('service_code') !== 'auth' && <div className="rounded-xl bg-white p-5 border border-slate-100 shadow-sm space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">03. Credentials & Handshakes</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Isolated Security Space Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            {...register('password')}
                            className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-transparent text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordVal.length > 0 && (
                          <div className="mt-2 flex gap-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            {[1, 2, 3].map((step) => (
                              <div
                                key={step}
                                className={`h-full flex-1 transition-all ${getPasswordStrength(passwordVal) >= step ? 'bg-theme-500' : 'bg-transparent'}`}
                              />
                            ))}
                          </div>
                        )}
                        {errors.password && <p className="text-xs text-rose-500 mt-1">{errors.password.message}</p>}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Confirm Security Password</label>
                        <input
                          type="password"
                          {...register('confirm_password')}
                          className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-transparent text-slate-900"
                        />
                        {errors.confirm_password && <p className="text-xs text-rose-500 mt-1">{errors.confirm_password.message}</p>}
                      </div>
                    </div>
                  </div>}

                  {/* SECTION 4: System Ledger Metadata */}
                  <div className="rounded-lg bg-white p-5 border border-slate-100 shadow-sm space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">04. Audit & Ledger Attributions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Execution Authority Timestamp</label>
                        <input
                          type="datetime-local"
                          {...register('granted_at')}
                          className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-transparent text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Signing Officer</label>
                        <input
                          type="text"
                          readOnly
                          value={currentAdmin.name}
                          className="w-full h-10 px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-md text-slate-400 cursor-not-allowed font-mono "
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1.5">Justification Log Summary</label>
                      <textarea
                        {...register('notes')}
                        placeholder="Admin notes about this access grant"
                        className="w-full min-h-20 p-3 text-sm border border-slate-200 bg-transparent rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-theme-500 focus:border-theme-500"
                      />
                      {errors.notes && <p className="text-xs text-rose-500 mt-1">{errors.notes.message}</p>}
                    </div>
                  </div>

                  {/* Form Controls */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldAlert className="h-4 w-4 text-amber-500" /> Applies immediately.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => reset()}
                        disabled={isSubmitting}
                        className="px-4 h-10 text-xs font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                      
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 h-10 text-xs font-semibold bg-theme-600 hover:bg-theme-700 text-white rounded-lg shadow-md shadow-theme-600/10 flex items-center gap-1.5 transition active:scale-95"
                      >
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Commit Access Profile
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}