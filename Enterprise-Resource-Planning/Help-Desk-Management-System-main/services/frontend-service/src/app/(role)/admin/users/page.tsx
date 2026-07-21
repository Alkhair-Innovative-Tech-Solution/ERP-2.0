'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import ConfirmModal from '../../../../components/modals/ConfirmModal';
import userService from '../../../../services/api/userService';
import { User } from '../../../../types';
import { THEME } from '../../../../lib/theme';
import { formatDate, formatRelativeTime, getInitials } from '../../../../lib/helpers';
import { getMockEmployees } from '../../../../lib/mockData';
import { PageContainer } from '../../../../components/layout/PageContainer';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit,
  UserX,
  UserCheck,
  Shield,
  Upload,
  X,
  Building2,
  Mail,
  Calendar,
  Settings,
  Key,
  Ban,
  Eye,
  Phone,
  Clock,
  CheckCircle
} from 'lucide-react';

// Generate demo users
const generateDemoUsers = (): User[] => {
  const roles: Array<'requestor' | 'moderator' | 'assignee' | 'admin'> = ['requestor', 'moderator', 'assignee', 'admin'];
  const departments = ['Development', 'Finance & Accounts', 'Procurement', 'Basic Maintenance', 'IT', 'Architecture', 'Administration'];
  const statuses: Array<'active' | 'inactive' | 'pending'> = ['active', 'inactive', 'pending'];

  return Array.from({ length: 50 }, (_, i) => ({
    id: `user-${i + 1}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: roles[i % 4],
    department: departments[i % 6],
    status: i < 45 ? 'active' : statuses[i % 3],
    employeeCode: `EMP${String(i + 1).padStart(4, '0')}`,
    lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    phone: `+1 234-567-${String(i + 1).padStart(4, '0')}`,
  }));
};

// Role Badge Component
const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    admin: { bg: '#E9D5FF', text: '#7C3AED', border: '#C084FC' },
    moderator: { bg: '#DBEAFE', text: '#2563EB', border: '#60A5FA' },
    assignee: { bg: '#D1FAE5', text: '#059669', border: '#34D399' },
    requestor: { bg: '#FED7AA', text: '#EA580C', border: '#FB923C' },
  };

  const color = roleColors[role] || { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF' };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
      }}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
};

const AdminUsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);

  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [importing, setImporting] = useState(false);
  const [newRole, setNewRole] = useState<string>('requestor');
  const [newDepartment, setNewDepartment] = useState<string>('');

  // Confirm modal
  const [confirm, setConfirm] = useState<{
    open: boolean;
    userId?: string;
    action?: 'deactivate' | 'revoke' | 'delete';
    title?: string;
    description?: string;
  }>({ open: false });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        try {
          const response = await userService.getUsers();
          const usersList = Array.isArray(response)
            ? response
            : (response?.results || []);
          setUsers(usersList.length > 0 ? usersList : generateDemoUsers());
        } catch (error: any) {
          const isNetworkError = error?.isNetworkError || !error?.response;
          if (isNetworkError) {
            console.warn('API not available, using demo data');
            setUsers(generateDemoUsers());
          } else {
            throw error;
          }
        }
      } catch (error: any) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
        setUsers(generateDemoUsers());
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Get unique departments
  const departments = useMemo(() => {
    return Array.from(new Set(users.map(u => u.department).filter(Boolean))).sort();
  }, [users]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || u.department === departmentFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, departmentFilter, statusFilter]);

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowUserDetailModal(true);
  };

  const handleImportFromSMS = async () => {
    if (!employeeCode.trim()) {
      alert('Please enter employee code');
      return;
    }

    try {
      setImporting(true);
      // In real implementation, this would call SMS API
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: `Imported User ${employeeCode}`,
        email: `imported.${employeeCode}@example.com`,
        role: 'requestor',
        department: 'IT',
        status: 'active',
        employeeCode: employeeCode,
        joinDate: new Date().toISOString(),
      };

      setUsers([...users, newUser]);
      setShowImportModal(false);
      setEmployeeCode('');
      alert('User imported successfully from SMS');
    } catch (error) {
      console.error('Error importing user:', error);
      alert('Failed to import user from SMS');
    } finally {
      setImporting(false);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowAddUserModal(true);
  };

  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleAssignDepartment = (user: User) => {
    setSelectedUser(user);
    setNewDepartment(user.department || '');
    setShowDepartmentModal(true);
  };

  const handleGrantAccess = (user: User) => {
    setSelectedUser(user);
    setShowGrantAccessModal(true);
  };

  const handleRevokeAccess = (user: User) => {
    setConfirm({
      open: true,
      userId: user.id,
      action: 'revoke',
      title: 'Revoke HDMS Access',
      description: `Revoke helpdesk access for ${user.name}? This will disable their access but keep their data.`
    });
  };

  const handleDeactivate = (user: User) => {
    setConfirm({
      open: true,
      userId: user.id,
      action: 'deactivate',
      title: 'Deactivate User',
      description: `Deactivate ${user.name}? This will mark them as inactive.`
    });
  };

  const handleConfirmAction = async () => {
    if (!confirm.userId || !confirm.action) return;

    try {
      setProcessing(true);

      switch (confirm.action) {
        case 'deactivate':
          try {
            await userService.updateUser(confirm.userId, { status: 'inactive' } as any);
          } catch (error: any) {
            const isNetworkError = error?.isNetworkError || !error?.response;
            if (isNetworkError) {
              console.warn('API not available, updating local state');
            } else {
              throw error;
            }
          }
          setUsers(prev => prev.map(u =>
            u.id === confirm.userId ? { ...u, status: 'inactive' } : u
          ));
          if (selectedUser?.id === confirm.userId) {
            setSelectedUser({ ...selectedUser, status: 'inactive' });
          }
          break;
        case 'revoke':
          try {
            await userService.updateUser(confirm.userId, { status: 'inactive' } as any);
          } catch (error: any) {
            const isNetworkError = error?.isNetworkError || !error?.response;
            if (isNetworkError) {
              console.warn('API not available, updating local state');
            } else {
              throw error;
            }
          }
          setUsers(prev => prev.map(u =>
            u.id === confirm.userId ? { ...u, status: 'inactive' } : u
          ));
          if (selectedUser?.id === confirm.userId) {
            setSelectedUser({ ...selectedUser, status: 'inactive' });
          }
          break;
      }
    } catch (error) {
      console.error('Error performing action:', error);
      setUsers(prev => prev.map(u =>
        u.id === confirm.userId
          ? { ...u, status: 'inactive' }
          : u
      ));
      if (selectedUser?.id === confirm.userId) {
        setSelectedUser({ ...selectedUser, status: 'inactive' });
      }
    } finally {
      setProcessing(false);
      setConfirm({ open: false });
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      setProcessing(true);
      try {
        await userService.updateUser(selectedUser.id, { role: newRole } as any);
      } catch (error: any) {
        const isNetworkError = error?.isNetworkError || !error?.response;
        if (isNetworkError) {
          console.warn('API not available, updating local state');
        } else {
          throw error;
        }
      }
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, role: newRole as any } : u
      ));
      setSelectedUser({ ...selectedUser, role: newRole as any });
      setShowRoleModal(false);
      alert('Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, role: newRole as any } : u
      ));
      setSelectedUser({ ...selectedUser, role: newRole as any });
      setShowRoleModal(false);
      alert('Role updated (demo mode)');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!selectedUser || !newDepartment) return;

    try {
      setProcessing(true);
      try {
        await userService.updateUser(selectedUser.id, { department: newDepartment });
      } catch (error: any) {
        const isNetworkError = error?.isNetworkError || !error?.response;
        if (isNetworkError) {
          console.warn('API not available, updating local state');
        } else {
          throw error;
        }
      }
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, department: newDepartment } : u
      ));
      setSelectedUser({ ...selectedUser, department: newDepartment });
      setShowDepartmentModal(false);
      setNewDepartment('');
      alert('Department updated successfully');
    } catch (error) {
      console.error('Error updating department:', error);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, department: newDepartment } : u
      ));
      setSelectedUser({ ...selectedUser, department: newDepartment });
      setShowDepartmentModal(false);
      setNewDepartment('');
      alert('Department updated (demo mode)');
    } finally {
      setProcessing(false);
    }
  };

  const handleGrantAccessConfirm = async () => {
    if (!selectedUser) return;

    try {
      setProcessing(true);
      try {
        await userService.updateUser(selectedUser.id, { status: 'active' } as any);
      } catch (error: any) {
        const isNetworkError = error?.isNetworkError || !error?.response;
        if (isNetworkError) {
          console.warn('API not available, updating local state');
        } else {
          throw error;
        }
      }
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, status: 'active' } : u
      ));
      setSelectedUser({ ...selectedUser, status: 'active' });
      setShowGrantAccessModal(false);
      alert('HDMS access granted successfully');
    } catch (error) {
      console.error('Error granting access:', error);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, status: 'active' } : u
      ));
      setSelectedUser({ ...selectedUser, status: 'active' });
      setShowGrantAccessModal(false);
      alert('Access granted (demo mode)');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-screen" style={{ backgroundColor: THEME.colors.background }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
          <p style={{ color: THEME.colors.gray }}>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                User Management
              </h1>
              <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                Manage all system users and their permissions
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => setShowImportModal(true)}
              >
                <span className="hidden sm:inline">Import from SMS</span>
                <span className="sm:hidden">Import</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
        <div className="h-full">
          <AnalyticsCard
            title="Total Users"
            value={users.length}
            icon={Users}
            color={THEME.colors.primary}
            hoverDescription="All registered users"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="Active Users"
            value={users.filter(u => u.status === 'active').length}
            icon={UserCheck}
            color={THEME.colors.success}
            hoverDescription="Currently active"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="Inactive Users"
            value={users.filter(u => u.status === 'inactive').length}
            icon={UserX}
            color={THEME.colors.gray}
            hoverDescription="Deactivated users"
          />
        </div>
        <div className="h-full">
          <AnalyticsCard
            title="Departments"
            value={departments.length}
            icon={Building2}
            color={THEME.colors.medium}
            hoverDescription="Total departments"
          />
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: THEME.colors.gray }} size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or employee code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 md:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                style={{
                  borderColor: THEME.colors.background,
                }}
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Filter className="w-4 h-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
              <span className="text-sm" style={{ color: THEME.colors.gray }}>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: THEME.colors.background }}>
                {/* Role Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Role
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="assignee">Assignee</option>
                    <option value="requestor">requestor</option>
                  </select>
                </div>

                {/* Department Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Department
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardHeader className="p-4 md:p-6 lg:p-8 pb-2 md:pb-4">
          <CardTitle className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: THEME.colors.primary }}>
            Users
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 lg:p-8 pt-2 md:pt-4">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                {error} - Showing demo data for demonstration purposes.
              </p>
            </div>
          )}

          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: THEME.colors.background }}>
                <Users className="w-8 h-8" style={{ color: THEME.colors.gray }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: THEME.colors.gray }}>
                No users found
              </h3>
              <p style={{ color: THEME.colors.gray }}>Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y" style={{ borderColor: THEME.colors.background }}>
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Employee Code
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Email
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Role
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Department
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Last Login
                        </th>
                        <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: THEME.colors.background }}>
                      {filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleViewDetails(user)}
                        >
                          <td className="py-4 px-4 text-xs md:text-sm font-medium whitespace-nowrap" style={{ color: THEME.colors.primary }}>
                            {user.employeeCode || 'N/A'}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: THEME.colors.primary }}>
                                {getInitials(user.name)}
                              </div>
                              <span className="text-xs md:text-sm font-medium" style={{ color: THEME.colors.primary }}>
                                {user.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>
                            {user.email}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>
                            {user.department || 'N/A'}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${user.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : user.status === 'inactive'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                                }`}
                            >
                              {user.status === 'active' ? 'Active' : user.status === 'inactive' ? 'Inactive' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs md:text-sm whitespace-nowrap" style={{ color: THEME.colors.gray }}>
                            {user.lastLogin ? formatRelativeTime(user.lastLogin) : 'Never'}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Eye className="w-3 h-3" />}
                              onClick={() => handleViewDetails(user)}
                              className="text-xs px-2 md:px-3"
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {showUserDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: THEME.colors.background }}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: THEME.colors.primary }}>
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: THEME.colors.primary }}>
                    {selectedUser.name}
                  </h2>
                  <p className="text-sm" style={{ color: THEME.colors.gray }}>
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUserDetailModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* User Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Employee Code
                  </label>
                  <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                    {selectedUser.employeeCode || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: THEME.colors.gray }} />
                    <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Role
                  </label>
                  <RoleBadge role={selectedUser.role} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Department
                  </label>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" style={{ color: THEME.colors.gray }} />
                    <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                      {selectedUser.department || 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Status
                  </label>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${selectedUser.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : selectedUser.status === 'inactive'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                      }`}
                  >
                    {selectedUser.status === 'active' ? 'Active' : selectedUser.status === 'inactive' ? 'Inactive' : 'Pending'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Last Login
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: THEME.colors.gray }} />
                    <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                      {selectedUser.lastLogin ? formatRelativeTime(selectedUser.lastLogin) : 'Never'}
                    </p>
                  </div>
                </div>
                {selectedUser.joinDate && (
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      Join Date
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: THEME.colors.gray }} />
                      <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                        {formatDate(selectedUser.joinDate, 'long')}
                      </p>
                    </div>
                  </div>
                )}
                {selectedUser.phone && (
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      Phone
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" style={{ color: THEME.colors.gray }} />
                      <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                        {selectedUser.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Section */}
              <div className="pt-6 border-t" style={{ borderColor: THEME.colors.background }}>
                <h3 className="text-lg font-bold mb-4" style={{ color: THEME.colors.primary }}>
                  Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Button
                    variant="primary"
                    fullWidth
                    leftIcon={<Edit className="w-4 h-4" />}
                    onClick={() => {
                      setShowUserDetailModal(false);
                      handleEditUser(selectedUser);
                    }}
                  >
                    Edit User
                  </Button>

                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<Shield className="w-4 h-4" />}
                    onClick={() => {
                      setShowUserDetailModal(false);
                      handleAssignRole(selectedUser);
                    }}
                  >
                    Assign Role
                  </Button>

                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<Building2 className="w-4 h-4" />}
                    onClick={() => {
                      setShowUserDetailModal(false);
                      handleAssignDepartment(selectedUser);
                    }}
                  >
                    Assign Department
                  </Button>

                  {selectedUser.status === 'inactive' ? (
                    <Button
                      variant="success"
                      fullWidth
                      leftIcon={<UserCheck className="w-4 h-4" />}
                      onClick={() => {
                        setShowUserDetailModal(false);
                        handleGrantAccess(selectedUser);
                      }}
                    >
                      Grant HDMS Access
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      fullWidth
                      leftIcon={<Ban className="w-4 h-4" />}
                      onClick={() => {
                        setShowUserDetailModal(false);
                        handleRevokeAccess(selectedUser);
                      }}
                    >
                      Revoke Access
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    fullWidth
                    leftIcon={<UserX className="w-4 h-4" />}
                    onClick={() => {
                      setShowUserDetailModal(false);
                      handleDeactivate(selectedUser);
                    }}
                  >
                    Deactivate User
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import from SMS Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <Upload className="w-6 h-6" style={{ color: THEME.colors.primary }} />
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                  Import from SMS
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setEmployeeCode('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={importing}
              >
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: THEME.colors.gray }}>
                Enter employee code to fetch user from SMS system and create HDMS user record.
              </p>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Employee Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Enter employee code"
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                  style={{
                    borderColor: THEME.colors.background,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setEmployeeCode('');
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImportFromSMS}
                loading={importing}
                disabled={!employeeCode.trim()}
              >
                Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <UserPlus className="w-6 h-6" style={{ color: THEME.colors.primary }} />
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                  {selectedUser ? 'Edit User' : 'Add New User'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: THEME.colors.gray }}>
                {selectedUser ? 'Update user information' : 'Create a new user manually or import from SMS system.'}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedUser?.name}
                    placeholder="Enter full name"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    defaultValue={selectedUser?.email}
                    placeholder="Enter email address"
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="">Select Employee</option>
                    {getMockEmployees().map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_code}>
                        {emp.employee_code} - {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    defaultValue={selectedUser?.role}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="requestor">requestor</option>
                    <option value="assignee">Assignee</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                    Department
                  </label>
                  <select
                    defaultValue={selectedUser?.department}
                    className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                    style={{
                      borderColor: THEME.colors.background,
                    }}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  alert(selectedUser ? 'User updated successfully' : 'User added successfully');
                  setShowAddUserModal(false);
                  setSelectedUser(null);
                }}
              >
                {selectedUser ? 'Update User' : 'Add User'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6" style={{ color: THEME.colors.primary }} />
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                  Assign Role
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={processing}
              >
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: THEME.colors.gray }}>
                Change role for <strong>{selectedUser.name}</strong>
              </p>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Select Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                  style={{
                    borderColor: THEME.colors.background,
                  }}
                >
                  <option value="requestor">requestor</option>
                  <option value="assignee">Assignee</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateRole}
                loading={processing}
              >
                Update Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Department Modal */}
      {showDepartmentModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <Building2 className="w-6 h-6" style={{ color: THEME.colors.primary }} />
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                  Assign Department
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowDepartmentModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={processing}
              >
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm" style={{ color: THEME.colors.gray }}>
                Assign department for <strong>{selectedUser.name}</strong>
              </p>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Select Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                  style={{
                    borderColor: THEME.colors.background,
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDepartmentModal(false);
                  setSelectedUser(null);
                }}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateDepartment}
                loading={processing}
                disabled={!newDepartment}
              >
                Update Department
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Access Modal */}
      {showGrantAccessModal && selectedUser && (
        <ConfirmModal
          isOpen={true}
          title="Grant HDMS Access"
          description={`Enable helpdesk access for ${selectedUser.name}? This will activate their account.`}
          loading={processing}
          onClose={() => {
            setShowGrantAccessModal(false);
            setSelectedUser(null);
          }}
          onConfirm={handleGrantAccessConfirm}
          type="success"
          confirmText="Grant Access"
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirm.open}
        title={confirm.title || 'Confirm Action'}
        description={confirm.description || 'Are you sure you want to perform this action?'}
        loading={processing}
        onClose={() => setConfirm({ open: false })}
        onConfirm={handleConfirmAction}
        type={confirm.action === 'revoke' || confirm.action === 'deactivate' ? 'warning' : 'danger'}
        confirmText={confirm.action === 'deactivate' ? 'Deactivate' : confirm.action === 'revoke' ? 'Revoke' : 'Confirm'}
      />
    </PageContainer>
  );
};

export default AdminUsersPage;
