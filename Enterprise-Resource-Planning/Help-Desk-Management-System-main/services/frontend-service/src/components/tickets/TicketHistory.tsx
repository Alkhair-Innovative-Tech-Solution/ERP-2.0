import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Activity, User, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { THEME } from '../../lib/theme';
import ticketService, { AuditLogEntry } from '../../services/api/ticketService';
import { formatDate } from '../../lib/helpers';

interface TicketHistoryProps {
    ticketId: string;
}

const TicketHistory: React.FC<TicketHistoryProps> = ({ ticketId }) => {
    const [history, setHistory] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const logs = await ticketService.getHistory(ticketId);
                setHistory(logs);
            } catch (error) {
                console.error('Failed to fetch history:', error);
            } finally {
                setLoading(false);
            }
        };
        if (ticketId) {
            fetchHistory();
        }
    }, [ticketId]);

    if (loading) {
        return <div className="p-4 text-center">Loading history...</div>;
    }

    if (history.length === 0) {
        return (
            <Card className="bg-white rounded-2xl shadow-xl border-0">
                <CardContent className="p-6 text-center text-gray-500">
                    No history available for this ticket.
                </CardContent>
            </Card>
        );
    }

    const getIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <FileText className="w-4 h-4" />;
            case 'UPDATE': return <Activity className="w-4 h-4" />;
            case 'STATUS_CHANGE': return <Activity className="w-4 h-4" />;
            case 'ASSIGN': return <User className="w-4 h-4" />;
            case 'ACKNOWLEDGE': return <CheckCircle className="w-4 h-4" />;
            case 'RESOLVE': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'SLA_CHANGE': return <Clock className="w-4 h-4 text-orange-500" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const formatChanges = (changes: any) => {
        if (!changes) return null;
        return Object.keys(changes).map(key => {
            const change = changes[key];
            // Handle simple old/new wrapper or direct value
            const oldVal = change?.old !== undefined ? change.old : 'N/A';
            const newVal = change?.new !== undefined ? change.new : (typeof change === 'object' ? JSON.stringify(change) : change);

            return (
                <div key={key} className="text-xs text-gray-500 mt-1">
                    <span className="font-semibold">{key}:</span> {String(oldVal)} &rarr; {String(newVal)}
                </div>
            );
        });
    };

    return (
        <Card className="bg-white rounded-2xl shadow-xl border-0">
            <CardHeader className="p-4 md:p-6 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" style={{ color: THEME.colors.primary }} />
                    <CardTitle className="text-lg font-bold" style={{ color: THEME.colors.primary }}>
                        Ticket Activity
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                    {history.map((log, index) => (
                        <div key={log.id} className={`p-4 hover:bg-gray-50 transition-colors ${index !== history.length - 1 ? 'border-b border-gray-100' : ''}`}>
                            <div className="flex items-start gap-3">
                                <div className="mt-1 p-2 bg-gray-100 rounded-full">
                                    {getIcon(log.action_type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <span className="font-semibold text-sm text-gray-900">
                                            {log.action_type.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                            {formatDate(log.timestamp)}
                                        </span>
                                    </div>

                                    {log.reason && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            {log.reason}
                                        </p>
                                    )}

                                    <div className="mt-1 pl-2 border-l-2 border-gray-200">
                                        {formatChanges(log.changes)}
                                    </div>

                                    {log.performed_by_id && (
                                        <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            User ID: {log.performed_by_id.slice(0, 8)}...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default TicketHistory;
