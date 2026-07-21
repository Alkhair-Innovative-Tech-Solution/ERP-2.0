import { fetchWithAuth } from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RbacPermission {
  codename: string;
  name: string;
  service: string;
  description: string;
}

export interface RbacRole {
  id: string;
  name: string;
  service: string;
  is_default: boolean;
  description: string;
  permission_count: number;
}

export interface RbacRoleDetail extends RbacRole {
  permission_codenames: string[];
}

export interface EmployeeRoleAssignment {
  id: string;
  employee_id: string;
  role_id: string;
  role_name: string;
  granted_at: string;
}

export interface PermissionOverride {
  id: string;
  employee_id: string;
  permission_codename: string;
  is_allowed: boolean;
}

// ── Permissions ────────────────────────────────────────────────────────────────

async function listPermissions(service?: string): Promise<{ permissions: RbacPermission[]; count: number }> {
  const url = `/permissions/rbac/permissions${service ? `?service=${service}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error('Failed to fetch permissions');
  return res.json();
}

// ── Roles ──────────────────────────────────────────────────────────────────────

async function listRoles(service?: string): Promise<{ roles: RbacRole[]; count: number }> {
  const url = `/permissions/rbac/roles${service ? `?service=${service}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error('Failed to fetch roles');
  return res.json();
}

async function getRole(roleId: string): Promise<RbacRoleDetail> {
  const res = await fetchWithAuth(`/permissions/rbac/roles/${roleId}`);
  if (!res.ok) throw new Error('Role not found');
  return res.json();
}

async function createRole(payload: {
  name: string;
  service: string;
  description: string;
  permission_codenames: string[];
}): Promise<RbacRole> {
  const res = await fetchWithAuth('/permissions/rbac/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to create role');
  }
  return res.json();
}

async function updateRole(
  roleId: string,
  payload: { name?: string; description?: string; permission_codenames?: string[] },
): Promise<RbacRole> {
  const res = await fetchWithAuth(`/permissions/rbac/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to update role');
  }
  return res.json();
}

async function deleteRole(roleId: string): Promise<void> {
  const res = await fetchWithAuth(`/permissions/rbac/roles/${roleId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete role');
}

// ── Employee Roles ─────────────────────────────────────────────────────────────

async function listEmployeeRoles(
  employeeId?: string,
): Promise<{ assignments: EmployeeRoleAssignment[]; count: number }> {
  const url = `/permissions/rbac/employee-roles${employeeId ? `?employee_id=${employeeId}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error('Failed to fetch employee roles');
  return res.json();
}

async function assignRole(employeeId: string, roleId: string): Promise<EmployeeRoleAssignment> {
  const res = await fetchWithAuth('/permissions/rbac/employee-roles', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId, role_id: roleId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to assign role');
  }
  return res.json();
}

async function removeRoleAssignment(assignmentId: string): Promise<void> {
  const res = await fetchWithAuth(`/permissions/rbac/employee-roles/${assignmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove role assignment');
}

// ── Overrides ──────────────────────────────────────────────────────────────────

async function createOverride(
  employeeId: string,
  permissionCodename: string,
  isAllowed: boolean,
  force = false,
): Promise<PermissionOverride> {
  const res = await fetchWithAuth('/permissions/rbac/overrides', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: employeeId,
      permission_codename: permissionCodename,
      is_allowed: isAllowed,
      force,
    }),
  });
  if (res.status === 409) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    const e = new Error(err.error || 'Conflict') as Error & { status: number };
    e.status = 409;
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to create override');
  }
  return res.json();
}

async function removeOverride(overrideId: string): Promise<void> {
  const res = await fetchWithAuth(`/permissions/rbac/overrides/${overrideId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove override');
}

async function getEffectivePermissions(
  employeeId: string,
): Promise<{ employee_id: string; permissions: string[] }> {
  const res = await fetchWithAuth(`/permissions/rbac/effective-permissions/${employeeId}`);
  if (!res.ok) throw new Error('Failed to fetch effective permissions');
  return res.json();
}

// ── Exported service object ────────────────────────────────────────────────────

export const rbacService = {
  listPermissions,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listEmployeeRoles,
  assignRole,
  removeRoleAssignment,
  createOverride,
  removeOverride,
  getEffectivePermissions,
};
