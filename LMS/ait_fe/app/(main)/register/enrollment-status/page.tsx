'use client';

import { useState } from 'react';
import {
    Search,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Mail,
    Award,
    FileText,
    Shield,
    ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EnrollmentStatusPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<any>(null);

    const handleCheckStatus = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/auth/students/receipt-status/?email=${encodeURIComponent(email)}`
            );

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            } else {
                toast.error('Failed to fetch status');
            }
        } catch (error) {
            console.error('Error checking status:', error);
            toast.error('Error checking enrollment status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 py-12">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                        <Search className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Check Enrollment Status
                    </h1>
                    <p className="text-gray-600">
                        Enter your email to view your enrollment progress
                    </p>
                </div>

                {/* Search Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
                    <form onSubmit={handleCheckStatus} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@example.com"
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Checking...
                                </>
                            ) : (
                                <>
                                    Check Status
                                    <Search className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Status Display */}
                {status && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Enrollment Progress</h2>

                        <div className="space-y-4">
                            {/* Test Status */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.test_passed ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                        <Award className={`w-5 h-5 ${status.test_passed ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Entrance Test</p>
                                        {status.test_passed && (
                                            <p className="text-sm text-gray-600">Score: {status.test_score}</p>
                                        )}
                                    </div>
                                </div>
                                {status.test_passed ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-gray-400" />
                                )}
                            </div>

                            {/* Receipt Code Issued */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.receipt_code ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                        <FileText className={`w-5 h-5 ${status.receipt_code ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Receipt Code Issued</p>
                                        {status.receipt_code && (
                                            <p className="text-sm font-mono text-gray-600">{status.receipt_code}</p>
                                        )}
                                    </div>
                                </div>
                                {status.receipt_code ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-gray-400" />
                                )}
                            </div>

                            {/* Receipt in System */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.receipt_code_in_system ? 'bg-green-100' : 'bg-orange-100'
                                        }`}>
                                        <Clock className={`w-5 h-5 ${status.receipt_code_in_system ? 'text-green-600' : 'text-orange-600'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Receipt Added by Admin</p>
                                        <p className="text-sm text-gray-600">
                                            {status.receipt_code_in_system
                                                ? 'Receipt verified by admin'
                                                : 'Waiting for admin verification'}
                                        </p>
                                    </div>
                                </div>
                                {status.receipt_code_in_system ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <Clock className="w-6 h-6 text-orange-600" />
                                )}
                            </div>

                            {/* Receipt Verified */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.receipt_verified ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                        <Shield className={`w-5 h-5 ${status.receipt_verified ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">Receipt Verified</p>
                                        <p className="text-sm text-gray-600">
                                            {status.receipt_verified
                                                ? 'Your receipt has been verified'
                                                : 'Pending verification'}
                                        </p>
                                    </div>
                                </div>
                                {status.receipt_verified ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-gray-400" />
                                )}
                            </div>

                            {/* LMS Account */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.lms_account_ready ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                        <CheckCircle className={`w-5 h-5 ${status.lms_account_ready ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">LMS Account</p>
                                        <p className="text-sm text-gray-600">
                                            {status.lms_account_ready
                                                ? 'Account created successfully'
                                                : 'Not yet created'}
                                        </p>
                                    </div>
                                </div>
                                {status.lms_account_ready ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Next Steps */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-bold mb-1">Next Steps:</p>
                                    {!status.test_passed && <p>• Complete the entrance test</p>}
                                    {status.test_passed && !status.receipt_code_in_system && (
                                        <p>• Pay security deposit and wait for admin to add your receipt code</p>
                                    )}
                                    {status.receipt_code_in_system && !status.receipt_verified && (
                                        <p>• Verify your receipt code to create your LMS account</p>
                                    )}
                                    {status.lms_account_ready && (
                                        <p>• Check your email for LMS login credentials</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {status.receipt_code_in_system && !status.receipt_verified && (
                            <div className="mt-6">
                                <a
                                    href="/register/receipt-verification"
                                    className="w-full px-6 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                                >
                                    Verify Receipt Code
                                    <ArrowRight className="w-5 h-5" />
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
