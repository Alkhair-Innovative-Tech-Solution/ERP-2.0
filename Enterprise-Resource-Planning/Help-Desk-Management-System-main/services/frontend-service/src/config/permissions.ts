import { ROLES, TICKET_STATUS } from '../lib/constants';

export type Permission =
  | 'ticket:create'
  | 'ticket:view'
  | 'ticket:edit'
  | 'ticket:delete'
  | 'ticket:assign'
  | 'ticket:reassign'
  | 'ticket:approve'
  | 'ticket:reject'
  | 'ticket:complete'
  | 'ticket:split'
  | 'user:view'
  | 'user:create'
  | 'user:edit'
  | 'user:delete'
  | 'analytics:view'
  | 'reports:view'
  | 'settings:manage';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.REQUESTOR]: [
    'ticket:create',
    'ticket:view',
    'ticket:edit',
  ],
  [ROLES.MODERATOR]: [
    'ticket:view',
    'ticket:assign',
    'ticket:reassign',
    'ticket:approve',
    'ticket:reject',
    'ticket:split',
    'analytics:view',
  ],
  [ROLES.ASSIGNEE]: [
    'ticket:view',
    'ticket:edit',
    'ticket:complete',
    'reports:view',
  ],
  [ROLES.ADMIN]: [
    'ticket:view',
    'ticket:edit',
    'ticket:delete',
    'ticket:assign',
    'ticket:reassign',
    'ticket:approve',
    'ticket:reject',
    'user:view',
    'user:create',
    'user:edit',
    'user:delete',
    'analytics:view',
    'reports:view',
    'settings:manage',
  ],
};

export const STATUS_PERMISSIONS: Record<string, Permission[]> = {
  [TICKET_STATUS.PENDING]: ['ticket:assign', 'ticket:approve', 'ticket:reject'],
  [TICKET_STATUS.ASSIGNED]: ['ticket:reassign', 'ticket:view'],
  [TICKET_STATUS.IN_PROGRESS]: ['ticket:complete', 'ticket:view', 'ticket:edit'],
  [TICKET_STATUS.COMPLETED]: ['ticket:approve', 'ticket:reject', 'ticket:view'],
  [TICKET_STATUS.REJECTED]: ['ticket:view'],
  [TICKET_STATUS.RESOLVED]: ['ticket:view'],
};

export const hasPermission = (userRole: string, permission: Permission): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

export const hasAnyPermission = (userRole: string, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission));
};

export const hasAllPermissions = (userRole: string, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(userRole, permission));
};

export const canPerformAction = (
  userRole: string,
  ticketStatus: string,
  action: Permission
): boolean => {
  const hasRolePermission = hasPermission(userRole, action);
  const statusAllowedActions = STATUS_PERMISSIONS[ticketStatus] || [];
  return hasRolePermission && statusAllowedActions.includes(action);
};

