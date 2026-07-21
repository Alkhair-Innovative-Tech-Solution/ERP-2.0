'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClassesCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/teacher/my-classes/create');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Redirecting…</p>
      </div>
    </div>
  );
}
