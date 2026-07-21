'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { THEME } from '../../../lib/theme';
import { validateEmail } from '../../../lib/helpers';
import { API_ENDPOINTS } from '../../../lib/constants';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(
        `${API_ENDPOINTS.FORGOT_PASSWORD}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send reset link');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: THEME.colors.background }}
      >
        <div className="max-w-md w-full space-y-8 animate-scale-in">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 flex items-center justify-center mb-6 p-4 rounded-full animate-scale-in" style={{ backgroundColor: THEME.colors.light }}>
              <CheckCircle className="w-12 h-12" style={{ color: THEME.colors.success }} strokeWidth={2} />
            </div>
            <h1 
              className="text-3xl font-bold mb-4"
              style={{ 
                color: THEME.colors.primary,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              Check Your Email
            </h1>
            <p className="text-base mb-6" style={{ color: THEME.colors.gray }}>
              We've sent a password reset link to <strong style={{ color: THEME.colors.primary }}>{email}</strong>
            </p>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in"
      style={{ backgroundColor: THEME.colors.background }}
    >
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center animate-slide-in">
          <div className="mx-auto h-20 w-20 flex items-center justify-center mb-6 p-4 rounded-full" style={{ backgroundColor: THEME.colors.light }}>
            <Mail className="w-12 h-12" style={{ color: THEME.colors.primary }} strokeWidth={2} />
          </div>
          <h1 
            className="text-4xl font-bold uppercase tracking-wider mb-2"
            style={{ 
              color: THEME.colors.primary,
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            Forgot Password?
          </h1>
          <p className="text-base" style={{ color: THEME.colors.gray }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {/* Form Card */}
        <div 
          className="rounded-2xl p-8 shadow-xl animate-scale-in"
          style={{ 
            backgroundColor: THEME.colors.light,
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <Mail 
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5" 
                style={{ color: THEME.colors.gray }} 
              />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border rounded-lg focus:outline-none focus:ring-2 text-base transition-all"
                style={{ 
                  borderColor: '#D1D5DB',
                  backgroundColor: 'white',
                  color: '#111827',
                  borderWidth: '1px'
                }}
                required
              />
            </div>

            {error && (
              <div 
                className="text-center p-3 rounded-lg border"
                style={{ 
                  backgroundColor: THEME.colors.background, 
                  borderColor: THEME.colors.error, 
                  color: THEME.colors.error 
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={loading}
              size="lg"
            >
              Send Reset Link
            </Button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => router.push('/login')}
              className="flex items-center justify-center gap-2 text-base font-medium hover:opacity-80 transition-opacity"
              style={{ color: THEME.colors.primary }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

