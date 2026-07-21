'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, Award, Bell, Calendar } from 'lucide-react';

const activities = [
    { icon: <Users className="h-5 w-5" />, text: 'New student registered', time: '2 minutes ago', color: 'bg-blue-100 text-blue-600' },
    { icon: <BookOpen className="h-5 w-5" />, text: 'New course created', time: '15 minutes ago', color: 'bg-green-100 text-green-600' },
    { icon: <Award className="h-5 w-5" />, text: 'Certificate issued', time: '1 hour ago', color: 'bg-purple-100 text-purple-600' },
    { icon: <Bell className="h-5 w-5" />, text: 'Notification sent to all students', time: '2 hours ago', color: 'bg-yellow-100 text-yellow-600' },
    { icon: <Calendar className="h-5 w-5" />, text: 'Class scheduled', time: '3 hours ago', color: 'bg-pink-100 text-pink-600' },
];

export default function RecentActivity() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest platform activities</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.map((activity, index) => (
                        <div key={index} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activity.color}`}>
                                {activity.icon}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{activity.text}</p>
                                <p className="text-xs text-gray-500">{activity.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
