'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    User,
    Mail,
    Award,
    Calendar,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReceiptCode {
    code: string;
    student_email: string;
    student_name: string;
    test_score: number;
    verified: boolean;
    lms_account_created: boolean;
    generated_at: string;
}

export default function AdminReceiptCodesPage() {
    const [receiptCodes, setReceiptCodes] = useState<ReceiptCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        student_email: '',
        student_name: '',
        test_score: ''
    });
    const router = useRouter();

    useEffect(() => {
        fetchReceiptCodes();
    }, []);

    const fetchReceiptCodes = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/admin/receipt-codes/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setReceiptCodes(data);
            } else {
                toast.error('Failed to load receipt codes');
            }
        } catch (error) {
            console.error('Error fetching receipt codes:', error);
            toast.error('Error loading receipt codes');
        } finally {
            setLoading(false);
        }
    };

    const handleAddReceiptCode = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.code || !formData.student_email || !formData.student_name || !formData.test_score) {
            toast.error('Please fill all fields');
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/admin/receipt-codes/add/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: formData.code,
                    student_email: formData.student_email,
                    student_name: formData.student_name,
                    test_score: parseInt(formData.test_score)
                })
            });

            if (response.ok) {
                toast.success('Receipt code added successfully!');
                setShowAddModal(false);
                setFormData({ code: '', student_email: '', student_name: '', test_score: '' });
                fetchReceiptCodes();
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to add receipt code');
            }
        } catch (error) {
            console.error('Error adding receipt code:', error);
            toast.error('Error adding receipt code');
        }
    };

    const filteredCodes = receiptCodes.filter(code =>
        code.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        code.student_email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Receipt Code Management</h1>
                    <p className="text-gray-600 mt-1">Manage security deposit receipt codes</p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-md transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Receipt Code
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by code, name, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Total Codes</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{receiptCodes.length}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Verified</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">
                                {receiptCodes.filter(c => c.verified).length}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Pending</p>
                            <p className="text-3xl font-bold text-orange-600 mt-1">
                                {receiptCodes.filter(c => !c.verified).length}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Codes Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Test Score</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">LMS Account</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Added</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p>No receipt codes found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredCodes.map((code) => (
                                    <tr key={code.code} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-blue-600">{code.code}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-900">{code.student_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-600">{code.student_email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Award className="w-4 h-4 text-yellow-500" />
                                                <span className="font-bold text-gray-900">{code.test_score}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {code.verified ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                                    <Clock className="w-3 h-3" />
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {code.lms_account_created ? (
                                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(code.generated_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Receipt Code Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Receipt Code</h2>

                        <form onSubmit={handleAddReceiptCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Receipt Code</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="RCP-2026-1234"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Student Name</label>
                                <input
                                    type="text"
                                    value={formData.student_name}
                                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Student Email</label>
                                <input
                                    type="email"
                                    value={formData.student_email}
                                    onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                                    placeholder="student@example.com"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Test Score</label>
                                <input
                                    type="number"
                                    value={formData.test_score}
                                    onChange={(e) => setFormData({ ...formData, test_score: e.target.value })}
                                    placeholder="85"
                                    min="0"
                                    max="100"
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
                                >
                                    Add Code
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
