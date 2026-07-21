"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  LayoutDashboard,
  LogOut,
  Building2,
  Menu,
  X,
  Bell,
  Search,
  LayoutGrid,
  Briefcase,
  ChevronDown,
  GitBranch,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAuthenticated } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  if (!isAuthenticated) return null;

  const navLinks = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/" },
    { name: "Institutions", icon: Building2, href: "/institutions" },
    { name: "Departments", icon: LayoutGrid, href: "/departments" },
    { name: "Designations", icon: Briefcase, href: "/designations" },
    { name: "Employees", icon: Users, href: "/employees" },
    { name: "Services", icon: Shield, href: "/service" }
  ];

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none blur-[150px] opacity-30">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full " />
        <div className="absolute top-[50%] -right-[15%] w-[50%] h-[50%] rounded-full" />
      </div>

      <div className="flex h-screen w-full relative z-10">
        {/* Sidebar Backdrop (mobile) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ─── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-60  bg-theme-900 border-r border-theme-800 shadow-xl flex flex-col transform transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-5 border-b border-theme-800 shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-theme-600 rounded-lg flex items-center justify-center shadow-md shadow-theme-900/50 group-hover:scale-105 transition-transform">
                <Users size={16} className="text-white" />
              </div>
              <span className="font-black text-white text-sm tracking-wide group-hover:text-theme-300 transition-colors">
                EMS Dashboard
              </span>
            </Link>
            <button
              className="lg:hidden text-theme-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* User Card */}
          {/* <div className="px-4 py-4 border-b border-theme-800 shrink-0">
            <Link
              href="/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 hover:bg-white/10 hover:shadow-sm transition-all cursor-pointer group border border-white/5 hover:border-white/20"
            >
              <div className="w-10 h-10 bg-theme-600 text-white flex items-center justify-center rounded-full text-sm font-black shrink-0 shadow-sm shadow-black/20 group-hover:scale-105 transition-transform">
                {initials}
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="font-black text-[13px] text-white leading-tight truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-theme-300 truncate mt-0.5">
                  {user?.designation || user?.department || "Admin"}
                </p>
              </div>
            </Link>
          </div> */}

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 group hover:-translate-y-0.5 ${isActive
                    ? "bg-theme-600 text-white shadow-lg shadow-black/20"
                    : "text-theme-100 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "" : "group-hover:scale-110 transition-transform duration-300"} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div className="px-3 pb-5 shrink-0 border-t border-theme-800 pt-3">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-semibold text-theme-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-150"
            >
              <LogOut size={17} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ─── Main Area ───────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 shrink-0 shadow-sm">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden text-slate-500 hover:text-slate-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            {/* Search */}
            {/* <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-64">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Quick search..."
                className="bg-transparent text-sm text-slate-600 placeholder-slate-900 outline-none w-full"
              />
            </div> */}

            {/* Right side */}
            <div className="flex items-center gap-3 ml-auto">
              {/* Bell */}
              {/* <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell size={18} className="text-slate-500" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full" />
              </button> */}

              {/* Profile Link */}
              <Link
                href="/profile"
                className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-2xl pl-1.5 pr-4 py-1.5 transition-colors cursor-pointer group border border-slate-100/50"
              >
                <div className="w-9 h-9 bg-theme-800 text-white flex items-center justify-center rounded-full text-xs font-black shadow-sm group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col justify-center">
                  <span className="text-[13px] font-black text-[#1e293b] leading-tight">
                    {user?.full_name || "User"}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-0.5">
                    {user?.designation || user?.department || "Admin"}
                  </span>
                </div>
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
