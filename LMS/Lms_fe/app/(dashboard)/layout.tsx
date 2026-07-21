'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserRole } from '@/lib/auth';
import Sidebar from '@/components/shared/Sidebar';
import Header from '@/components/shared/Header';
import { cn } from '@/lib/utils';

// Path to Permission Key mapping
const PATH_PERMISSIONS: Record<string, string> = {
  '/scheduled-classes': 'manage_classes',
  '/users': 'manage_users',
  '/id-generator': 'id_generator',
  '/certificate-generator': 'manage_certifications',
  '/courses': 'manage_courses',
  '/specializations': 'manage_courses',
  '/categories': 'manage_courses',
  '/certifications': 'manage_certifications',
  '/enrollments': 'manage_enrollments',
  '/deposits': 'view_deposits',
  '/leads': 'view_entrance_leads',
  '/transfers': 'manage_transfers',
  '/notifications': 'manage_notifications',
  '/teachers': 'view_attendance',
  '/schedule': 'manage_classes',
  '/my-courses': 'manage_courses',
  '/assignments': 'manage_assignments',
  '/fees': 'view_fees',
  '/attendance': 'view_attendance',
  '/id-card': 'id_generator',
  '/certificates': 'manage_certifications',
  '/students': 'view_students',
  '/my-classes': 'manage_classes',
  '/control-panel': 'manage_users',
  '/organizations': 'manage_users',
  '/campuses': 'manage_users',
  '/branches': 'manage_users',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [user, setUser] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


  useEffect(() => {
    // Client-side only
    if (typeof window === 'undefined') return;

    const checkAuth = () => {
      console.log('🔍 Layout: Checking auth for path:', pathname);

      const token = localStorage.getItem('lms_token');
      const userStr = localStorage.getItem('lms_user');

      if (!token || !userStr) {
        if (pathname && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
          router.push('/login');
        }
        setIsAuthorized(false);
        return;
      }

      try {
        const currentUser = JSON.parse(userStr);
        
        // Forced Password Change Guard
        if (currentUser.must_change_password) {
          router.replace('/force-password-change');
          return;
        }

        const userRoleOriginal = currentUser.role;
        const userRole = (userRoleOriginal?.toUpperCase() || 'STUDENT') as UserRole;
        
        setUser(currentUser);
        setRole(userRole);

        // 1. Basic Path Role Check
        const pathRole = pathname?.split('/')[1];
        const userRoleLower = userRole.toLowerCase();

        // Account Officer can use /accounts_officer prefix for their portal
        // SuperAdmin can use /superadmin prefix for platform management
        // ADMIN can also access /superadmin (acts as SuperAdmin)
        // No redirect needed - they have their own portal pages

        if (userRole !== 'ADMIN') {
          // General role-path mismatch check
          if (pathRole === 'admin' && userRole !== 'COORDINATOR' && userRole !== 'ACCOUNT_OFFICER' && userRole !== 'SUPERADMIN') {
            router.replace(`/${userRoleLower}/dashboard`);
            return;
          }
          if (pathRole && pathRole !== 'admin' && pathRole !== 'accounts_officer' && pathRole !== 'superadmin' && pathRole !== userRoleLower && pathRole !== 'account_officer' && pathRole !== 'dashboard') {
            // ADMIN can access /superadmin (acts as SuperAdmin)
            if (userRole === 'ADMIN' && pathRole === 'superadmin') {
              // Allow access - ADMIN acts as SuperAdmin
            } else {
              const redirectPath = userRole === 'ACCOUNT_OFFICER' ? '/accounts_officer/dashboard' : userRole === 'SUPERADMIN' ? '/superadmin/dashboard' : `/${userRoleLower}/dashboard`;
              router.replace(redirectPath);
              return;
            }
          }

          // 2. Fine-grained Permission Check (Search Bar / Direct URL Guard)
          const matchingPath = Object.keys(PATH_PERMISSIONS).find(p => pathname.includes(p));
          if (matchingPath && currentUser.role_permissions) {
            const permissionKey = PATH_PERMISSIONS[matchingPath];
            const isAllowed = currentUser.role_permissions[permissionKey];
            
            // If permissions exist for this role, we enforce strict access
            if (isAllowed !== true && Object.keys(currentUser.role_permissions).length > 0) {
              console.warn(`🚫 Access denied for path ${pathname} (Key: ${permissionKey})`);
              const redirectPath = userRole === 'ACCOUNT_OFFICER' ? '/admin/receipt-codes' : `/${userRoleLower}/dashboard`;
              router.replace(redirectPath);
              return;
            }
          }
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('❌ Layout: Auth error:', error);
        setIsAuthorized(false);
      }
    };

    // Longor delay to ensure localStorage is ready after redirect
    const timeoutId = setTimeout(checkAuth, 500);
    return () => clearTimeout(timeoutId);
  }, [router, pathname]);

  // 🔹 Real-time Permission Sync (cached — max once per 5 min)
  // Fetch latest user data (with permissions) on mount to ensure dynamic access control
  useEffect(() => {
    if (!isAuthorized) return;

    const syncPermissions = async () => {
      try {
        const { getStoredUser, setStoredUser } = await import('@/lib/auth');
        const { userAPI } = await import('@/lib/api');
        
        const currentUser = getStoredUser();
        if (!currentUser?.id) return;

        // Skip if permissions were synced in the last 5 minutes
        const lastSync = localStorage.getItem('lms_permissions_sync_at');
        if (lastSync && Date.now() - parseInt(lastSync) < 5 * 60 * 1000) {
          return;
        }

        console.log('🔄 Syncing permissions for:', currentUser.full_name);
        const latestUser = await userAPI.get(currentUser.id);
        
        if (latestUser) {
          // Preserve tokens and other local data, but update permissions and core info
          const updatedUser = {
            ...currentUser,
            ...latestUser,
            // Ensure permissions are explicitly updated
            features_access: latestUser.features_access || {},
            role_permissions: latestUser.role_permissions || {},
          };
          
          setStoredUser(updatedUser);
          setUser(updatedUser); // 🔹 Trigger re-render
          localStorage.setItem('lms_permissions_sync_at', String(Date.now()));
          console.log('✅ Permissions synchronized successfully');
        }
      } catch (error) {
        console.error('❌ Failed to sync permissions:', error);
      }
    };

    syncPermissions();
  }, [isAuthorized]);


  // Idle timeout monitoring
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthorized) return;

    // Import idle timer functions
    const startIdleTimer = async () => {
      const { startIdleTimer: startTimer, clearAuth } = await import('@/lib/auth');

      startTimer(() => {
        // User has been idle for 10 minutes
        console.log('⏰ User idle timeout - logging out');
        clearAuth();
        router.push('/login?timeout=true');
      });
    };

    startIdleTimer();

    // Cleanup on unmount
    return () => {
      import('@/lib/auth').then(({ stopIdleTimer }) => {
        stopIdleTimer();
      });
    };
  }, [isAuthorized, router]);

  // Show loading while checking
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className={cn(
        "transition-all duration-500 ease-in-out",
        isSidebarCollapsed ? "lg:pl-24" : "lg:pl-72"
      )}>
        <Header />
        <main className="p-4 md:p-8 animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
