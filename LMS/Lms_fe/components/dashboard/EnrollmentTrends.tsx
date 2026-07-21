'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Jan', students: 40 },
    { name: 'Feb', students: 30 },
    { name: 'Mar', students: 20 },
    { name: 'Apr', students: 27 },
    { name: 'May', students: 18 },
    { name: 'Jun', students: 23 },
    { name: 'Jul', students: 34 },
];

export default function EnrollmentTrends() {
    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Enrollment Trends</CardTitle>
                <CardDescription>Student enrollments over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full" style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="students" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
