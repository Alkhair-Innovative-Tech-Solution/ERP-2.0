'use client';

import { ShieldX } from 'lucide-react';

interface AccessDeniedProps {
  permission?: string;
}

export default function AccessDenied({ permission }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="bg-rose-50 rounded-full p-6">
        <ShieldX className="h-12 w-12 text-rose-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-1 text-sm max-w-sm">
          {permission
            ? <>You need the <span className="font-mono bg-slate-100 px-1 rounded text-xs">{permission}</span> permission to view this page.</>
            : "You don't have permission to view this page."}
        </p>
        <p className="text-slate-400 text-xs mt-2">Contact your administrator to request access.</p>
      </div>
    </div>
  );
}
