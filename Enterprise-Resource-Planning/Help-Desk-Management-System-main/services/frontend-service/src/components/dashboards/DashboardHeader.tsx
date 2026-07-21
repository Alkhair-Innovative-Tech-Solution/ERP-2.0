'use client';

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/Button';
import { Plus } from 'lucide-react';

interface DashboardHeaderProps {
    title: string;
    subtitle: string;
    stats?: {
        label: string;
        value: string | number;
        color?: string;
        isWarning?: boolean;
    }[];
    actionButton?: {
        label: string;
        onClick: () => void;
        icon?: React.ReactNode;
    };
    lastUpdated?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    title,
    subtitle,
    stats,
    actionButton,
    lastUpdated
}) => {
    return (
        <Card
            className="rounded-xl shadow-2xl border-0 mb-6"
            style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
                backgroundColor: '#ffffff'
            }}
        >
            <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1
                            className="text-3xl sm:text-4xl font-bold mb-2"
                            style={{ color: '#274c77' }}
                        >
                            {title}
                        </h1>
                        <p style={{ color: '#8b8c89' }} className="text-base sm:text-lg">
                            {subtitle}
                        </p>

                        {stats && stats.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                {stats.map((stat, index) => (
                                    <div key={index}>
                                        <span style={{ color: '#8b8c89' }}>{stat.label}: </span>
                                        <span
                                            className={`font-semibold ${stat.isWarning ? 'text-yellow-600' : ''}`}
                                            style={{ color: stat.color || (stat.isWarning ? '#fbbf24' : '#274c77') }}
                                        >
                                            {stat.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {lastUpdated && (
                            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                <span>Last updated: {lastUpdated}</span>
                            </div>
                        )}
                    </div>

                    {actionButton && (
                        <div className="flex-shrink-0">
                            <Button
                                onClick={actionButton.onClick}
                                variant="primary"
                                size="md"
                                leftIcon={actionButton.icon || <Plus className="w-4 h-4" style={{ color: 'white' }} />}
                                className="w-full sm:w-auto"
                            >
                                {actionButton.label}
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
