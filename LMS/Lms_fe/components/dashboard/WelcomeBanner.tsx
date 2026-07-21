"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Sun, Moon, Cloud } from "lucide-react";

interface WelcomeBannerProps {
  userName: string;
  role?: string;
  className?: string;
}

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();

  if (hour < 12) {
    return {
      text: "Good Morning",
      icon: <Sun className="w-6 h-6 text-amber-500" />,
    };
  } else if (hour < 17) {
    return {
      text: "Good Afternoon",
      icon: <Cloud className="w-6 h-6 text-blue-400" />,
    };
  } else {
    return {
      text: "Good Evening",
      icon: <Moon className="w-6 h-6 text-indigo-400" />,
    };
  }
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WelcomeBanner({
  userName,
  role,
  className,
}: WelcomeBannerProps) {
  const greeting = getGreeting();
  const formattedDate = formatDate();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-8 text-white",
        "bg-gradient-to-br from-brand-dark via-slate-800 to-slate-900",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-orange/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {greeting.icon}
            <h1 className="text-2xl font-black tracking-tight">
              {greeting.text}, {userName}!
            </h1>
          </div>
          <p className="text-slate-300 text-sm font-medium">
            {formattedDate}
            {role && (
              <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs">
                {role}
              </span>
            )}
          </p>
        </div>

        {/* Quick stats or decorative element */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-black text-brand-teal">12</p>
            <p className="text-xs text-slate-400">Active Courses</p>
          </div>
          <div className="w-px h-12 bg-slate-600" />
          <div className="text-center">
            <p className="text-3xl font-black text-brand-orange">48</p>
            <p className="text-xs text-slate-400">Students</p>
          </div>
        </div>
      </div>
    </div>
  );
}
