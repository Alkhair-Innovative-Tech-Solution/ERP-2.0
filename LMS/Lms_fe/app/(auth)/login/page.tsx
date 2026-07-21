'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogIn, Lock, User, Eye, EyeOff, CheckSquare, RefreshCw } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { setStoredToken, setStoredUser, getRoleDashboardPath, UserRole } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Logo from '@/public/AIT_Logo_Day.png';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in - client-side only
    if (typeof window === 'undefined') return;

    // Check for timeout parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('timeout') === 'true') {
      toast.error('You were logged out due to inactivity. Please login again.', {
        duration: 5000,
      });
      // Clean URL
      window.history.replaceState({}, '', '/login');
    }

    const token = localStorage.getItem('lms_token');
    const userStr = localStorage.getItem('lms_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.role) {
          const dashboardPath = getRoleDashboardPath((user.role as string).toUpperCase() as UserRole);
          router.push(dashboardPath);
        }
      } catch {
        // Invalid data, clear it
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 Starting login for:', email);
      const response = await authAPI.login(email, password);
      const { token, user } = response;

      if (!token || !user) {
        throw new Error('Invalid response: missing token or user');
      }

      if (!user.role) {
        throw new Error('User data incomplete: missing role');
      }

      // Save token and user
      localStorage.setItem('lms_token', token);
      localStorage.setItem('lms_user', JSON.stringify(user));
      setStoredToken(token);
      setStoredUser(user);

      // If remember me is checked, we might want to set a longer expiration or handle it appropriately 
      // (though localStorage persists by default vs sessionStorage)

      toast.success(`Welcome back, ${user.full_name || user.first_name || user.username || 'Student'}!`);

      // Redirect based on role
      let dashboardPath = getRoleDashboardPath(user.role.toUpperCase() as UserRole);

      if (user.must_change_password) {
        dashboardPath = '/force-password-change';
      }

      // Artificial delay to ensure storage writes
      setTimeout(() => {
        window.location.href = dashboardPath;
      }, 500);

    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans antialiased">
      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col md:flex-row h-auto min-h-[650px] border border-slate-100">

        {/* ── Left Side: Authentication ── */}
        <div className="w-full md:w-1/2 p-10 md:p-20 flex flex-col justify-center bg-white">
          <div className="mb-12">
            <div className="mb-10 flex justify-center md:justify-start">
              <Image
                src={Logo}
                alt="AIT LMS"
                height={55}
                width={180}
                className="w-auto h-14 object-contain brightness-90"
                priority
              />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <h1 className="text-[2.75rem] font-black text-slate-900 leading-none tracking-tight">
                Welcome <span className="text-brand-teal">Back</span>
              </h1>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] py-2">
                Welcome back to AIT LMS
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7 w-full">
            <div className="space-y-2.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">Email or Student ID</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-brand-teal/10 transition-colors">
                   <User className="text-slate-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-16 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium"
                  placeholder="your@email.com or AIT26-XX-XXXX"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                <Link href="/forgot-password" title="Click to reset your password" className="text-[10px] font-black text-brand-teal hover:underline tracking-widest uppercase">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-brand-teal/10 transition-colors">
                  <Lock className="text-slate-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-16 pr-14 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                  rememberMe ? "bg-brand-teal border-brand-teal shadow-lg shadow-brand-teal/20" : "border-slate-200 bg-white group-hover:border-brand-teal/30"
                )}>
                  {rememberMe && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-700">Remember Me</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-6 border-b-4 border-black/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-brand-teal" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center md:text-left border-t border-slate-50 pt-8">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              New Member? <a href="https://ait.iak.ngo/register" target="_blank" rel="noopener noreferrer" className="text-brand-teal font-bold hover:underline ml-2">Create Account</a>
            </p>
          </div>
        </div>

        {/* ── Right Side: Visual Identity ── */}
        <div className="hidden md:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-20 text-white group">
          {/* Branded Background Elements */}
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-brand-teal/20 via-slate-900 to-slate-950 z-0" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-teal/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] bg-brand-teal/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 text-center max-w-sm space-y-10">
            <div className="relative mx-auto w-72 h-72 flex items-center justify-center">
              {/* Animated Rings */}
              <div className="absolute inset-0 border-2 border-white/5 rounded-[3rem] rotate-45 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-4 border-2 border-brand-teal/10 rounded-[2.5rem] -rotate-12 animate-[spin_15s_linear_infinite_reverse]" />
              
              <div className="relative w-52 h-52 bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-10 flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-700">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/20 to-transparent opacity-50" />
                <Image src={Logo} alt="AIT Logo" className="w-full h-full object-contain relative z-10 filter drop-shadow-2xl" />
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="text-[2.25rem] font-black leading-tight tracking-tight">
                Your <span className="text-brand-teal italic">Learning Journey</span>
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed uppercase tracking-wider">
                Access your courses, track your progress, and achieve your goals.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-teal shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
