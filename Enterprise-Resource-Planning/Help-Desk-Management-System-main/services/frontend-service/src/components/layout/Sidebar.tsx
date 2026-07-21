'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  FileText,
  UserPlus,
  Users,
  Settings,
  TrendingUp,
  Inbox,
  LogOut,
  Building,
  MapPin,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Logo } from '../ui/logo';

interface SidebarProps {
  role: string;
  currentPage: string;
  isOpen: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentPage,
  isOpen,
  onToggle,
  isMobileOpen,
  onMobileToggle
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  
  const getSidebarItems = (role: string) => {
    switch (role) {
      case 'requestor':
        return [
          { name: 'Dashboard', url: `/${role}/dashboard`, icon: Home },
          { name: 'My Requests', url: `/${role}/requests`, icon: FileText },
          { name: 'New Request', url: `/${role}/new-request`, icon: UserPlus },
          { name: 'Notifications', url: `/${role}/notifications`, icon: Inbox },
          { name: 'Profile', url: `/${role}/profile`, icon: Users }
        ];
      case 'moderator':
        return [
          { name: 'Dashboard', url: `/${role}/dashboard`, icon: Home },
          { name: 'Ticket Pool', url: `/${role}/ticket-pool`, icon: Inbox },
          { name: 'Review', url: `/${role}/review`, icon: FileText },
          { name: 'Notifications', url: `/${role}/notifications`, icon: Inbox },
          { name: 'Profile', url: `/${role}/profile`, icon: Users }
        ];
      case 'assignee':
        return [
          { name: 'Dashboard', url: `/${role}/dashboard`, icon: Home },
          { name: 'My Tasks', url: `/${role}/tasks`, icon: FileText },
          { name: 'Notifications', url: `/${role}/notifications`, icon: Inbox },
          { name: 'Profile', url: `/${role}/profile`, icon: Users }
        ];
      case 'admin':
        return [
          { name: 'Dashboard', url: `/${role}/dashboard`, icon: Home },
          { name: 'All Requests', url: `/${role}/requests`, icon: FileText },
          { name: 'Analytics', url: `/${role}/analytics`, icon: TrendingUp },
          { name: 'Users', url: `/${role}/users`, icon: Users },
          { name: 'Employees', url: `/${role}/employees`, icon: UserPlus },
          { name: 'Institutions', url: `/${role}/institutions`, icon: Building },
          { name: 'Branches', url: `/${role}/branches`, icon: MapPin },
          { name: 'Departments', url: `/${role}/departments`, icon: Building },
          { name: 'Notifications', url: `/${role}/notifications`, icon: Inbox },
          { name: 'Profile', url: `/${role}/profile`, icon: Users }
        ];
      default:
        return [];
    }
  };

