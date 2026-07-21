'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { THEME } from '../lib/theme';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: THEME.colors.background }}>
          <div className="text-center max-w-md w-full">
            <div className="mb-8">
              <div className="flex justify-center mb-4">
                <AlertCircle className="w-16 h-16" style={{ color: THEME.colors.error }} />
              </div>
              <h2 className="text-3xl font-bold mb-4" style={{ color: THEME.colors.primary }}>
                Application Error
              </h2>
              <p className="text-lg mb-2" style={{ color: THEME.colors.gray }}>
                {error.message || 'A critical error occurred'}
              </p>
              {error.digest && (
                <p className="text-sm mb-4" style={{ color: THEME.colors.gray }}>
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg mx-auto"
              style={{ 
                backgroundColor: THEME.colors.primary,
                color: 'white'
              }}
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

