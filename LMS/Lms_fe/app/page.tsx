'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getStoredUser, getRoleDashboardPath } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getStoredUser();
      if (user) {
        const dashboardPath = getRoleDashboardPath((user.role as string).toUpperCase() as any);
        router.push(dashboardPath);
      } else {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <>
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>
    </>
  );
}