  const sidebarItems = getSidebarItems(role);

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block fixed left-0 top-16 bottom-0 z-[60] h-[calc(100vh-4rem)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isOpen ? 'w-72 md:w-64 lg:w-72' : 'w-20'}
          ${isOpen ? 'bg-[#e7ecef]' : 'bg-[#a3cef1]'}
          rounded-r-3xl
          border-r-[3px] border-[#1c3f67]
          ${isOpen ? 'shadow-[0_8px_32px_0_rgba(173,208,231,0.74)]' : 'shadow-[0_2px_8px_0_rgba(163,206,241,0.91)]'}
          backdrop-blur-lg
          flex flex-col
        `}
        style={{
          transition: 'background-color 0.5s ease, width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Logo Section - Clickable */}
        <div className={`px-4 py-4 flex items-center justify-between ${isOpen ? '' : 'flex-col gap-4'}`}>
          {isOpen ? (
            <div className="flex items-center justify-between w-full">
              <Logo
                size="full"
                showText={true}
                showSubtitle={true}
              />
              <button
                onClick={onToggle}
                className="p-2 rounded-lg hover:bg-[#a3cef1] transition-colors text-[#274c77]"
                title="Collapse Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onToggle}
              className="p-3 rounded-xl hover:bg-[#6096ba] hover:text-white transition-all bg-[#e7ecef] text-[#274c77] shadow-md"
              title="Expand Sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Menu Items */}
        <nav className={`px-4 py-4 space-y-2 flex-1 overflow-y-auto hide-scrollbar ${isOpen ? '' : 'px-2'}`}>
          {sidebarItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.url || pathname?.startsWith(item.url + '/');

            return (
              <Link
                key={item.name}
                href={item.url}
                className={`
                  flex items-center ${isOpen ? 'justify-start px-4 py-3' : 'justify-center px-2 py-4'}
                  rounded-xl
                  font-semibold
                  transition-all duration-500
                  ${isActive
                    ? 'bg-[#6096ba] text-[#e7ecef] shadow-xl border-2 border-[#6096ba]'
                    : 'bg-transparent text-[#274c77] border-[1.5px] border-[#8b8c89] shadow-lg hover:bg-[#a3cef1]'
                  }
                  group
                `}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <Icon
                  className={`transition-all duration-200 ${isActive ? 'text-[#e7ecef]' : 'text-[#274c77] group-hover:text-[#274c77]'}`}
                  size={isOpen ? 20 : 24}
                />
                {isOpen && (
                  <span
                    className="ml-3 transition-all duration-500 whitespace-nowrap overflow-hidden"
                    style={{
                      opacity: isOpen ? 1 : 0,
                      maxWidth: isOpen ? '200px' : '0',
                    }}
                  >
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className={`px-4 pb-4 pt-2 ${isOpen ? '' : 'px-2'}`}>
          <button
            onClick={handleLogout}
            className={`
              w-full
              flex items-center ${isOpen ? 'justify-start px-4 py-3' : 'justify-center px-2 py-4'}
              rounded-xl
              font-semibold
              transition-all duration-500
              bg-transparent text-[#ef4444] border-[1.5px] border-[#ef4444] shadow-lg
              hover:bg-[#ef4444] hover:text-white hover:shadow-xl
              active:scale-95
            `}
          >
            <LogOut
              className={`transition-all duration-200 text-[#ef4444] ${isOpen ? '' : 'group-hover:text-white'}`}
              size={isOpen ? 20 : 24}
            />
            {isOpen && (
              <span
                className="ml-3 transition-all duration-500 whitespace-nowrap overflow-hidden"
                style={{
                  opacity: isOpen ? 1 : 0,
                  maxWidth: isOpen ? '200px' : '0',
                }}
              >
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-700"
          onClick={onMobileToggle}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        id="mobile-sidebar"
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-80 
          bg-[#e7ecef] rounded-r-3xl border-r-[3px] border-[#1c3f67]
          shadow-[0_8px_32px_0_rgba(173,208,231,0.74)] backdrop-blur-lg
          transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Mobile Header */}
        <div className="px-4 py-8 flex items-center justify-between">
          <Logo size="full" showText={true} showSubtitle={true} />
          <button
            onClick={onMobileToggle}
            className="p-2 rounded-lg hover:bg-[#a3cef1] transition-colors"
          >
            <X className="w-6 h-6 text-[#274c77]" />
          </button>
        </div>

        {/* Mobile Menu Items */}
        <nav className="px-4 py-4 space-y-2 flex-1 overflow-y-auto hide-scrollbar">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.url || pathname?.startsWith(item.url + '/');

            return (
              <Link
                key={item.name}
                href={item.url}
                className={`
                  flex items-center justify-start px-4 py-3
                  rounded-xl font-semibold
                  transition-all duration-500
                  ${isActive
                    ? 'bg-[#6096ba] text-[#e7ecef] shadow-xl border-2 border-[#6096ba]'
                    : 'bg-transparent text-[#274c77] border-[1.5px] border-[#8b8c89] shadow-lg hover:bg-[#a3cef1]'
                  }
                `}
                onClick={onMobileToggle}
              >
                <Icon size={20} />
                <span className="ml-3">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile Logout */}
        <div className="px-4 pb-4 pt-2 border-t border-[#8b8c89]/20">
          <button
            onClick={() => {
              handleLogout();
              onMobileToggle();
            }}
            className="
              w-full
              flex items-center justify-start px-4 py-3
              rounded-xl font-semibold
              transition-all duration-500
              bg-transparent text-[#ef4444] border-[1.5px] border-[#ef4444] shadow-lg
              hover:bg-[#ef4444] hover:text-white hover:shadow-xl
              active:scale-95
            "
          >
            <LogOut size={20} />
            <span className="ml-3">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};
