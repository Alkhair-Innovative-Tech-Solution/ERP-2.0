'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Key, Save, GraduationCap } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { getStoredUser, setStoredUser, getRoleDashboardPath, UserRole } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [formData, setFormData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: '',
    });

    useEffect(() => {
        // Check authentication
        const storedUser = getStoredUser();
        if (!storedUser) {
            router.push('/login');
            return;
        }

        setUser(storedUser);

        // If password already changed, redirect to dashboard
        if (storedUser.password_changed) {
            const dashboardPath = getRoleDashboardPath((storedUser.role as string).toUpperCase() as UserRole);
            router.push(dashboardPath);
        }
    }, [router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate passwords match
            if (formData.new_password !== formData.confirm_password) {
                toast.error('New passwords do not match');
                setLoading(false);
                return;
            }

            // Validate password strength
            if (formData.new_password.length < 8) {
                toast.error('Password must be at least 8 characters long');
                setLoading(false);
                return;
            }

            console.log('Changing password...');
            const response = await authAPI.changePassword(formData.old_password, formData.new_password);

            // Update local storage with new user data
            const updatedUser = response.user;
            updatedUser.password_changed = true;
            setStoredUser(updatedUser);

            toast.success('Password changed successfully!');

            // Redirect to dashboard
            const dashboardPath = getRoleDashboardPath((updatedUser.role as string).toUpperCase() as UserRole);
            setTimeout(() => {
                window.location.href = dashboardPath;
            }, 500);

        } catch (error: any) {
            console.error('Password change failed:', error);
            const msg = error.response?.data?.error || error.response?.data?.detail || 'Failed to change password';

            if (typeof msg === 'object') {
                const firstError = Object.values(msg)[0];
                toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError));
            } else {
                toast.error(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg mb-4">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Change Your Password</h1>
                    <p className="text-lg text-gray-600">For security, please change your default password</p>
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl shadow-sm">
                        <p className="text-sm text-blue-900 font-medium">
                            <strong className="text-primary-600">Default Password:</strong> Ait@1234
                        </p>
                    </div>
                </div>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="password"
                                    name="old_password"
                                    value={formData.old_password}
                                    onChange={handleChange}
                                    className="moodle-input pl-10"
                                    placeholder="Enter current password (Ait@1234)"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="password"
                                    name="new_password"
                                    value={formData.new_password}
                                    onChange={handleChange}
                                    className="moodle-input pl-10"
                                    placeholder="Enter new password (min 8 characters)"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <p className="mt-1 text-sm text-gray-500">Must be at least 8 characters long</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full moodle-button py-3 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Changing Password...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Change Password & Continue
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
