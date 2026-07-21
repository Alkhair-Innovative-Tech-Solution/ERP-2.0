'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft } from 'lucide-react';
import { THEME } from '../lib/theme';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: THEME.colors.background }}>
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-9xl font-bold mb-4" style={{ color: THEME.colors.primary }}>
            404
          </h1>
          <h2 className="text-3xl font-bold mb-4" style={{ color: THEME.colors.primary }}>
            Page Not Found
          </h2>
          <p className="text-lg mb-8" style={{ color: THEME.colors.gray }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
            style={{ 
              backgroundColor: THEME.colors.medium,
              color: 'white'
            }}
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
            style={{ 
              backgroundColor: THEME.colors.primary,
              color: 'white'
            }}
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

