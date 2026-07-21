'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    CheckCircle,
    XCircle,
    Loader2,
    Mail,
    Key,
    AlertCircle,
    ArrowRight,
    Shield,
    Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReceiptVerificationPage() {
    const [receiptCode, setReceiptCode] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [credentials, setCredentials] = useState<any>(null);
    const router = useRouter();

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!receiptCode || !email) {
            toast.error('Please enter both receipt code and email');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/students/verify-receipt-code/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    receipt_code: receiptCode,
                    email: email
                })
            });

            const data = await response.json();

            if (response.ok) {
                setVerified(true);
                setCredentials(data.lms_credentials);
                toast.success(data.message || 'Receipt verified successfully!');
            } else {
                toast.error(data.detail || 'Verification failed');
            }
        } catch (error) {
            console.error('Error verifying receipt:', error);
            toast.error('Error verifying receipt code');
        } finally {
            setLoading(false);
        }
    };

    if (verified && credentials) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full">
                    {/* Success Animation */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-6 animate-bounce">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            🎉 Verification Successful!
                        </h1>
                        <p className="text-lg text-gray-600">
                            Your LMS account has been created
                        </p>
                    </div>

                    {/* Credentials Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Your LMS Credentials</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                    <label className="text-sm font-bold text-blue-800">Permanent Student ID</label>
                                </div>
                                <p className="text-2xl font-black text-blue-900 ml-6 tracking-wider">
                                    {credentials.student_id || "Awaiting Assignment"}
                                </p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Mail className="w-4 h-4 text-gray-500" />
                                    <label className="text-sm font-bold text-gray-700">Username / Email</label>
                                </div>
                                <p className="text-lg font-mono font-bold text-gray-900 ml-6">
                                    {credentials.username}
                                </p>
                            </div>

                            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Key className="w-4 h-4 text-yellow-600" />
                                    <label className="text-sm font-bold text-yellow-800">Temporary Password</label>
                                </div>
                                <p className="text-lg font-mono font-bold text-yellow-900 ml-6 break-all">
                                    {credentials.temporary_password}
                                </p>
                                <div className="flex items-start gap-2 mt-3 ml-6">
                                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-yellow-700">
                                        Please save this password. You'll need to change it on first login.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-blue-900 mb-1">Next Steps</h3>
                                    <ul className="text-sm text-blue-700 space-y-1">
                                        <li>• Save your credentials in a secure location</li>
                                        <li>• Login to the LMS using the credentials above</li>
                                        <li>• Change your password on first login</li>
                                        <li>• Complete your profile setup</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`Username: ${credentials.username}\nPassword: ${credentials.temporary_password}`);
                                toast.success('Credentials copied to clipboard!');
                            }}
                            className="flex-1 px-6 py-4 rounded-lg border-2 border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Copy Credentials
                        </button>
                        <button
                            onClick={() => window.location.href = process.env.NEXT_PUBLIC_LMS_URL || 'http://localhost:3001'}
                            className="flex-1 px-6 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            Go to LMS
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                        <Shield className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Verify Receipt Code
                    </h1>
                    <p className="text-gray-600">
                        Enter your receipt code to create your LMS account
                    </p>
                </div>

                {/* Verification Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <form onSubmit={handleVerify} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Receipt Code
                            </label>
                            <input
                                type="text"
                                value={receiptCode}
                                onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
                                placeholder="RCP-2026-1234"
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                                required
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Enter the code from your security deposit receipt
                            </p>
                        </div>

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
                            <p className="text-xs text-gray-500 mt-2">
                                Use the same email from your entrance test
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-6 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    Verify & Create Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Info Box */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-700">
                                <p className="font-bold mb-1">Important:</p>
                                <ul className="space-y-1">
                                    <li>• Make sure you've paid the security deposit</li>
                                    <li>• The receipt code must be added by admin first</li>
                                    <li>• Use the email you used for the entrance test</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Help Link */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600">
                        Need help?{' '}
                        <a href="/contact" className="text-blue-600 font-bold hover:underline">
                            Contact Support
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
