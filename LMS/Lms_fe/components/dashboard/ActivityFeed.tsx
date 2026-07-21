"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Clock, BookOpen, Award, Users, FileText, CheckCircle } from "lucide-react";

interface Activity {
  id: string;
  type: "enrollment" | "completion" | "assignment" | "grade" | "certificate" | "attendance";
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  className?: string;
}

const typeConfig = {
  enrollment: {
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  completion: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  assignment: {
    icon: FileText,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  grade: {
    icon: Award,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  certificate: {
    icon: Award,
    color: "text-brand-teal",
    bg: "bg-teal-50",
  },
  attendance: {
    icon: Clock,
    color: "text-slate-600",
    bg: "bg-slate-100",
  },
};

function timeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityFeed({
  activities,
  loading = false,
  className,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn("premium-card p-6 animate-pulse", className)}>
        <div className="w-32 h-5 bg-slate-100 rounded mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl" />
            <div className="flex-1">
              <div className="w-48 h-4 bg-slate-100 rounded mb-2" />
              <div className="w-32 h-3 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("premium-card p-6", className)}>
      <h3 className="text-base font-bold text-slate-800 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No recent activity</p>
        ) : (
          activities.map((activity) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    config.bg
                  )}
                >
                  <Icon className={cn("w-5 h-5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {activity.description}
                  </p>
                  {activity.user && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      by {activity.user}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {timeAgo(activity.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
