
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Users, Building2, LogOut, ArrowRightLeft, LayoutDashboard, FileText,
  Settings, BookOpen, ClipboardList, CheckSquare, Fingerprint,
  CalendarDays, ChevronRight, ChevronDown, Headset, Banknote,
  AlertTriangle, Activity, Globe, GraduationCap, TrendingUp, Award,
  Calendar, UserPlus, Plus, Clock, BarChart3, Briefcase, ScrollText
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { getSidebarBadges } from "@/lib/api"
import { usePermissions, getCurrentUserRole } from "@/lib/permissions"
import { getSortedNavigation, type SortedNavItem } from "@/config/navigation"
import { useOrgFeatures } from "@/hooks/useOrgFeatures"
import { FEATURES } from "@/config/features"

// ── Category map: auto-generated from FEATURES + always-on items ────────────
const FEATURE_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  FEATURES.flatMap(f => f.navItems.map(navKey => [navKey, f.label]))
)

const CATEGORY_MAP: Record<string, string> = {
  // Always-on
  dashboard: "Dashboard",
  student_dashboard: "Dashboard",
  // Platform (superadmin / admin)
  organizations: "Platform",
  subscription_plans: "Platform",
  system_admins: "Platform",
  system_monitoring: "Platform",
  billing: "Platform",
  // Student portal
  student_profile: "Student",
  student_subjects: "Student",
  student_assignments_nav: "Student",
  student_attendance: "Student",
  student_results: "Student",
  student_fees: "Student",
  // Auditor portal
  auditor_dashboard: "Dashboard",
  auditor_attendance: "Audit",
  auditor_results: "Audit",
  auditor_fees: "Audit",
  auditor_students: "Records",
  auditor_staff: "Records",
  auditor_transfers: "Records",
  auditor_issues: "Actions",
  auditor_reports: "Actions",
  auditor_logs: "Activity",
  auditor_notifications: "Activity",
  auditor_profile: "Settings",
  // Accounts officer
  accounts_officer_profile: "Settings",
  // Audit log page
  audit_log: "Config",
  // Permissions in main nav as flat link
  permissions: "Config",
  // Feature-based (from features.ts — auto-generated)
  ...FEATURE_CATEGORY_MAP,
  // Overrides — must come after spread to take precedence
  shift_timings: "Academic Structure",
}

const CATEGORY_ICONS: Record<string, any> = {
  Dashboard: LayoutDashboard,
  Platform: Globe,
  Student: Users,
  // Feature categories — icons match features.ts FEATURE_ICONS
  "Staff Management": Users,
  "Academic Structure": Building2,
  "Fees Management": Banknote,
  "Result Management": FileText,
  "Student Attendance": CheckSquare,
  "Staff Attendance": Fingerprint,
  "Timetable / Subjects": CalendarDays,
  "Transfer Management": ArrowRightLeft,
  "Support Desk": Headset,
  // Auditor
  "Audit": ClipboardList,
  "Records": Users,
  "Actions": AlertTriangle,
  "Activity": Activity,
  // Fallback
  Settings: Settings,
  Config: Settings,
}

// Order: Dashboard → Platform → feature groups → Config → portals → Settings
const CATEGORY_ORDER = [
  "Dashboard",
  "Platform",
  ...FEATURES.map(f => f.label),
  "Config",
  "Student",
  "Audit",
  "Records",
  "Actions",
  "Activity",
  "Settings",
]

interface AdminSidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export function AdminSidebar({ sidebarOpen, setSidebarOpen }: AdminSidebarProps) {
  const [showText, setShowText] = useState(sidebarOpen)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  // Per-category pending counts (e.g. { "Result Management": 3 }) for sidebar badges.
  const [badges, setBadges] = useState<Record<string, number>>({})
  const OPEN_MS = 400
  const CLOSE_MS = 600

