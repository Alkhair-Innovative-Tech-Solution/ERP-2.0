'use client';

import { Bell } from 'lucide-react';
import NotificationsView from '@/components/shared/NotificationsView';

export default function TeacherNotificationsPage() {
    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Bell className="w-7 h-7 text-brand-teal" />
                    Notifications
                </h1>
                <p className="text-sm text-slate-400 font-bold mt-1">Stay updated with important announcements and system alerts.</p>
            </div>
            <NotificationsView />
        </div>
    );
}
