'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, LoginResult } from '../../../services/api/authService';
import { useAuthStore } from '../../../store/authStore';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../../../components/ui/logo';
import { THEME } from '../../../lib/theme';

const LoginPage: React.FC = () => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login: storeLogin, loading, setLoading } = useAuthStore();
  const router = useRouter();

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Force uppercase
    const val = e.target.value.toUpperCase();
    setEmployeeCode(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeCode.trim()) {
      setError('Please enter your employee code');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result: LoginResult = await authService.login({
        employeeCode: employeeCode.trim(),
        password,
      });

      if (result.success && result.user && result.accessToken) {
        const lowerRole = result.user.role.toLowerCase();

        // Store in localStorage and auth store
        localStorage.setItem('token', result.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken || '');
        localStorage.setItem('user', JSON.stringify(result.user));

        // Update auth store
        storeLogin({
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: lowerRole,
          department: result.user.department,
          employeeCode: result.user.employeeCode,
        } as any, result.accessToken);

        // Set cookies for Middleware
        document.cookie = `auth_token=${result.accessToken}; path=/; max-age=3600; SameSite=Strict`;
        document.cookie = `user_role=${lowerRole}; path=/; max-age=3600; SameSite=Strict`;

        // Redirect
        window.location.href = `/${lowerRole}/dashboard`;
      } else {
        const errorData = result.error;
        if (errorData) {
          setError(errorData.detail || 'Login failed. Please try again.');
        } else {
          setError('Login failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden min-h-[600px] flex flex-col lg:flex-row border-2 border-gray-200">

          {/* Left Side - Login Form */}
          <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-center relative">
            {/* Logo Section */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center">
                  <Logo size="lg" showText={false} />
                </div>
                <div className="text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#274c77]">Help Desk</h1>
                  <p className="text-sm text-[#6096ba]">Management System</p>
                </div>
              </div>
            </div>

            {/* Form Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2">
                Login
              </h2>
              <p className="text-[#6096ba] text-sm sm:text-base">
                Sign in to access your dashboard
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">

              {/* Employee Code Input */}
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-sm font-semibold text-[#274c77]">
                  Employee Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="login-email"
                    required
                    value={employeeCode}
                    onChange={handleIdChange}
                    className="w-full h-12 sm:h-14 border-2 border-[#a3cef1] rounded-xl pl-12 pr-4 text-[#274c77] text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#6096ba] shadow-sm transition-all duration-200 placeholder:text-[#6096ba]"
                    placeholder="C01-M-25-T-0000"
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6096ba] w-5 h-5" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-sm font-semibold text-[#274c77]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="login-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-12 sm:h-14 border-2 border-[#a3cef1] rounded-xl pl-12 pr-12 text-[#274c77] text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#6096ba] shadow-sm transition-all duration-200 placeholder:text-[#6096ba]"
                    placeholder="Enter your password"
                  />
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6096ba] w-5 h-5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#6096ba] hover:text-[#274c77] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="w-full h-12 sm:h-14 bg-[#a3cef1] hover:bg-[#87b9e3] text-black font-semibold rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                    Logging in...
                  </div>
                ) : (
                  "Login"
                )}
              </button>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex-shrink-0 mt-0.5"></div>
                  <div className="flex-1">
                    <p className="text-red-800 font-medium text-sm">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    aria-label="Dismiss error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Forgot Password Link */}
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-[#6096ba] hover:text-[#274c77] font-medium text-sm transition-colors"
                >
                  Forgot your password?
                </a>
              </div>

            </form>
          </div>

          {/* Right Side - Welcome Section */}
          <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#6096ba] to-[#a3cef1] relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full transform translate-x-48 -translate-y-48"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-white rounded-full transform -translate-x-40 translate-y-40"></div>
              <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full transform -translate-x-32 -translate-y-32"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-center items-center text-center p-8 lg:p-12">
              <div className="max-w-md">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl text-white font-bold mb-6 leading-tight">
                  WELCOME BACK
                </h2>
                <p className="text-white text-lg sm:text-xl leading-relaxed mb-8">
                  Access your HDMS portal to manage tickets, requests, and workflows all in one place.
                </p>

                {/* Features List */}
                <div className="space-y-4 text-left">
                  <div className="flex items-center text-white">
                    <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                    <span>Ticket Management</span>
                  </div>
                  <div className="flex items-center text-white">
                    <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                    <span>Workflow Tracking</span>
                  </div>
                  <div className="flex items-center text-white">
                    <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                    <span>Department Requests</span>
                  </div>
                  <div className="flex items-center text-white">
                    <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                    <span>Real-time Updates</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
