'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, BookOpen, FileText, Users, Settings, LogOut,
  Menu, X, GraduationCap, Award, Calendar, Bell, ShieldCheck,
  ChevronRight, ChevronDown, ChevronLeft, Layers, Medal, Receipt,
  Zap, BarChart3, ArrowRightLeft, Building2, School, DollarSign,
  Shield, Activity,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserRole, getStoredUser, clearAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface SidebarProps { role: UserRole; user?: any; isCollapsed?: boolean; onToggle?: () => void; }

interface MenuItem {
  label: string;
  icon: any;
  path: string;
  roles: UserRole[];
  permissionKey?: string;
  badge?: number;
}

interface MenuGroup {
  label: string;
  icon: any;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Platform',
    icon: Shield,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/superadmin/dashboard', roles: ['ADMIN', 'SUPERADMIN'] },
      { label: 'Organizations', icon: Building2, path: '/superadmin/organizations', roles: ['ADMIN', 'SUPERADMIN'] },
      { label: 'Platform Stats', icon: Activity, path: '/superadmin/platform-stats', roles: ['ADMIN', 'SUPERADMIN'] },
    ]
  },
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/dashboard', roles: ['ADMIN', 'COORDINATOR', 'ACCOUNT_OFFICER'], permissionKey: 'view_admin_dashboard' },
      { label: 'Overview', icon: LayoutDashboard, path: '/dashboard', roles: ['STUDENT', 'TEACHER'] },
    ]
  },
  {
    label: 'Academic',
    icon: GraduationCap,
    items: [
      { label: 'Courses', icon: BookOpen, path: '/courses', roles: ['ADMIN'], permissionKey: 'manage_courses' },
      { label: 'Categories', icon: Layers, path: '/specializations', roles: ['ADMIN'], permissionKey: 'manage_courses' },
      { label: 'Classes', icon: GraduationCap, path: '/scheduled-classes', roles: ['ADMIN'], permissionKey: 'manage_classes' },
      { label: 'Enrollments', icon: FileText, path: '/enrollments', roles: ['ADMIN'], permissionKey: 'manage_enrollments' },
      { label: 'Skill Assessments', icon: FileText, path: '/tests', roles: ['ADMIN', 'COORDINATOR'] },
      { label: 'Test Analytics', icon: BarChart3, path: '/tests/analytics', roles: ['ADMIN', 'COORDINATOR'] },
      { label: 'Cert Generator', icon: Zap, path: '/certificate-generator', roles: ['ADMIN', 'COORDINATOR'], permissionKey: 'manage_certifications' },
      { label: 'Certificates', icon: Award, path: '/certifications', roles: ['ADMIN', 'COORDINATOR'], permissionKey: 'manage_certifications' },
      { label: 'Alumni Re-enrollment', icon: Users, path: '/alumni-reenrollment', roles: ['ADMIN', 'COORDINATOR'], permissionKey: 'manage_enrollments' },
      { label: 'My Courses', icon: BookOpen, path: '/my-courses', roles: ['STUDENT', 'TEACHER'], permissionKey: 'manage_courses' },
      { label: 'My Classes', icon: GraduationCap, path: '/my-classes', roles: ['TEACHER'], permissionKey: 'manage_classes' },
      { label: 'Assignments', icon: FileText, path: '/assignments', roles: ['STUDENT', 'TEACHER'], permissionKey: 'manage_assignments' },
      { label: 'Students', icon: Users, path: '/students', roles: ['TEACHER'], permissionKey: 'view_students' },
      { label: 'Certificates', icon: Award, path: '/certificates', roles: ['STUDENT'], permissionKey: 'manage_certifications' },
      { label: 'Alumni Hub', icon: Medal, path: '/alumni', roles: ['STUDENT'], permissionKey: 'manage_certifications' },
    ]
  },
  {
    label: 'Records',
    icon: ShieldCheck,
    items: [
      { label: 'Attendance', icon: Calendar, path: '/attendance', roles: ['STUDENT', 'TEACHER'], permissionKey: 'view_attendance' },
      { label: 'My Fees', icon: Receipt, path: '/fees', roles: ['STUDENT'], permissionKey: 'view_fees' },
      { label: 'Notifications', icon: Bell, path: '/notifications', roles: ['STUDENT', 'TEACHER'], permissionKey: 'manage_notifications' },
    ]
  },
  {
    label: 'Finance & Admissions',
    icon: Receipt,
    items: [
      { label: 'Fee Structures', icon: Layers, path: '/fee-structures', roles: ['ADMIN'], permissionKey: 'view_fee_structures' },
      { label: 'Fee Collection', icon: Receipt, path: '/fee-collection', roles: ['ADMIN', 'ACCOUNT_OFFICER', 'COORDINATOR'], permissionKey: 'manage_fee_records' },
      { label: 'Fee Analytics', icon: BarChart3, path: '/fee-analytics', roles: ['ADMIN', 'ACCOUNT_OFFICER', 'COORDINATOR'], permissionKey: 'view_fee_analytics' },
      { label: 'Deposit Register', icon: Receipt, path: '/deposits', roles: ['ADMIN', 'ACCOUNT_OFFICER'], permissionKey: 'view_deposits' },
      { label: 'Entrance Leads', icon: Users, path: '/leads', roles: ['ADMIN', 'ACCOUNT_OFFICER'], permissionKey: 'view_entrance_leads' },
      { label: 'Student Transfers', icon: ArrowRightLeft, path: '/transfers', roles: ['ADMIN', 'COORDINATOR'], permissionKey: 'manage_transfers' },
    ]
  },
  {
    label: 'Organization',
    icon: Building2,
    items: [
      { label: 'Organizations', icon: Building2, path: '/organizations', roles: ['ADMIN'], permissionKey: 'manage_users' },
      { label: 'Campuses', icon: School, path: '/campuses', roles: ['ADMIN'], permissionKey: 'manage_users' },
      { label: 'Branches', icon: Building2, path: '/branches', roles: ['ADMIN'], permissionKey: 'manage_users' },
    ]
  },
  {
    label: 'Management',
    icon: Users,
    items: [
      { label: 'Users', icon: Users, path: '/users', roles: ['ADMIN', 'COORDINATOR'], permissionKey: 'manage_users' },
      { label: 'Teacher Attendance', icon: ShieldCheck, path: '/teachers', roles: ['COORDINATOR'], permissionKey: 'view_attendance' },
      { label: 'Class Schedules', icon: Calendar, path: '/schedule', roles: ['COORDINATOR'], permissionKey: 'manage_classes' },
      { label: 'Sections', icon: Layers, path: '/coordinator/sections', roles: ['COORDINATOR'], permissionKey: 'manage_classes' },
    ]
  },
  {
    label: 'Finance',
    icon: Receipt,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/accounts_officer/dashboard', roles: ['ACCOUNT_OFFICER'] },
      { label: 'Fee Collection', icon: Receipt, path: '/accounts_officer/fees', roles: ['ACCOUNT_OFFICER'] },
      { label: 'Payment Verification', icon: DollarSign, path: '/accounts_officer/payments', roles: ['ACCOUNT_OFFICER'] },
      { label: 'Reports', icon: BarChart3, path: '/accounts_officer/reports', roles: ['ACCOUNT_OFFICER'] },
    ]
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Control Panel', icon: ShieldCheck, path: '/control-panel', roles: ['ADMIN'] },
      { label: 'Notifications', icon: Bell, path: '/notifications', roles: ['ADMIN', 'STUDENT', 'TEACHER'], permissionKey: 'manage_notifications' },
      { label: 'Settings', icon: Settings, path: '/settings', roles: ['ADMIN', 'COORDINATOR', 'STUDENT', 'TEACHER'] },
    ]
  }
];

