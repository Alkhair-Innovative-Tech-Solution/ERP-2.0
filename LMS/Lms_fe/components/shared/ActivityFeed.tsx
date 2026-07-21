'use client';

import { Bell, BookOpen, FileText, Award, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'assignment' | 'course' | 'certification' | 'announcement' | 'info';
  title: string;
  description?: string;
  timestamp: string;
  read?: boolean;
}

interface ActivityFeedProps {
  activities?: Activity[];
  maxItems?: number;
}

const activityIcons = {
  assignment: FileText,
  course: BookOpen,
  certification: Award,
  announcement: Bell,
  info: Bell,
};

const activityColors = {
  assignment: 'text-blue-600 bg-blue-50',
  course: 'text-green-600 bg-green-50',
  certification: 'text-yellow-600 bg-yellow-50',
  announcement: 'text-purple-600 bg-purple-50',
  info: 'text-gray-600 bg-gray-50',
};

export default function ActivityFeed({ activities = [], maxItems = 5 }: ActivityFeedProps) {
  // Safety check: ensure activities is an array
  const safeActivities = Array.isArray(activities) ? activities : [];
  const displayActivities = safeActivities.slice(0, maxItems);

  if (displayActivities.length === 0) {
    return (
      <div className="moodle-card">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
        <p className="text-gray-500 text-center py-8">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="moodle-card">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {displayActivities.map((activity) => {
          const Icon = activityIcons[activity.type];
          const colorClass = activityColors[activity.type];

          // Safety check: if Icon is undefined, skip rendering this activity
          if (!Icon) {
            console.warn(`Unknown activity type: ${activity.type}`);
            return null;
          }

          return (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                !activity.read ? 'bg-gray-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-gray-600 mt-1">{activity.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {formatDateTime(activity.timestamp)}
                </p>
              </div>
              {!activity.read && (
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
              )}
            </div>
          );
        })}
      </div>
      {activities.length > maxItems && (
        <button className="w-full mt-4 text-sm text-primary-600 font-semibold hover:text-primary-700">
          View All Activity
        </button>
      )}
    </div>
  );
}

