'use client';

import React, { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { THEME } from '../../lib/theme';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = React.memo(({ children }) => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Don't show layout on auth pages
  const isAuthPage = pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password');

  if (isAuthPage) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.colors.background,
          position: 'relative',
          zIndex: 1
        }}
      >
        {children}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: THEME.colors.background }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: THEME.colors.primary }}></div>
          <p style={{ color: THEME.colors.primary }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const role = user.role;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: THEME.colors.background }}>
      {/* Top Navbar */}
      <Navbar
        key="navbar"
        role={role}
        isSidebarOpen={isSidebarOpen}
        onMobileToggle={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 pt-16">
        {/* Left Sidebar - Fixed - Desktop Only */}
        <div key="desktop-sidebar-wrapper" className="hidden md:block fixed left-0 top-16 bottom-0 z-[60]">
          <Sidebar
            key="desktop-sidebar"
            role={role}
            currentPage={pathname || ''}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(prev => !prev)}
            isMobileOpen={isMobileSidebarOpen}
            onMobileToggle={() => setIsMobileSidebarOpen(prev => !prev)}
          />
        </div>

        {/* Content Area */}
        <main
          className={`flex-1 w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto ${isSidebarOpen ? 'md:ml-72 lg:ml-72' : 'md:ml-20'
            }`}
          style={{
            minHeight: 'calc(100vh - 4rem)',
            backgroundColor: THEME.colors.background,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
});

Layout.displayName = 'Layout';
