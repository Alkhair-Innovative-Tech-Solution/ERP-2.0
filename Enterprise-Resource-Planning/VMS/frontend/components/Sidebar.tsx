"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarClock, QrCode,
  UserPlus, LogOut, Building2, History, Briefcase,
} from "lucide-react";
import { logout } from "@/lib/api";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/visits", icon: Users, label: "Visits" },
  { href: "/dashboard/schedule", icon: CalendarClock, label: "Schedule" },
  { href: "/dashboard/entry", icon: UserPlus, label: "New Entry" },
  { href: "/dashboard/qr", icon: QrCode, label: "QR Code" },
  { href: "/dashboard/hosts", icon: Building2, label: "Hosts" },
  { href: "/dashboard/history", icon: History, label: "Visitor History" },
  { href: "/dashboard/companies", icon: Briefcase, label: "Companies" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      position: "fixed", left: 0, top: 0, height: "100vh", width: 220,
      background: "#0f0e0c",
      display: "flex", flexDirection: "column", zIndex: 40,
      borderRight: "1px solid #1e1c19",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid #1e1c19" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 style={{ width: 16, height: 16, color: "white" }} />
          </div>
          <div>
            <p style={{ color: "white", fontSize: "0.9375rem", fontWeight: 700, margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>VMS</p>
            <p style={{ color: "#514e48", fontSize: "0.7rem", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>Front Desk</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.125rem", overflowY: "auto" }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.5rem 0.75rem", borderRadius: "0.625rem",
              fontSize: "0.8125rem", fontWeight: active ? 500 : 400,
              color: active ? "white" : "#6b6760",
              background: active ? "#1e1c19" : "transparent",
              textDecoration: "none", transition: "all 0.15s",
              position: "relative",
            }}>
              {active && (
                <span style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, background: "#6366f1", borderRadius: "0 4px 4px 0" }} />
              )}
              <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid #1e1c19" }}>
        <button onClick={logout} style={{
          display: "flex", alignItems: "center", gap: "0.625rem",
          width: "100%", padding: "0.5rem 0.75rem", borderRadius: "0.625rem",
          fontSize: "0.8125rem", color: "#514e48",
          background: "transparent", border: "none", cursor: "pointer",
          transition: "all 0.15s", textAlign: "left",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "#1a0a0a"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#514e48"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <LogOut style={{ width: 15, height: 15 }} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
