import { ROLES } from '../lib/constants';

export interface RouteConfig {
  path: string;
  label: string;
  roles: string[];
  icon?: string;
}

export const ROUTE_CONFIG: Record<string, RouteConfig[]> = {
  [ROLES.REQUESTOR]: [
    { path: '/requestor/dashboard', label: 'Dashboard', roles: [ROLES.REQUESTOR] },
    { path: '/requestor/requests', label: 'My Requests', roles: [ROLES.REQUESTOR] },
    { path: '/requestor/new-request', label: 'New Request', roles: [ROLES.REQUESTOR] },
    { path: '/requestor/profile', label: 'Profile', roles: [ROLES.REQUESTOR] },
    { path: '/requestor/notifications', label: 'Notifications', roles: [ROLES.REQUESTOR] },
  ],
  [ROLES.MODERATOR]: [
    { path: '/moderator/review', label: 'Review Tickets', roles: [ROLES.MODERATOR] },
    { path: '/moderator/ticket-pool', label: 'Ticket Pool', roles: [ROLES.MODERATOR] },
    { path: '/moderator/profile', label: 'Profile', roles: [ROLES.MODERATOR] },
  ],
  [ROLES.ASSIGNEE]: [
    { path: '/assignee/tasks', label: 'My Tasks', roles: [ROLES.ASSIGNEE] },
    { path: '/assignee/profile', label: 'Profile', roles: [ROLES.ASSIGNEE] },
  ],
  [ROLES.ADMIN]: [
    { path: '/admin/users', label: 'Users', roles: [ROLES.ADMIN] },
    { path: '/admin/analytics', label: 'Analytics', roles: [ROLES.ADMIN] },
  ],
};

export const getRoutesForRole = (role: string): RouteConfig[] => {
  return ROUTE_CONFIG[role] || [];
};

export const isRouteAccessible = (path: string, userRole: string): boolean => {
  const allRoutes = Object.values(ROUTE_CONFIG).flat();
  const route = allRoutes.find(r => r.path === path);
  return route ? route.roles.includes(userRole) : false;
};

export const getDefaultRoute = (role: string): string => {
  const routes = getRoutesForRole(role);
  return routes[0]?.path || '/login';
};

