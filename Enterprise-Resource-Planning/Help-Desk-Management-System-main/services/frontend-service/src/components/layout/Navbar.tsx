'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { Bell, LogOut, Settings, User, ChevronDown } from 'lucide-react';
import { Logo } from '../ui/logo';
import { THEME } from '../../lib/theme';
import { useNotificationStore } from '../../store/notificationStore';

interface NavbarProps {
  role: string;
  isSidebarOpen?: boolean;
  onMobileToggle?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin:     'Administrator',
  moderator: 'Moderator',
  assignee:  'Assignee',
  requestor: 'Requestor',
};

export const Navbar: React.FC<NavbarProps> = ({ role, isSidebarOpen = true, onMobileToggle }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const unreadCount = useNotificationStore(s => s.unreadCount);

  const [userAvatar,      setUserAvatar]      = useState<string | null>(user?.avatar ?? null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Sync avatar from localStorage / custom event
  useEffect(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) { const d = JSON.parse(saved); if (d.avatar) setUserAvatar(d.avatar); }
    } catch { /* ignore */ }
    const handler = (e: Event) => setUserAvatar((e as CustomEvent).detail);
    window.addEventListener('avatarUpdated', handler);
    return () => window.removeEventListener('avatarUpdated', handler);
  }, []);

  useEffect(() => { setUserAvatar(user?.avatar ?? null); }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.navbar-profile')) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials    = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const displayName = user?.name ?? 'User';
  const userRole    = user?.role ?? role;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[65] h-16 flex items-center px-4
        transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${isSidebarOpen ? 'md:pl-[calc(288px+1.5rem)]' : 'md:pl-[calc(80px+1.5rem)]'}`}
      style={{
        backgroundColor: THEME.colors.white,
        borderBottom: `1px solid ${THEME.colors.light}30`,
        boxShadow: '0 1px 8px rgba(39,76,119,0.07)',
      }}
    >
      {/* Mobile: hamburger + logo */}
      <div className="flex items-center gap-3 md:hidden">
        <button
          onClick={onMobileToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: THEME.colors.primary }}
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Logo size="md" showText={false} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-1">

        {/* Notification Bell */}
        <button
          onClick={() => router.push(`/${userRole}/notifications`)}
          className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
          style={{ color: THEME.colors.primary }}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 rounded-full
                flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: THEME.colors.error }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 mx-2 rounded-full" style={{ backgroundColor: THEME.colors.light }} />

        {/* Profile button */}
        <div className="navbar-profile relative">
          <button
            onClick={() => setShowProfileMenu(p => !p)}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden flex-shrink-0 ring-2 ring-blue-100"
              style={{ backgroundColor: THEME.colors.primary }}
            >
              {userAvatar
                ? <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                : initials}
            </div>

            {/* Name + role */}
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-sm font-semibold truncate max-w-[100px]" style={{ color: THEME.colors.primary }}>
                {displayName.split(' ')[0]}
              </span>
              <span className="text-[11px]" style={{ color: THEME.colors.medium }}>
                {ROLE_LABELS[userRole] ?? userRole}
              </span>
            </div>

            <ChevronDown
              className={`hidden sm:block w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}
              style={{ color: THEME.colors.gray }}
            />
          </button>

          {/* Dropdown */}
          {showProfileMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border overflow-hidden z-50"
              style={{
                borderColor: `${THEME.colors.light}60`,
                boxShadow: '0 8px 32px rgba(39,76,119,0.12)',
              }}
            >
              {/* User info header */}
              <div
                className="px-4 py-4 flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${THEME.colors.primary}10, ${THEME.colors.medium}08)` }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0 ring-2 ring-blue-100"
                  style={{ backgroundColor: THEME.colors.primary }}
                >
                  {userAvatar
                    ? <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    : initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: THEME.colors.primary }}>{displayName}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: THEME.colors.medium }}>
                    {ROLE_LABELS[userRole] ?? userRole}
                  </p>
                  {user?.department && (
                    <p className="text-xs truncate mt-0.5" style={{ color: THEME.colors.gray }}>{user.department}</p>
                  )}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5 px-1.5 space-y-0.5">
                <button
                  onClick={() => { router.push(`/${userRole}/profile`); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl text-left hover:bg-gray-50 transition-colors"
                  style={{ color: THEME.colors.primary }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${THEME.colors.primary}12` }}>
                    <User className="w-3.5 h-3.5" style={{ color: THEME.colors.primary }} />
                  </div>
                  <span className="font-medium">My Profile</span>
                </button>

                <button
                  onClick={() => { router.push(`/${userRole}/notifications`); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl text-left hover:bg-gray-50 transition-colors"
                  style={{ color: THEME.colors.primary }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center relative" style={{ backgroundColor: `${THEME.colors.primary}12` }}>
                    <Bell className="w-3.5 h-3.5" style={{ color: THEME.colors.primary }} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white"
                        style={{ backgroundColor: THEME.colors.error }} />
                    )}
                  </div>
                  <span className="font-medium flex-1">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: THEME.colors.error }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { router.push(`/${userRole}/settings`); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl text-left hover:bg-gray-50 transition-colors"
                  style={{ color: THEME.colors.primary }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${THEME.colors.primary}12` }}>
                    <Settings className="w-3.5 h-3.5" style={{ color: THEME.colors.primary }} />
                  </div>
                  <span className="font-medium">Settings</span>
                </button>
              </div>

              {/* Logout */}
              <div className="px-1.5 pb-1.5 pt-0.5">
                <div className="h-px mb-1.5" style={{ backgroundColor: `${THEME.colors.light}60` }} />
                <button
                  onClick={() => { logout(); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl text-left hover:bg-red-50 transition-colors"
                  style={{ color: THEME.colors.error }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EF444412' }}>
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium">Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
