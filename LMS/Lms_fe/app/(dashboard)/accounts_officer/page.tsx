'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountsOfficerPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/accounts_officer/dashboard');
  }, [router]);

  return null;
}