  // ── Responsive ──────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 640
      const tablet = window.innerWidth <= 1024
      setIsMobile(mobile)
      setIsTablet(tablet)
      if (mobile) setSidebarOpen(false)
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [setSidebarOpen])

  // delay showing text so it only appears after the sidebar has expanded
  useEffect(() => {
    let t: NodeJS.Timeout
    if (sidebarOpen) {
      t = setTimeout(() => setShowText(true), 220)
    } else {
      setShowText(false)
    }
    return () => clearTimeout(t)
  }, [sidebarOpen])

  // Keep overlay alive during close animation
  useEffect(() => {
    const small = isMobile || isTablet
    if (!small) { setOverlayVisible(false); return }
    if (sidebarOpen) { setOverlayVisible(true); return }
    const t = setTimeout(() => setOverlayVisible(false), CLOSE_MS)
    return () => clearTimeout(t)
  }, [sidebarOpen, isMobile, isTablet])

  // Auto-close on route change (mobile/tablet)
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const prevPath = useRef<string | null>(null)
  useEffect(() => { setMounted(true) }, [])

  // Poll per-category pending counts for sidebar badges (on mount, on navigation,
  // and every 60s). Failures are silent — badges just don't show.
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        // Phase D-blockers-clear: getSidebarBadges() is central-auth-aware
        // (see lib/api.ts) — returns {} immediately under central rather
        // than calling the auth-8001-only endpoint this used to hit directly.
        const data = await getSidebarBadges()
        if (active && data && typeof data === "object") setBadges(data)
      } catch {
        /* ignore — no badges */
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => { active = false; clearInterval(id) }
  }, [pathname])
  useEffect(() => {
    if (prevPath.current && prevPath.current !== pathname && (isMobile || isTablet)) {
      setSidebarOpen(false)
    }
    prevPath.current = pathname
  }, [pathname, isMobile, isTablet, setSidebarOpen])

  // ── Permissions / Role ───────────────────────────────────────
  const permissions = usePermissions()
  const actualRole = getCurrentUserRole()
  const { getAllowedNavItems } = useOrgFeatures()

  // ── Menu items ───────────────────────────────────────────────
  const allMenuItems = getSortedNavigation(permissions, actualRole)
  // Feature filtering — superadmin/admin see everything regardless
  const allowedNavItems = getAllowedNavItems()
  const rawMenuItems = (actualRole === "superadmin" || actualRole === "admin")
    ? allMenuItems
    : allMenuItems.filter(item => allowedNavItems.size === 0 || allowedNavItems.has(item.key))

  const groupedItems = rawMenuItems.reduce((acc, item) => {
    const cat = CATEGORY_MAP[item.key] || "Settings"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, SortedNavItem[]>)

  useEffect(() => {
    if (mounted) {
      const activeCat = Object.entries(groupedItems).find(([_, items]) =>
        items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
      )
      if (activeCat && !openCategories[activeCat[0]]) {
        setOpenCategories({ [activeCat[0]]: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pathname])

  const toggleCategory = (cat: string) => {
    if (!sidebarOpen) setSidebarOpen(true)
    setOpenCategories(prev => ({ [cat]: !prev[cat] }))
  }
  // ── Sidebar widths ───────────────────────────────────────────
  const expanded = "w-72"   // 18rem
  const collapsed = "w-[4.5rem]"

  const small = isMobile || isTablet

  // skeleton during SSR
  if (!mounted) {
    return (
      <aside
        className={`h-full flex flex-col bg-[#163B5C] ${expanded}`}
        style={{ minWidth: "4.5rem" }}
      />
    )
  }

  return (
    <>
      {/* Mobile dark overlay */}
      {small && overlayVisible && (
        <div
          className={`fixed inset-0 z-[45] bg-black/40 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          style={{ transitionDuration: `${sidebarOpen ? OPEN_MS : CLOSE_MS}ms` }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`
          h-full ${small ? "z-50" : "z-20"} flex flex-col flex-shrink-0
          bg-[#163B5C]
          border-r border-white/10
          transition-all
          ${small ? "fixed left-0 top-0" : "relative"}
          ${small
            ? sidebarOpen
              ? "translate-x-0 " + expanded
              : "-translate-x-full " + expanded
            : sidebarOpen
              ? expanded
              : collapsed
          }
        `}
        style={{
          transitionDuration: small
            ? sidebarOpen ? `${OPEN_MS}ms` : `${CLOSE_MS}ms`
            : "400ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: sidebarOpen ? "10px 0 30px -10px rgba(0, 29, 57, 0.2)" : "none"
        }}
      >
        {/* ── Brand / logo ── */}
        <div
          className="flex items-center justify-center h-20 mb-4 flex-shrink-0 cursor-pointer overflow-hidden p-6"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
              <img
                src="/Newton.png"
                alt="Newton AMS"
                className="w-full h-auto max-h-10 object-contain transition-all duration-300 hover:scale-105"
              />
              {/* Subtle orange accent dot near logo */}
              <span className="w-1.5 h-1.5 bg-[#f97316] rounded-full shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            </div>
          ) : (
            <img
              src="/favicon.png"
              alt="Newton Icon"
              className="w-10 h-10 object-contain transition-all duration-500 hover:rotate-12"
            />
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 hide-scrollbar space-y-2">
          {CATEGORY_ORDER.map((catName) => {
            const items = groupedItems[catName]
            if (!items || items.length === 0 || catName === "Settings") return null

            // Flat-link categories (no accordion)
            if ((catName === "Dashboard" || catName === "Platform" || catName === "Config") && items.length > 0) {
              return items.map(item => {
                const isDashboardRoot = item.href === "/admin" || item.href === "/coordinator"
                const isActive = isDashboardRoot ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/"))
                return (
                  <div key={item.key} className="relative group">
                    <Link
                      href={item.href}
                      onClick={() => { if (small) setSidebarOpen(false) }}
                      title={!sidebarOpen ? item.title : undefined}
                      className={`
                        group flex items-center gap-3 mx-2 rounded-md
                        transition-all duration-150
                        ${sidebarOpen ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"}
                        ${isActive ? "bg-[#2F6B8A] text-white" : "text-white hover:bg-white/10"}
                      `}
                    >
                      <item.icon className={`flex-shrink-0 w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                      {sidebarOpen && showText && (
                        <span className={`flex-1 text-[15px] ${isActive ? "font-bold" : "font-medium"} whitespace-nowrap`}>{item.title}</span>
                      )}

                      {isActive && (
                        <span className="absolute left-[-12px] top-1/4 bottom-1/4 w-1.5 bg-[#f97316] rounded-r-full shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
                      )}
                    </Link>
                  </div>
                )
              })
            }

            const CatIcon = CATEGORY_ICONS[catName] || ChevronRight
            const isOpen = openCategories[catName]
            const hasActiveChild = items.some(item => pathname === item.href || pathname.startsWith(item.href + "/"))

            return (
              <div key={catName} className="flex flex-col space-y-1">
                <button
                  onClick={() => toggleCategory(catName)}
                  title={!sidebarOpen ? catName : undefined}
                  className={`
                    relative group flex items-center gap-3 rounded-xl transition-all duration-300
                    ${sidebarOpen ? "px-4 py-3" : "px-0 py-3 justify-center"}
                    ${hasActiveChild && !isOpen
                      ? "text-white bg-white/5 border border-white/5"
                      : "text-blue-100/70 hover:text-white hover:bg-white/5"}
                  `}
                >
                  <CatIcon className={`flex-shrink-0 w-5 h-5 transition-transform duration-300 ${hasActiveChild ? "text-white" : "group-hover:scale-110"}`} />
                  {/* Collapsed sidebar: a small dot on the icon signals pending items */}
                  {!sidebarOpen && badges[catName] > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[#274c77]" />
                  )}
                  {sidebarOpen && showText && (
                    <>
                      <span className={`flex-1 text-left text-[15px] ${hasActiveChild ? "font-bold" : "font-medium"} whitespace-nowrap`}>{catName}</span>
                      {badges[catName] > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-bold leading-none">
                          {badges[catName] > 99 ? "99+" : badges[catName]}
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-white/40 transition-transform duration-500 ${isOpen ? "rotate-90" : "rotate-0"}`} />
                    </>
                  )}
                </button>

                <div
                  className={`grid transition-all duration-500 ease-in-out ${isOpen && sidebarOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col space-y-1 mt-1 ml-4 border-l border-white/10 pl-2 py-1">
                      {items.map(item => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={() => { if (isMobile || isTablet) setSidebarOpen(false) }}
                            className={`
                              group flex items-center gap-3 pl-10 pr-3 py-2 rounded-md
                              transition-all duration-150 mx-1
                              ${isActive ? "bg-[#2F6B8A] text-white" : "text-white hover:bg-white/10"}
                            `}
                          >
                            <item.icon className={`flex-shrink-0 w-4 h-4 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                            <span className="flex-1 text-[13px] whitespace-nowrap">{item.title}</span>

                            {isActive && (
                              <span className="absolute left-[-11px] top-1/2 -translate-y-1/2 w-1 h-4 bg-[#f97316]/80 rounded-full" />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* ── Settings / Logout ── */}
        <div className="flex-shrink-0 border-t border-white/10 py-5 px-4 flex flex-col gap-2">
          {groupedItems["Settings"]?.map((item) => {
            const isDashboard = item.href === "/admin" || item.href === "/coordinator"
            const isActive = mounted && (isDashboard ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/")))
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => { if (small) setSidebarOpen(false) }}
                title={!sidebarOpen ? item.title : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-md
                  transition-all duration-150
                  ${sidebarOpen ? "px-3 py-2.5" : "justify-center px-0 py-2.5"}
                  ${isActive ? "bg-[#2F6B8A] text-white" : "text-white hover:bg-white/10"}
                `}
              >
                <item.icon className="flex-shrink-0 w-5 h-5" />
                {sidebarOpen && showText && (
                  <span className="text-[15px] font-medium whitespace-nowrap">{item.title}</span>
                )}
              </Link>
            )
          })}

          <button
            onClick={() => {
              window.localStorage.removeItem("sis_user")
              window.location.href = "/login"
            }}
            title={!sidebarOpen ? "Logout" : undefined}
            className={`
              w-full flex items-center gap-3 rounded-xl
              text-red-400/80 hover:bg-red-500/10 hover:text-red-400
              transition-all duration-300
              ${sidebarOpen ? "px-4 py-3" : "justify-center px-0 py-3"}
            `}
          >
            <LogOut className="flex-shrink-0 w-5 h-5" />
            {sidebarOpen && showText && (
              <span className="text-[15px] font-bold whitespace-nowrap">Logout</span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}