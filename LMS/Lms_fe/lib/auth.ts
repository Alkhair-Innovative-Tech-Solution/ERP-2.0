export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'TA' | 'COORDINATOR' | 'ACCOUNT_OFFICER' | 'SUPERADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  student_id?: string;
  id_no?: string;
  profile_completed?: boolean;
  password_changed?: boolean;
  must_change_password?: boolean;
  features_access?: Record<string, boolean>;
  role_permissions?: Record<string, boolean>;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Idle timeout configuration (10 minutes)
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
let idleTimer: NodeJS.Timeout | null = null;
let lastActivityTime: number = Date.now();

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lms_token');
};

export const setStoredToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('lms_token', token);
    console.log('✅ Token saved to localStorage:', token.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ Failed to save token:', error);
  }
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('lms_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User): void => {
  if (typeof window === 'undefined') return;
  try {
    const userStr = JSON.stringify(user);
    localStorage.setItem('lms_user', userStr);
    console.log('✅ User saved to localStorage:', { id: user.id, username: user.username, role: user.role });
  } catch (error) {
    console.error('❌ Failed to save user:', error);
  }
};

export const clearAuth = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
  localStorage.removeItem('last_activity');
  stopIdleTimer();
};

export const getRoleDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'STUDENT':
      return '/student/dashboard';
    case 'TEACHER':
      return '/teacher/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'COORDINATOR':
      return '/coordinator/dashboard';
    case 'TA':
      return '/ta/dashboard';
    case 'ACCOUNT_OFFICER':
      return '/admin/receipt-codes';
    default:
      return '/login';
  }
};

export const isAuthenticated = (): boolean => {
  return !!getStoredToken();
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Update last activity time
export const updateActivity = (): void => {
  if (typeof window === 'undefined') return;
  lastActivityTime = Date.now();
  localStorage.setItem('last_activity', lastActivityTime.toString());
};

// Check if user has been idle for too long
export const checkIdleTimeout = (): boolean => {
  if (typeof window === 'undefined') return false;

  const storedActivity = localStorage.getItem('last_activity');
  const lastActivity = storedActivity ? parseInt(storedActivity) : Date.now();
  const idleTime = Date.now() - lastActivity;

  return idleTime >= IDLE_TIMEOUT;
};

// Start idle timer
export const startIdleTimer = (onTimeout: () => void): void => {
  if (typeof window === 'undefined') return;

  // Clear existing timer
  stopIdleTimer();

  // Set initial activity time
  updateActivity();

  // Check for idle timeout every minute
  idleTimer = setInterval(() => {
    if (checkIdleTimeout()) {
      console.log('⏰ User has been idle for 10 minutes. Logging out...');
      onTimeout();
    }
  }, 60 * 1000); // Check every minute

  // Track user activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach(event => {
    window.addEventListener(event, updateActivity, { passive: true });
  });
};

// Stop idle timer
export const stopIdleTimer = (): void => {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  // Remove activity listeners
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  activityEvents.forEach(event => {
    window.removeEventListener(event, updateActivity);
  });
};
