import React from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
    CheckCircle,
    Play,
    Edit,
    Pause,
    MessageSquare,
    AlertCircle
} from 'lucide-react';
import { THEME } from '../../lib/theme';
import { Ticket } from '../../types';

interface AssigneeActionsPanelProps {
    ticket: Ticket;
    onActionSelect: (action: 'acknowledge' | 'start' | 'progress' | 'complete' | 'postpone' | 'subticket' | 'approval') => void;
    loading?: boolean;
}

const AssigneeActionsPanel: React.FC<AssigneeActionsPanelProps> = ({
    ticket,
    onActionSelect,
    loading = false
}) => {
    const isAssigned = ticket.status === 'assigned';
    const isInProgress = ticket.status === 'in_progress';
    const isPostponed = ticket.status === 'postponed' || (ticket as any).status === 'POSTPONED'; // Handle casing if needed

    // Check if acknowledged - assuming acknowledgedAt is present if acknowledged
    const isAcknowledged = !!ticket.acknowledgedAt;

    return (
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Assignee Actions
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {/* Acknowledge Action - Only if Assigned and NOT Acknowledged */}
                {isAssigned && !isAcknowledged && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-3">
                        <div className="flex items-start gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                            <p className="text-sm text-blue-800">Please acknowledge this assignment to let everyone know you've seen it.</p>
                        </div>
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={() => onActionSelect('acknowledge')}
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                            loading={loading}
                        >
                            Acknowledge Assignment
                        </Button>
                    </div>
                )}

                {/* Start Work - Only if Assigned (and Acknowledged usually, but we allow flexible) */}
                {isAssigned && (
                    <Button
                        variant="success"
                        fullWidth
                        onClick={() => onActionSelect('start')}
                        leftIcon={<Play className="w-4 h-4" />}
                        loading={loading}
                        disabled={!isAcknowledged} // Optional: Enforce acknowledgment first?
                    >
                        Start Work
                    </Button>
                )}

                {/* In Progress Actions */}
                {isInProgress && (
                    <>
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={() => onActionSelect('progress')}
                            leftIcon={<Edit className="w-4 h-4" />}
                            loading={loading}
                        >
                            Update Progress
                        </Button>

                        <Button
                            variant="success"
                            fullWidth
                            onClick={() => onActionSelect('complete')}
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                            loading={loading}
                            className="mt-2"
                        >
                            Mark as Complete
                        </Button>
                    </>
                )}

                {/* Common Actions (Request Subticket, Postpone) - Available if not closed/resolved */}
                {!['completed', 'resolved', 'closed', 'rejected'].includes(ticket.status) && (
                    <>
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">More Options</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => onActionSelect('subticket')}
                            leftIcon={<MessageSquare className="w-4 h-4" />}
                            loading={loading}
                        >
                            Request Sub-Ticket
                        </Button>

                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => onActionSelect('postpone')}
                            leftIcon={<Pause className="w-4 h-4" />}
                            loading={loading}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                        >
                            Request Postponement
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default AssigneeActionsPanel;
