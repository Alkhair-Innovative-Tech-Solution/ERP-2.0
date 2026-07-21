'use client';

import React from 'react';
import { useEffect } from 'react';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { THEME } from '../../lib/theme';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Auth error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: THEME.colors.background }}>
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <AlertCircle className="w-16 h-16" style={{ color: THEME.colors.error }} />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ color: THEME.colors.primary }}>
            Authentication Error
          </h2>
          <p className="text-lg mb-2" style={{ color: THEME.colors.gray }}>
            {error.message || 'An error occurred during authentication'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="primary"
            leftIcon={<RefreshCw className="w-5 h-5" />}
            onClick={reset}
          >
            Try Again
          </Button>
          
          <Button
            variant="outline"
            leftIcon={<LogIn className="w-5 h-5" />}
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  );
}

