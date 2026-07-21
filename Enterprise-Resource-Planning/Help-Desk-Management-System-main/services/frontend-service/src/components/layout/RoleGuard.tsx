'use client';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useAuth } from '../../lib/auth';

const PUBLIC_ROUTES = ['/login'];

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (PUBLIC_ROUTES.includes(pathname)) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const role = user.role;
    // If path contains another role, redirect to correct dashboard
    const parts = pathname.split('/').filter(Boolean);
    const roleInPath = parts[0];
    const validRoles = ['requestor', 'moderator', 'assignee', 'admin'];
    if (validRoles.includes(roleInPath) && roleInPath !== role) {
      router.replace(`/${role}/dashboard`);
    }
  }, [pathname, router, user]);

  return <>{children}</>;
}