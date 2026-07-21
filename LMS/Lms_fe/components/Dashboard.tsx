'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  Bell,
  Award,
  LogOut,
  Menu,
  X,
  TrendingUp,
  UserPlus,
  Activity,
} from 'lucide-react';
import UserManagement from './UserManagement';
import CourseManagement from './CourseManagement';
import NotificationManagement from './NotificationManagement';
import CertificationManagement from './CertificationManagement';
import StatsCard from './StatsCard';
import { userAPI, courseAPI, notificationAPI, certificateAPI } from '@/lib/api';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    courses: 0,
    notifications: 0,
    certifications: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersList, coursesList, notificationsList, certificationsList] = await Promise.all([
        userAPI.getAll().catch(() => []),
        courseAPI.getAll().catch(() => []),
        notificationAPI.listBroadcasts().catch(() => []),
        certificateAPI.getAll().catch(() => []),
      ]);

      setStats({
        users: usersList.length,
        courses: coursesList.length,
        notifications: notificationsList.length,
        certifications: certificationsList.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'certifications', label: 'Certifications', icon: Award },
  ];

  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'
          } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className={`font-bold text-xl text-primary-600 ${!sidebarOpen && 'hidden'}`}>
            LMS Admin
          </h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${activeTab === item.id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-3 mb-4 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
              {user.username?.[0]?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900">{user.username || 'Admin'}</p>
                <p className="text-xs text-gray-500">{user.email || 'admin@example.com'}</p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard
                  title="Total Users"
                  value={stats.users}
                  icon={Users}
                  color="blue"
                  trend="+12%"
                />
                <StatsCard
                  title="Courses"
                  value={stats.courses}
                  icon={BookOpen}
                  color="green"
                  trend="+8%"
                />
                <StatsCard
                  title="Notifications"
                  value={stats.notifications}
                  icon={Bell}
                  color="yellow"
                  trend="+5%"
                />
                <StatsCard
                  title="Certifications"
                  value={stats.certifications}
                  icon={Award}
                  color="purple"
                  trend="+15%"
                />
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('users')}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-left"
                  >
                    <UserPlus className="w-6 h-6 text-primary-600 mb-2" />
                    <p className="font-semibold">Add New User</p>
                    <p className="text-sm text-gray-500">Create a new user account</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-left"
                  >
                    <BookOpen className="w-6 h-6 text-primary-600 mb-2" />
                    <p className="font-semibold">Create Course</p>
                    <p className="text-sm text-gray-500">Add a new course</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition text-left"
                  >
                    <Bell className="w-6 h-6 text-primary-600 mb-2" />
                    <p className="font-semibold">Send Notification</p>
                    <p className="text-sm text-gray-500">Notify all users</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'courses' && <CourseManagement />}
          {activeTab === 'notifications' && <NotificationManagement />}
          {activeTab === 'certifications' && <CertificationManagement />}
        </div>
      </main>
    </div>
  );
}
