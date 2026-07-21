'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/api'
import {
  LayoutDashboard, Receipt, BookOpen, Wallet,
  Settings, FileText, LogOut, Building2, ChevronRight,
  CheckSquare, TrendingUp, Bell, X, Menu
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['finance_head', 'accounts_head', 'branch_manager', 'data_entry_operator', 'program_officer', 'auditor'] },
  { href: '/expenses', label: 'Expenses', icon: Receipt, roles: ['finance_head', 'accounts_head', 'branch_manager', 'data_entry_operator'] },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, roles: ['finance_head', 'accounts_head', 'branch_manager'] },
  { href: '/cashbook', label: 'Cashbook', icon: BookOpen, roles: ['finance_head', 'accounts_head', 'branch_manager', 'data_entry_operator', 'program_officer', 'auditor'] },
  { href: '/replenishments', label: 'Replenishments', icon: Wallet, roles: ['finance_head', 'accounts_head', 'branch_manager'] },
  { href: '/reports', label: 'Reports', icon: FileText, roles: ['finance_head', 'accounts_head', 'auditor'] },
  { href: '/funds', label: 'Funds', icon: TrendingUp, roles: ['finance_head', 'accounts_head'] },
  { href: '/branches', label: 'Branches', icon: Building2, roles: ['finance_head', 'accounts_head'] },
  { href: '/audit-logs', label: 'Audit Trail', icon: FileText, roles: ['finance_head', 'accounts_head', 'auditor'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['finance_head', 'accounts_head'] },
]

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean; setMobileOpen?: (v: boolean) => void }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length
  const fetchingRef = useRef(false)

  const fetchNotifs = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await getNotifications()
      setNotifications((res.data.results || res.data).slice(0, 10))
    } catch { /* ignore */ }
    finally { fetchingRef.current = false }
  }

  useEffect(() => {
    if (user) fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    if (showNotif) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) {
      try { await markNotificationRead(n.id) } catch { /* ignore */ }
    }
    setShowNotif(false)
    fetchNotifs()
  }

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  )

  const branchName = user?.branch?.name
  const branchType = user?.branch?.type_display

  const closeMobile = () => { if (setMobileOpen) setMobileOpen(false) }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-navy-900/50 z-20 lg:hidden" onClick={closeMobile} />
      )}
      <aside className={`w-64 h-screen bg-navy-900 flex flex-col fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      <div className="px-5 py-5 border-b border-navy-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20 animate-pulse-glow">
            NG
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">NGO Expense</p>
            <p className="text-[10px] text-navy-400 font-medium tracking-wide uppercase">Management System</p>
          </div>
        </div>
      </div>

      {branchName && (
        <div className="px-4 py-3 border-b border-navy-800/50">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-navy-800 border border-navy-700/30">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Building2 size={12} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">{branchName}</p>
              <p className="text-[10px] text-navy-400 truncate leading-tight mt-0.5">{branchType}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                ${active
                  ? 'bg-gradient-to-r from-emerald-500/12 to-emerald-500/5 text-emerald-300 font-semibold'
                  : 'text-navy-300 hover:bg-navy-800/70 hover:text-white'
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-full shadow-sm shadow-emerald-400/50" />
              )}
              <Icon size={16} className={`shrink-0 transition-all duration-200 ${
                active ? 'text-emerald-400' : 'text-navy-400 group-hover:text-navy-200'
              }`} />
              <span className="truncate">{item.label}</span>
              {active && (
                <ChevronRight size={13} className="ml-auto text-emerald-500/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Notification Bell */}
      <div ref={notifRef} className="relative px-3 py-1">
        <button
          onClick={() => setShowNotif(!showNotif)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-navy-300 hover:bg-navy-800/70 hover:text-white w-full transition-all duration-200 relative"
        >
          <Bell size={16} className="shrink-0" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-navy-800 border border-navy-700 rounded-xl shadow-strong overflow-hidden animate-fade-in z-50">
            <div className="px-3 py-2.5 border-b border-navy-700 flex items-center justify-between">
              <p className="text-xs font-semibold text-white">Notifications</p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={async () => { try { await markAllNotificationsRead(); fetchNotifs() } catch {} }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotif(false)} className="text-navy-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-navy-400 text-xs">No notifications</div>
              ) : notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || '#'}
                  onClick={() => handleNotifClick(n)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 text-xs transition-colors ${
                    n.is_read ? 'text-navy-400' : 'text-white bg-navy-700/40'
                  } hover:bg-navy-700/60`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-emerald-400'}`} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{n.title}</p>
                    <p className="text-navy-500 truncate">{n.message}</p>
                    <p className="text-navy-600 text-[10px] mt-0.5">{n.time_ago}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-4 border-t border-navy-800/70 bg-navy-950/50">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 flex items-center justify-center text-emerald-300 text-xs font-bold ring-1 ring-emerald-500/20">
            {user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{user?.full_name}</p>
            <p className="text-[10px] text-navy-300 truncate leading-tight mt-0.5 font-medium">{user?.role_display}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-navy-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all duration-200 group"
        >
          <LogOut size={15} className="shrink-0 group-hover:scale-110 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen?.(!mobileOpen)}
        className="fixed top-4 left-4 z-40 lg:hidden w-10 h-10 rounded-xl bg-white border border-navy-200 shadow-soft flex items-center justify-center text-navy-600 hover:bg-navy-50 transition-all"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
    </>
  )
}
