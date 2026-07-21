'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { THEME } from '../lib/theme';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect authenticated users to their role-specific dashboard
        router.push(`/${user.role}/dashboard`);
      } else {
        // Redirect unauthenticated users to login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: THEME.colors.background }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
        <p style={{ color: THEME.colors.primary }}>Loading...</p>
      </div>
    </div>
  );
}

