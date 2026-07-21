/**
 * Role-Based Access Control (RBAC) utilities
 * Centralized permission checking and role management
 */

import { ROLES } from './constants';
import { hasPermission, hasAnyPermission, hasAllPermissions, canPerformAction } from '../config/permissions';

export type UserRole = 'requestor' | 'moderator' | 'assignee' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  permissions?: string[];
}

/**
 * Check if user has a specific role
 */
export const hasRole = (user: User | null, role: UserRole | UserRole[]): boolean => {
  if (!user) return false;

  if (Array.isArray(role)) {
    return role.includes(user.role);
  }

  return user.role === role;
};

/**
 * Check if user is admin (highest privilege)
 */
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, ROLES.ADMIN);
};

/**
 * Check if user can access a route
 */
export const canAccessRoute = (user: User | null, requiredRole: UserRole | UserRole[]): boolean => {
  if (!user) return false;

  // Admin can access everything
  if (isAdmin(user)) return true;

  return hasRole(user, requiredRole);
};

/**
 * Get user's display role name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    requestor: 'Requestor',
    moderator: 'Moderator',
    assignee: 'Department Staff',
    admin: 'Administrator',
  };

  return roleNames[role] || role;
};

/**
 * Get role hierarchy level (higher = more privileges)
 */
export const getRoleLevel = (role: UserRole): number => {
  const levels: Record<UserRole, number> = {
    requestor: 1,
    assignee: 2,
    moderator: 3,
    admin: 4,
  };

  return levels[role] || 0;
};

/**
 * Check if user can perform action on ticket based on status
 */
export const canPerformTicketAction = (
  user: User | null,
  ticketStatus: string,
  action: string
): boolean => {
  if (!user) return false;

  return canPerformAction(user.role, ticketStatus, action as any);
};

/**
 * Filter items based on user role
 */
export const filterByRole = <T extends { role?: UserRole }>(
  items: T[],
  user: User | null
): T[] => {
  if (!user || isAdmin(user)) return items;

  return items.filter(item => !item.role || item.role === user.role);
};

/**
 * Get accessible routes for user role
 */
export const getAccessibleRoutes = (user: User | null): string[] => {
  if (!user) return ['/login'];

  const roleRoutes: Record<UserRole, string[]> = {
    requestor: [
      '/requestor/dashboard',
      '/requestor/requests',
      '/requestor/new-request',
      '/requestor/profile',
      '/requestor/notifications',
    ],
    moderator: [
      '/moderator/dashboard',
      '/moderator/review',
      '/moderator/create-subtickets',
      '/moderator/ticket-pool',
      '/moderator/profile',
      '/moderator/notifications',
    ],
    assignee: [
      '/assignee/dashboard',
      '/assignee/tasks',
      '/assignee/profile',
      '/assignee/notifications',
    ],
    admin: [
      '/admin/dashboard',
      '/admin/users',
      '/admin/requests',
      '/admin/analytics',
      '/admin/profile',
      '/admin/notifications',
    ],
  };

  return roleRoutes[user.role] || [];
};

