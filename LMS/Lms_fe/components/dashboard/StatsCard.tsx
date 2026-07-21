import { TrendingUp } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: number;
    icon: any;
    color: 'blue' | 'green' | 'purple' | 'orange';
    change: string;
}

export default function StatsCard({ title, value, icon: Icon, color, change }: StatsCardProps) {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600',
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {change}
                    </p>
                </div>
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
                    <Icon className="w-7 h-7" />
                </div>
            </div>
        </div>
    );
}
