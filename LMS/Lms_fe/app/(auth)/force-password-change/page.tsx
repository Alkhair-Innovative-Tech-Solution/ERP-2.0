'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, RefreshCw, CheckCircle2, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { getStoredUser, setStoredUser, clearAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Logo from '@/public/AIT_Logo_Day.png';

export default function ForcePasswordChangePage() {
  const [step, setStep] = useState(1); // 1: Send OTP, 2: Change Password
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else if (user) {
      setEmail(user.email || '');
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.sendVerificationOtp(email);
    } catch {
      // Silently ignore — backend returns generic message either way
    } finally {
      toast.success('If an account exists, a verification code has been sent.');
      setStep(2);
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Verification code must be 6 digits.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forcePasswordChange({
        email,
        otp,
        new_password: newPassword,
      });

      toast.success('Password changed successfully! Please login with your new password.');
      
      clearAuth();
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      toast.error('Failed to reset password. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden border border-slate-100 p-8 md:p-12">
        <div className="mb-8 flex justify-center">
          <Image
            src={Logo}
            alt="AIT LMS"
            height={50}
            width={160}
            className="w-auto h-12 object-contain"
            priority
          />
        </div>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-black text-slate-900 leading-tight tracking-tight mb-2">
            Security <span className="text-brand-teal">Requirement</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            For your security, you must change your initial password before accessing the portal.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-10 gap-2">
          <div className={cn(
            "h-1.5 w-12 rounded-full transition-all duration-500",
            step >= 1 ? "bg-brand-teal shadow-[0_0_10px_rgba(45,212,191,0.3)]" : "bg-slate-100"
          )} />
          <div className={cn(
            "h-1.5 w-12 rounded-full transition-all duration-500",
            step >= 2 ? "bg-brand-teal shadow-[0_0_10px_rgba(45,212,191,0.3)]" : "bg-slate-100"
          )} />
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="bg-brand-teal/5 border border-brand-teal/10 rounded-2xl p-5 flex gap-4 items-start mb-6">
              <div className="bg-brand-teal/10 p-2 rounded-xl text-brand-teal">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-brand-teal uppercase tracking-widest">Email Verification</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  We'll send a 6-digit verification code to <span className="font-bold text-slate-900">{email}</span>
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 border-b-4 border-black/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" />
                  Sending...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="w-4 h-4 text-brand-teal" />
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => { clearAuth(); router.push('/login'); }}
              className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors py-2"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">Verification Code</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-brand-teal/10 transition-colors">
                   <KeyRound className="text-slate-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-16 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all font-black text-slate-900 tracking-[0.5em] placeholder:text-slate-300 placeholder:font-medium placeholder:tracking-normal"
                  placeholder="000000"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">New Password</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-brand-teal/10 transition-colors">
                   <Lock className="text-slate-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-16 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-focus-within:bg-brand-teal/10 transition-colors">
                   <CheckCircle2 className="text-slate-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-16 pr-5 py-5 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 border-b-4 border-black/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-brand-teal" />
                  Change Password
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors py-2"
            >
              Resend Code
            </button>
          </form>
        )}

        <div className="mt-10 pt-8 border-t border-slate-50 flex flex-col items-center">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-1 rounded-full bg-brand-teal animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secured by AIT Identity</span>
           </div>
           <p className="text-[9px] text-slate-300 font-medium text-center max-w-[200px]">
             Your connection is encrypted with 256-bit institutional grade security.
           </p>
        </div>
      </div>
    </div>
  );
}
