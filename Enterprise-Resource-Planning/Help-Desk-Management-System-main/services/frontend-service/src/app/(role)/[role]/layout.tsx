'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import RoleGuard from '../../../components/layout/RoleGuard';

export default function RoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Extract role from pathname
  const roleFromPath = pathname?.split('/')[1];
  const allowedRoles = ['requestor', 'moderator', 'assignee', 'admin'];

  // Handle navigation in useEffect to avoid setState during render
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check if user has access to this role section
    if (roleFromPath && allowedRoles.includes(roleFromPath.toLowerCase())) {
      const userRoleLower = user.role.toLowerCase();
      const pathRoleLower = roleFromPath.toLowerCase();

      if (userRoleLower !== pathRoleLower && userRoleLower !== 'admin') {
        router.push(`/${userRoleLower}/dashboard`);
        return;
      }
    }
  }, [user, loading, roleFromPath, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user has access to this role section
  if (roleFromPath && allowedRoles.includes(roleFromPath.toLowerCase())) {
    const userRoleLower = user.role.toLowerCase();
    const pathRoleLower = roleFromPath.toLowerCase();

    if (userRoleLower !== pathRoleLower && userRoleLower !== 'admin') {
      return null;
    }
  }

  return (
    <RoleGuard>
      <div className="">
        {children}
      </div>
    </RoleGuard>
  );
}

