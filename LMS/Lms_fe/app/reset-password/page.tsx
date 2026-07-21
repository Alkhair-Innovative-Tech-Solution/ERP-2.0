'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Key, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [token, setToken] = useState('');

    const [formData, setFormData] = useState({
        new_password: '',
        confirm_password: '',
    });

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            toast.error('Invalid or missing reset token');
        }
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error('Invalid reset link. Please request a new one.');
            return;
        }

        if (formData.new_password !== formData.confirm_password) {
            toast.error('Passwords do not match');
            return;
        }

        if (formData.new_password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await authAPI.confirmPasswordReset({
                token,
                new_password: formData.new_password
            });

            setSuccess(true);
            toast.success('Password reset successfully!');

            // Redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (error: any) {
            console.error('Password reset failed:', error);
            const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to reset password';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful</h2>
                <p className="text-gray-600 mb-8">
                    Your password has been successfully updated. You will be redirected to the login page shortly.
                </p>
                <Link
                    href="/login"
                    className="w-full inline-flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                    Go to Login Now
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
                <p className="mt-2 text-gray-600">Enter your new password below.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            name="new_password"
                            value={formData.new_password}
                            onChange={handleChange}
                            className="moodle-input pl-10"
                            placeholder="Enter new password (min 8 chars)"
                            required
                            minLength={8}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="password"
                            name="confirm_password"
                            value={formData.confirm_password}
                            onChange={handleChange}
                            className="moodle-input pl-10"
                            placeholder="Re-enter new password"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !token}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            Reset Password
                            <Save className="ml-2 h-5 w-5" />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={<div className="animate-pulse bg-white rounded-2xl w-full max-w-md h-64"></div>}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