export default function Sidebar({ role, user: propUser, isCollapsed: forcedCollapsed, onToggle }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(forcedCollapsed ?? false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Dashboard', 'Academic']);

  useEffect(() => {
    if (forcedCollapsed !== undefined) {
      setIsCollapsed(forcedCollapsed);
    }
  }, [forcedCollapsed]);
  const pathname = usePathname();
  const router = useRouter();
  const user = propUser || getStoredUser();

  useEffect(() => {
    const currentGroup = menuGroups.find(group => 
      group.items.some(item => `${getBasePath()}${item.path}` === pathname)
    );
    if (currentGroup && !expandedGroups.includes(currentGroup.label)) {
      setExpandedGroups(prev => [...prev, currentGroup.label]);
    }
  }, [pathname]);

  const toggleGroup = (label: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpandedGroups([label]);
      return;
    }
    setExpandedGroups(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const isItemVisible = (item: MenuItem) => {
    if (!item.roles.includes(role)) return false;

    const featureKey = item.permissionKey;
    if (!featureKey) return true;

    if (user?.role_permissions && role !== 'ADMIN') {
      if (user.role_permissions[featureKey] !== true) return false;
    }

    if (user?.features_access) {
      if (user.features_access[featureKey] === false) return false;
      if (user.features_access[featureKey] === true) return true;
    }

    return true;
  };

  const getBasePath = () => {
    return role === 'ADMIN' || role === 'ACCOUNT_OFFICER' ? '/admin' : `/${role.toLowerCase()}`;
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 rounded-xl bg-white shadow-lg text-gray-700 border border-gray-100"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen z-[100] bg-[#0f172a] transition-all duration-500 ease-in-out overflow-visible no-scrollbar',
          isCollapsed ? 'w-24' : 'w-72',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <button
          onClick={() => { if (onToggle) onToggle(); else setIsCollapsed(!isCollapsed); }}
          className="absolute -right-3 top-12 w-6 h-6 bg-brand-teal rounded-full flex items-center justify-center text-white border-2 border-[#0f172a] hover:scale-110 transition-transform z-50 shadow-lg"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="flex flex-col h-full p-6 pr-4">
          <div className={cn("flex items-center gap-4 mb-10 overflow-hidden", isCollapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg p-1.5 shrink-0 rotate-3 transition-transform duration-500 hover:rotate-6">
              <Image src="/AIT_Logo_Day.png" alt="AIT Logo" width={40} height={40} className="object-contain" />
            </div>
            <div className={cn(
              "overflow-hidden transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1) flex flex-col justify-center",
              isCollapsed ? "w-0 opacity-0" : "w-40 opacity-100"
            )}>
              <h1 className="text-xl font-black tracking-tighter text-brand-orange leading-none whitespace-nowrap">AIT LMS</h1>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1 whitespace-nowrap">
                {role === 'COORDINATOR' ? 'Coordinator' : role === 'ACCOUNT_OFFICER' ? 'Account Officer' : role === 'STUDENT' ? 'Learner' : role === 'TEACHER' ? 'Teacher' : 'Administrator'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-10">
            {menuGroups.map((group) => {
              const visibleItems = group.items.filter(isItemVisible);
              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups.includes(group.label);
              const hasActiveChild = visibleItems.some(item => pathname === `${getBasePath()}${item.path}`);

              return (
                <div key={group.label} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                      hasActiveChild ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <group.icon className={cn("w-5 h-5 shrink-0 transition-colors", hasActiveChild && "text-brand-teal")} />
                    <div className={cn(
                      "flex-1 flex items-center overflow-hidden transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1)",
                      isCollapsed ? "w-0 opacity-0" : "w-full opacity-100"
                    )}>
                      <span className="flex-1 text-sm font-bold tracking-tight text-left whitespace-nowrap">{group.label}</span>
                      {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                    </div>
                  </button>

                  <div className={cn(
                    "grid transition-all duration-500 ease-in-out overflow-hidden",
                    (!isCollapsed && isExpanded) ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
                  )}>
                    <div className="ml-9 space-y-1 border-l border-white/10 pl-4 min-h-0">
                      {visibleItems.map((item) => {
                        // Use absolute paths as-is, only prepend base path for relative paths
                        const itemPath = item.path.startsWith('/') ? item.path : `${getBasePath()}${item.path}`;
                        const isActive = pathname === itemPath;

                        return (
                          <button
                            key={item.path}
                            onClick={() => { router.push(itemPath); setIsOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 py-2 text-xs font-bold transition-all relative group",
                              isActive ? "text-brand-orange" : "text-white/40 hover:text-white"
                            )}
                          >
                            {isActive && (
                              <div className="absolute -left-[17px] w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(201,105,40,0.5)]" />
                            )}
                            <span className="flex-1">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                              <span className="min-w-[18px] h-[18px] bg-brand-orange text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                                {item.badge > 9 ? "9+" : item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="pt-6 border-t border-white/10 mt-auto">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-white/40 hover:text-rose-400 hover:bg-rose-500/5 transition-all duration-300 group",
                isCollapsed && "justify-center"
              )}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <div className={cn(
                "overflow-hidden transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1)",
                isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}>
                <span className="text-sm font-bold tracking-tight whitespace-nowrap">Sign Out</span>
              </div>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}


