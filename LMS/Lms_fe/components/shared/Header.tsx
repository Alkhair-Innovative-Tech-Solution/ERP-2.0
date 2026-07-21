'use client';

import { Bell, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearAuth } from '@/lib/auth';
import { notificationAPI } from '@/lib/api';
import OrgSelector from './OrgSelector';

interface Notif { id: string; title: string; message: string; delivered_at: string; is_read: boolean; }

const pathLabels: Record<string, string> = {
  '/dashboard': '', '/batches': '', '/scheduled-classes': '',
  '/interviews': '', '/users': '', '/courses': '',
  '/certifications': '', '/enrollments': '', '/receipt-codes': '',
  '/notifications': '', '/my-courses': '', '/assignments': '', '/assignments/create': '',
  '/attendance': '', '/certificates': '', '/settings': '',
  '/my-classes': '', '/students': '',
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return '';
  
  const segments = pathname.split('/').filter(Boolean);
  const isStudent = segments[0] === 'student';
  const lastSegment = segments[segments.length - 1];
  if (isStudent && segments.includes('assignments') && segments.length > 2) {
    return 'Submit Assignment';
  }
  const key = '/' + segments.slice(1).join('/');
  return pathLabels[key] || pathLabels['/' + lastSegment] || '';
}

export default function Header() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const user = getStoredUser();
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = getPageTitle(pathname);
  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || user?.username?.[0] || 'U')).toUpperCase();

  const role = (user?.role || '').toUpperCase();
  const rolePath = role.toLowerCase();
  const notificationsPath =
    role === 'ADMIN' || role === 'ACCOUNT_OFFICER' ? '/admin/notifications' : `/${rolePath}/notifications`;

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationAPI.listMy({ limit: 5 });
      setNotifications(data.map((d: any) => ({
        id: d.id,
        title: d.broadcast?.title || 'Notification',
        message: d.broadcast?.message || '',
        delivered_at: d.delivered_at,
        is_read: d.is_read,
      })));
    } catch { /* silent */ }
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-xl border-b border-slate-100/50 transition-all duration-300">
      <div className="flex items-center justify-between gap-8 px-10 h-[100px]">

        {/* Left: Page title */}
        {pageTitle && (
          <div className="hidden lg:flex items-center gap-3 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                 <span className="text-lg font-black text-slate-900 tracking-tight">{pageTitle}</span>
              </div>
            </div>
          </div>
        )}

        {/* Center: Org/Campus Selector */}
        <div className="hidden lg:flex items-center gap-4 flex-1 justify-center">
          <OrgSelector />
        </div>

        {/* Right: Notifications + User + Sign Out */}
        <div className="flex items-center gap-4">

          {/* Notification Bell */}
          <button
            onClick={() => router.push(notificationsPath)}
            aria-label="Notifications"
            className="relative p-2.5 rounded-xl transition-all duration-200 border border-transparent hover:bg-white hover:border-slate-100 hover:shadow-sm text-slate-500 hover:text-slate-900"
          >
            <Bell className="w-5.5 h-5.5" />
            {unread > 0 && (
              <span className="absolute top-2.5 right-2.5 min-w-[18px] h-[18px] bg-brand-orange text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg shadow-brand-orange/40">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <div className="h-10 w-px bg-slate-200/60 mx-1" />

          {/* User Profile */}
          <div className="flex items-center gap-4 pl-2 group cursor-pointer">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-sm font-black text-slate-900 leading-none group-hover:text-brand-teal transition-colors">
                {user?.first_name?.toUpperCase() || 'USER'}
              </p>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1.5">{user?.role}</p>
            </div>
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-teal to-teal-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-brand-teal/20 group-hover:scale-105 transition-all duration-300">
                {initials}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200/60 mx-1" />

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-brand-orange hover:border-brand-orange/20 hover:shadow-lg hover:shadow-brand-orange/5 transition-all duration-300 font-black text-xs group"
          >
            <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span className="hidden md:block">SIGN OUT</span>
          </button>

        </div>
      </div>
    </header>
  );
}

