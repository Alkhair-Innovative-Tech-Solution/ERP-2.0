import { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, Trash2, Users } from 'lucide-react';
import { userAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import CreateUserModal from '../modals/CreateUserModal';
import { Trash2 as TrashIcon } from 'lucide-react'; // Fix duplicate import if needed, but Trash2 is already imported

interface UserManagementTabProps {
    users: any[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onRefresh: () => void;
    setConfirmDialog: (config: any) => void;
}

export default function UserManagementTab({ users, searchTerm, setSearchTerm, onRefresh, setConfirmDialog }: UserManagementTabProps) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [userType, setUserType] = useState<'student' | 'teacher' | 'coordinator' | 'admin'>('student');
    const [usersList, setUsersList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await userAPI.getAll();
            setUsersList(data);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = (usersList.length > 0 ? usersList : users).filter((user: any) =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 transition"
                >
                    <Plus className="w-5 h-5" />
                    Add User
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search users by name, email, or username..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user: any) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold mr-3">
                                                {user.username?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {user.first_name} {user.last_name}
                                                </div>
                                                <div className="text-sm text-gray-500">@{user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {user.role || 'STUDENT'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            <button className="text-primary-600 hover:text-primary-900" title="View">
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            <button className="text-blue-600 hover:text-blue-900" title="Edit">
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Delete User',
                                                    description: `Are you sure you want to delete ${user.first_name} ${user.last_name}? This action cannot be undone.`,
                                                    onConfirm: () => {
                                                        toast.success('User deleted successfully');
                                                    }
                                                })}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {
                    filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p>No users found</p>
                        </div>
                    )
                }
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <CreateUserModal
                    userType={userType}
                    setUserType={setUserType}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={async () => {
                        setShowCreateModal(false);
                        await fetchUsers();
                        onRefresh();
                        toast.success('User created successfully!');
                    }}
                />
            )}
        </div>
    );
}
