'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

interface CourseActivity {
    course_id: string;
    student_id: string;
    enrolled_at: string;
}

interface CoursePerformanceProps {
    activities: CourseActivity[];
}

export default function CoursePerformance({ activities }: CoursePerformanceProps) {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Course Performance</CardTitle>
                <CardDescription>Top performing courses this month</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.length > 0 ? (
                        activities.slice(0, 5).map((activity, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <BookOpen className="h-5 w-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Course #{activity.course_id}</p>
                                        <p className="text-xs text-gray-500">Student #{activity.student_id}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {new Date(activity.enrolled_at).toLocaleDateString()}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
