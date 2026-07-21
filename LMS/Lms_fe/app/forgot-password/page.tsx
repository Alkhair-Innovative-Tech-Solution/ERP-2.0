'use client';

import { useState } from 'react';
import { Mail, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [mode, setMode] = useState<'link' | 'otp'>('link');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error('Please enter a valid email address.');
            return;
        }

        setLoading(true);

        if (mode === 'otp') {
            router.push(`/force-password-change?email=${encodeURIComponent(email)}`);
            return;
        }

        try {
            await authAPI.requestPasswordReset(email);
            setSubmitted(true);
            toast.success('If an account exists, a reset link has been sent.');
        } catch {
            setSubmitted(true);
            toast.success('If an account exists, a reset link has been sent.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
                    <p className="text-gray-600 mb-8">
                        We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and spam folder.
                    </p>
                    <Link
                        href="/login"
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-2"
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Forgot Password?</h2>
                    <p className="mt-2 text-gray-600">Choose how to reset your password.</p>
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                    <button
                        type="button"
                        onClick={() => setMode('link')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'link' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Mail className="w-4 h-4 inline mr-1.5" />
                        Email Link
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('otp')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${mode === 'otp' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <KeyRound className="w-4 h-4 inline mr-1.5" />
                        OTP Code
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="moodle-input pl-10"
                                placeholder="Enter your email"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                {mode === 'otp' ? 'Send OTP Code' : 'Send Reset Link'}
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </button>

                    <div className="text-center mt-4">
                        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary-600">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
