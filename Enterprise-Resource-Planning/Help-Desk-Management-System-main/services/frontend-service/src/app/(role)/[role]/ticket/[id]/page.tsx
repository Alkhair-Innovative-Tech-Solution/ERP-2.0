'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../lib/auth';
import { useSocket } from '../../../../../hooks/useSocket';
import ticketService from '../../../../../services/api/ticketService';
import userService from '../../../../../services/api/userService';
import { Ticket } from '../../../../../types';
import { THEME } from '../../../../../lib/theme';
import { formatRelativeTime } from '../../../../../lib/helpers';
import { UnifiedChatPanel } from '../../../../../components/chat/UnifiedChatPanel';
import { StatusBadge } from '../../../../../components/common/StatusBadge';
import { PriorityBadge } from '../../../../../components/common/PriorityBadge';
import { TicketTimeline } from '../../../../../components/common/TicketTimeline';
import { ParticipantsCard } from '../../../../../components/common/ParticipantsCard';
import { AttachmentsCard } from '../../../../../components/common/AttachmentsCard';
import { SLACard } from '../../../../../components/common/SLACard';
import { Button } from '../../../../../components/ui/Button';
import { Card, CardContent } from '../../../../../components/ui/card';
import AlertModal from '../../../../../components/modals/AlertModal';
import ConfirmModal from '../../../../../components/modals/ConfirmModal';
import AssignTicketModal from '../../../../../components/modals/AssignTicketModal';
import RejectTicketModal from '../../../../../components/modals/RejectTicketModal';
import PostponeModal from '../../../../../components/modals/PostponeModal';
import ClarificationModal from '../../../../../components/modals/ClarificationModal';
import InitialReviewModal from '../../../../../components/modals/InitialReviewModal';
import EditTicketModal from '../../../../../components/modals/EditTicketModal';
import { ResolveModal, ReopenModal } from '../../../../../components/modals/TicketActionModals';
import {
  ArrowLeft, Building2, User, Calendar, Clock, ChevronDown, ChevronUp,
  MessageSquare, Tag, CheckCircle, XCircle, Edit, Play, Pause,
  AlertCircle, RefreshCw, FileText, ClipboardList,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModeratorModal = 'assign' | 'reassign' | 'reject' | 'postpone' | 'clarify' | null;
type MobileTab = 'details' | 'chat';

interface AlertState {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

// ─── Role Actions Panel ───────────────────────────────────────────────────────
// Inline component — tightly coupled with page state. Extract only if reused elsewhere.

interface RoleActionsPanelProps {
  ticket: Ticket;
  role: string;
  loading: boolean;
  onModeratorAction: (action: Exclude<ModeratorModal, null>) => void;
  onModeratorEdit: () => void;
  onAssigneeAction: (action: 'acknowledge' | 'start' | 'progress' | 'complete' | 'postpone') => void;
  onRequestorAction: (action: 'submit' | 'edit' | 'resolve' | 'reopen' | 'delete') => void;
}

const RoleActionsPanel: React.FC<RoleActionsPanelProps> = ({
  ticket, role, loading,
  onModeratorAction, onModeratorEdit,
  onAssigneeAction, onRequestorAction,
}) => {
  const isModerator = role === 'moderator' || role === 'admin';
  const isAssignee = role === 'assignee';
  const isRequestor = role === 'requestor';

  const isTerminal = ['completed', 'resolved', 'closed', 'rejected'].includes(ticket.status);
  const isAcknowledged = !!ticket.acknowledgedAt;
  const isAssigned = ticket.status === 'assigned';
  const isInProgress = ticket.status === 'in_progress';

  // Requestor permissions
  const canSubmit = ticket.status === 'draft';
  const canEdit = ticket.status === 'draft' || ticket.status === 'pending';
  const canResolve = ticket.status === 'completed';
  const canReopen = ticket.status === 'closed';
  const canDelete = ticket.status === 'draft';

  if (isModerator && !isTerminal) {
    return (
      <Card
        className="rounded-2xl border-0"
        style={{ boxShadow: '0 2px 12px rgba(39,76,119,0.08)' }}
      >
        <CardContent className="p-4 sm:p-5">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5"
            style={{ color: THEME.colors.medium }}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Moderator Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary" size="sm" fullWidth
              onClick={() => onModeratorAction('assign')}
              leftIcon={<User className="w-3.5 h-3.5" />}
              loading={loading}
            >
              Assign
            </Button>
            <Button
              variant="outline" size="sm" fullWidth
              onClick={() => onModeratorAction('clarify')}
              leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
              loading={loading}
            >
              Clarify
            </Button>
            <Button
              variant="outline" size="sm" fullWidth
              onClick={() => onModeratorAction('postpone')}
              leftIcon={<Clock className="w-3.5 h-3.5" />}
              loading={loading}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              Postpone
            </Button>
            <Button
              variant="outline" size="sm" fullWidth
              onClick={() => onModeratorAction('reject')}
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
              loading={loading}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Reject
            </Button>
          </div>
          {ticket.assigneeName && (
            <div className="mt-2">
              <Button
                variant="outline" size="sm" fullWidth
                onClick={() => onModeratorAction('reassign')}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={loading}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                Reassign
              </Button>
            </div>
          )}
          <div className="mt-2">
            <Button
              variant="outline" size="sm" fullWidth
              onClick={onModeratorEdit}
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              loading={loading}
            >
              Edit Ticket Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAssignee && !isTerminal) {
    return (
      <Card
        className="rounded-2xl border-0"
        style={{ boxShadow: '0 2px 12px rgba(39,76,119,0.08)' }}
      >
        <CardContent className="p-4 sm:p-5">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5"
            style={{ color: THEME.colors.medium }}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Task Actions
          </p>

          {/* Acknowledge nudge */}
          {isAssigned && !isAcknowledged && (
            <div
              className="mb-3 p-3 rounded-xl border flex items-start gap-2"
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-none text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-700 mb-2">
                  Acknowledge this task to let the team know you've seen it.
                </p>
                <Button
                  variant="primary" size="sm" fullWidth
                  onClick={() => onAssigneeAction('acknowledge')}
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  loading={loading}
                >
                  Acknowledge
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {isAssigned && (
              <Button
                variant="success" size="sm" fullWidth
                onClick={() => onAssigneeAction('start')}
                leftIcon={<Play className="w-3.5 h-3.5" />}
                disabled={!isAcknowledged}
                loading={loading}
              >
                Start Work
              </Button>
            )}
            {isInProgress && (
              <>
                <Button
                  variant="primary" size="sm" fullWidth
                  onClick={() => onAssigneeAction('progress')}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  loading={loading}
                >
                  Update Progress
                </Button>
                <Button
                  variant="success" size="sm" fullWidth
                  onClick={() => onAssigneeAction('complete')}
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  loading={loading}
                >
                  Mark Complete
                </Button>
              </>
            )}
            <div className="border-t pt-2" style={{ borderColor: THEME.colors.light + '60' }}>
              <Button
                variant="outline" size="sm" fullWidth
                onClick={() => onAssigneeAction('postpone')}
                leftIcon={<Pause className="w-3.5 h-3.5" />}
                loading={loading}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                Request Postponement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isRequestor) {
    const hasActions = canSubmit || canEdit || canResolve || canReopen || canDelete;
    if (!hasActions) return null;

    return (
      <Card
        className="rounded-2xl border-0"
        style={{ boxShadow: '0 2px 12px rgba(39,76,119,0.08)' }}
      >
        <CardContent className="p-4 sm:p-5">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5"
            style={{ color: THEME.colors.medium }}
          >
            <FileText className="w-3.5 h-3.5" />
            Actions
          </p>
          <div className="space-y-2">
            {canSubmit && (
              <Button
                variant="primary" size="sm" fullWidth
                onClick={() => onRequestorAction('submit')}
                leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                loading={loading}
              >
                Submit Ticket
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline" size="sm" fullWidth
                onClick={() => onRequestorAction('edit')}
                leftIcon={<Edit className="w-3.5 h-3.5" />}
              >
                Edit Request
              </Button>
            )}
            {canResolve && (
              <Button
                variant="success" size="sm" fullWidth
                onClick={() => onRequestorAction('resolve')}
                leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                loading={loading}
              >
                Mark Resolved
              </Button>
            )}
            {canReopen && (
              <Button
                variant="outline" size="sm" fullWidth
                onClick={() => onRequestorAction('reopen')}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Request Reopen
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline" size="sm" fullWidth
                onClick={() => onRequestorAction('delete')}
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                className="border-red-200 hover:bg-red-50"
                style={{ color: THEME.colors.error }}
              >
                Delete Draft
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

// ─── Inline Modal Shell ───────────────────────────────────────────────────────
// Reusable shell for simple inline modals (progress, complete, postpone)

const InlineModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title, onClose, children,
}) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      style={{ boxShadow: '0 24px 48px rgba(39,76,119,0.18)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: THEME.colors.light + '60' }}
      >
        <h3 className="text-sm font-bold" style={{ color: THEME.colors.primary }}>{title}</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: THEME.colors.gray }}
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UnifiedTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const ticketId = params?.id as string;
  const role = user?.role ?? 'requestor';

  // ── Core state ─────────────────────────────────────────────────────────────
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [descExpanded, setDescExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('details');

  // ── Modal state ────────────────────────────────────────────────────────────
  const [moderatorModal, setModeratorModal] = useState<ModeratorModal>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInitialReview, setShowInitialReview] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reopenCount, setReopenCount] = useState(0);

  // Assignee inline modals
  const [progressModal, setProgressModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [assigneePostponeModal, setAssigneePostponeModal] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressNotes, setProgressNotes] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeFile, setCompleteFile] = useState<File | null>(null);
  const [postponeReason, setPostponeReason] = useState('');

  // Alert (replaces alert() / console.log feedback)
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false, type: 'info', title: '', message: '',
  });

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const { subscribe, unsubscribe } = useSocket(
    ticketId ? `/ws/tickets/${ticketId}/` : undefined
  );

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchTicket = useCallback(async () => {
    if (!ticketId) { setLoading(false); return; }
    try {
      const data = await ticketService.getTicketById(ticketId);
      setTicket(data);
      setReopenCount((data as any).reopenCount || 0);
      if ((data as any).progress_percent) {
        setProgressPct((data as any).progress_percent);
      }
      // Auto-open initial review modal for moderators on submitted tickets
      if ((role === 'moderator' || role === 'admin') && data.status === 'submitted') {
        setShowInitialReview(true);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId, role]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  // Fetch assignees for moderator/admin
  useEffect(() => {
    if (role !== 'moderator' && role !== 'admin') return;
    userService.getUsers({ role: 'assignee' })
      .then(r => setAssignees(r.results || []))
      .catch(() => {});
  }, [role]);

  // Real-time WebSocket subscription
  useEffect(() => {
    if (!ticketId || !ticket) return;
    const handler = (data: any) => {
      setTicket(prev => prev ? { ...prev, ...data.changes } : null);
    };
    try { subscribe('ticket_updated', handler); } catch {}
    return () => { try { unsubscribe('ticket_updated', handler); } catch {} };
  }, [ticketId, ticket, subscribe, unsubscribe]);

  // ── Auto-close countdown ───────────────────────────────────────────────────
  const autoCloseCountdown = useMemo(() => {
    if (ticket?.status !== 'resolved' || !ticket?.resolvedDate) return null;
    const autoClose = new Date(ticket.resolvedDate).getTime() + 7 * 24 * 60 * 60 * 1000;
    const diffMs = autoClose - Date.now();
    if (diffMs <= 0) return null;
    return {
      days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    };
  }, [ticket?.status, ticket?.resolvedDate]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showAlert = useCallback((
    type: AlertState['type'], title: string, message: string
  ) => {
    setAlertState({ isOpen: true, type, title, message });
  }, []);

  const wrap = useCallback(async (
    fn: () => Promise<void>,
    successMsg?: string
  ) => {
    try {
      setProcessing(true);
      await fn();
      if (successMsg) showAlert('success', 'Success', successMsg);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'An error occurred';
      showAlert('error', 'Error', msg);
    } finally {
      setProcessing(false);
    }
  }, [showAlert]);

  // ── Moderator action handlers ──────────────────────────────────────────────
  const handleAssign = async (assigneeId: string, departmentId?: string) => {
    await wrap(async () => {
      await ticketService.assignTicket(ticketId, assigneeId, departmentId);
      setModeratorModal(null);
      fetchTicket();
    }, 'Ticket assigned successfully');
  };

  const handleReassign = async (assigneeId: string) => {
    await wrap(async () => {
      await ticketService.reassignTicket(ticketId, assigneeId, '');
      setModeratorModal(null);
      fetchTicket();
    }, 'Ticket reassigned successfully');
  };

  const handleReject = async (reason: string) => {
    await wrap(async () => {
      await ticketService.rejectTicket(ticketId, reason);
      setModeratorModal(null);
      setShowInitialReview(false);
      showAlert('success', 'Rejected', 'Ticket has been rejected');
      setTimeout(() => router.back(), 1800);
    });
  };

  const handlePostpone = async (reason: string) => {
    await wrap(async () => {
      await ticketService.postponeTicket(ticketId, reason);
      setModeratorModal(null);
      setShowInitialReview(false);
      fetchTicket();
    }, 'Ticket postponed');
  };

  const handleClarify = async (message: string) => {
    await wrap(async () => {
      await ticketService.addComment(ticketId, `[Clarification Request] ${message}`);
      setModeratorModal(null);
    }, 'Clarification request sent');
  };

  const handleConfirmReview = async (data: any) => {
    await wrap(async () => {
      await ticketService.confirmReview(ticketId, data);
      setShowInitialReview(false);
      fetchTicket();
    }, 'Ticket reviewed and confirmed');
  };

  const handleUpdateTicket = async (data: any) => {
    await wrap(async () => {
      await ticketService.updateTicket(ticketId, data);
      setShowEditModal(false);
      fetchTicket();
    }, 'Ticket details updated');
  };

  // ── Assignee action handlers ───────────────────────────────────────────────
  const handleAssigneeAction = async (
    action: 'acknowledge' | 'start' | 'progress' | 'complete' | 'postpone'
  ) => {
    switch (action) {
      case 'acknowledge':
        await wrap(async () => {
          await ticketService.acknowledgeTicket(ticketId, 'Acknowledged');
          fetchTicket();
        }, 'Assignment acknowledged');
        break;
      case 'start':
        await wrap(async () => {
          await ticketService.changeStatus(ticketId, 'in_progress', 'Started work');
          fetchTicket();
        }, 'Work started — status is now In Progress');
        break;
      case 'progress': setProgressModal(true); break;
      case 'complete': setCompleteModal(true); break;
      case 'postpone': setAssigneePostponeModal(true); break;
    }
  };

  const handleSaveProgress = async () => {
    if (!ticket) return;
    await wrap(async () => {
      await ticketService.updateProgress(ticket.id, progressPct);
      if (progressNotes.trim()) {
        await ticketService.addComment(ticket.id, `[Progress Update] ${progressPct}%: ${progressNotes}`);
      }
      setProgressModal(false);
      setProgressNotes('');
      fetchTicket();
    }, `Progress updated to ${progressPct}%`);
  };

  const handleComplete = async () => {
    if (!ticket) return;
    if (!completeNotes.trim()) {
      showAlert('warning', 'Required Field', 'Please add completion notes before marking complete');
      return;
    }
    await wrap(async () => {
      await ticketService.completeTicket(ticket.id, completeNotes, completeFile || undefined);
      setCompleteModal(false);
      setCompleteNotes('');
      setCompleteFile(null);
      fetchTicket();
    }, 'Task marked as complete — awaiting resolution confirmation');
  };

  const handleAssigneePostpone = async () => {
    if (!ticket) return;
    if (!postponeReason.trim()) {
      showAlert('warning', 'Required Field', 'Please provide a reason for postponement');
      return;
    }
    await wrap(async () => {
      await ticketService.postponeTicket(ticket.id, postponeReason);
      setAssigneePostponeModal(false);
      setPostponeReason('');
      fetchTicket();
    }, 'Postponement request submitted');
  };

  // ── Requestor action handlers ──────────────────────────────────────────────
  const handleRequestorAction = async (
    action: 'submit' | 'edit' | 'resolve' | 'reopen' | 'delete'
  ) => {
    switch (action) {
      case 'edit':
        router.push(`/${role}/new-request?edit=${ticket?.id}`);
        break;
      case 'resolve':
        setShowResolveModal(true);
        break;
      case 'reopen':
        setShowReopenModal(true);
        break;
      case 'submit':
        await wrap(async () => {
          await ticketService.submitTicket(ticket!.id);
          fetchTicket();
        }, 'Ticket submitted — a moderator will review it shortly');
        break;
      case 'delete':
        setShowDeleteConfirm(true);
        break;
    }
  };

  const handleDeleteDraft = async () => {
    if (!ticket) return;
    await wrap(async () => {
      await ticketService.deleteTicket(ticket.id);
      setShowDeleteConfirm(false);
      router.push(`/${role}/requests`);
    });
  };

  const handleResolve = async () => {
    if (!ticket) return;
    await wrap(async () => {
      await ticketService.changeStatus(ticket.id, 'resolved');
      setShowResolveModal(false);
      fetchTicket();
    }, 'Ticket marked as resolved');
  };

  const handleReopen = async (_reason: string) => {
    if (!ticket || reopenCount >= 2) return;
    await wrap(async () => {
      await ticketService.changeStatus(ticket.id, 'pending');
      setReopenCount(c => c + 1);
      setShowReopenModal(false);
      fetchTicket();
    }, 'Reopen request submitted');
  };

  // ── Description helpers ────────────────────────────────────────────────────
  const descWords = ticket?.description?.split(' ') ?? [];
  const isLongDesc = descWords.length > 80;
  const displayDesc = descExpanded || !isLongDesc
    ? (ticket?.description ?? '')
    : descWords.slice(0, 80).join(' ') + '...';

  const canChat = ticket?.status !== 'draft';

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 4rem)', backgroundColor: THEME.colors.background }}
      >
        {/* Skeleton header */}
        <div
          className="flex-none flex items-center gap-3 px-4 sm:px-5 bg-white border-b"
          style={{ height: '3.5rem', borderColor: THEME.colors.light + '60' }}
        >
          <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse flex-none" />
          <div className="w-px h-5 bg-gray-200" />
          <div className="w-24 h-3.5 rounded bg-gray-200 animate-pulse" />
          <div className="w-20 h-6 rounded-full bg-gray-200 animate-pulse" />
          <div className="w-16 h-6 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 h-4 rounded bg-gray-200 animate-pulse" />
        </div>
        {/* Skeleton body */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4 sm:p-5 space-y-4">
            {[180, 120, 160, 100].map((h, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl animate-pulse"
                style={{ height: h, boxShadow: '0 2px 8px rgba(39,76,119,0.06)' }}
              />
            ))}
          </div>
          <div
            className="hidden lg:block w-[380px] xl:w-[420px] flex-none bg-white border-l animate-pulse"
            style={{ borderColor: THEME.colors.light + '60' }}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (error || !ticket) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: THEME.colors.background }}
      >
        <div
          className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
          style={{ boxShadow: '0 8px 32px rgba(39,76,119,0.12)' }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: THEME.colors.error + '15' }}
          >
            <XCircle className="w-7 h-7" style={{ color: THEME.colors.error }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: THEME.colors.primary }}>
            Ticket Not Found
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {error || 'This ticket does not exist or you do not have access.'}
          </p>
          <Button
            variant="primary"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => router.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex gap-4 p-4 overflow-hidden"
      style={{
        height: 'calc(100vh - 4rem)',
        background: `
          radial-gradient(1200px 600px at 0% 0%, ${THEME.colors.light}22 0%, transparent 55%),
          radial-gradient(900px 500px at 100% 100%, ${THEME.colors.medium}18 0%, transparent 60%),
          linear-gradient(180deg, ${THEME.colors.background} 0%, #EEF3F7 100%)
        `,
      }}
    >
      {/* Ambient dotted grid overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(${THEME.colors.medium}22 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />

      {/* ── LEFT: Chat hero (desktop 55%) ─────────────────────────────────── */}
      {canChat && (
        <div
          className={`
            relative flex-none flex-col overflow-hidden rounded-2xl bg-white
            ring-1 ring-black/[0.04]
            ${mobileTab === 'chat' ? 'flex w-full lg:w-[55%]' : 'hidden lg:flex lg:w-[55%]'}
          `}
          style={{ boxShadow: '0 10px 40px -12px rgba(39,76,119,0.18), 0 2px 8px rgba(39,76,119,0.06)' }}
        >
          <UnifiedChatPanel ticketId={ticket.id} mode="inline" />
        </div>
      )}

      {/* ── RIGHT: Sidebar (desktop 45%) ──────────────────────────────────── */}
      <div
        className={`
          relative overflow-y-auto space-y-3 pr-1
          ${canChat
            ? (mobileTab === 'chat' ? 'hidden lg:block lg:flex-none lg:w-[45%]' : 'flex-1 lg:flex-none lg:w-[45%]')
            : 'flex-1'}
        `}
      >
        {/* ── Ticket identity hero ─────────────────────────────────── */}
        <div
          className="relative bg-white rounded-2xl overflow-hidden ring-1 ring-black/[0.04]"
          style={{ boxShadow: '0 10px 30px -12px rgba(39,76,119,0.14), 0 2px 6px rgba(39,76,119,0.05)' }}
        >
          {/* Top gradient accent strip */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${THEME.colors.primary} 0%, ${THEME.colors.medium} 55%, ${THEME.colors.light} 100%)`,
            }}
          />
          {/* Corner decorative glyph */}
          <div
            className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.06]"
            style={{ backgroundColor: THEME.colors.primary }}
          />
          <div className="relative px-4 py-3.5 flex items-start gap-3">
            <button
              onClick={() => router.back()}
              className="flex-none mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95"
              style={{
                color: THEME.colors.primary,
                backgroundColor: THEME.colors.light + '30',
                border: `1px solid ${THEME.colors.light}60`,
              }}
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider"
                  style={{
                    color: THEME.colors.primary,
                    backgroundColor: THEME.colors.light + '40',
                    border: `1px solid ${THEME.colors.light}80`,
                  }}
                >
                  {ticket.ticketId}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
              <h1
                className="text-[15px] font-bold leading-snug tracking-tight"
                style={{ color: THEME.colors.primary }}
                title={ticket.subject}
              >
                {ticket.subject}
              </h1>
            </div>
            {/* Mobile: chat/details tab toggle */}
            {canChat && (
              <div
                className="lg:hidden flex-none flex items-center rounded-xl p-0.5"
                style={{ backgroundColor: THEME.colors.background }}
              >
                {(['details', 'chat'] as MobileTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setMobileTab(tab)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-all capitalize flex items-center gap-1"
                    style={{
                      backgroundColor: mobileTab === tab ? THEME.colors.white : 'transparent',
                      color: mobileTab === tab ? THEME.colors.primary : THEME.colors.gray,
                      boxShadow: mobileTab === tab ? '0 2px 6px rgba(39,76,119,0.12)' : 'none',
                    }}
                  >
                    {tab === 'chat' && <MessageSquare className="w-3 h-3" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Auto-close countdown */}
        {autoCloseCountdown && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm ring-1"
              style={{
                background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                boxShadow: '0 2px 12px rgba(59,130,246,0.12)',
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-none"
                style={{ backgroundColor: '#3B82F620' }}
              >
                <Clock className="w-4 h-4" style={{ color: '#1D4ED8' }} />
              </div>
              <span style={{ color: '#1E3A8A' }} className="text-[13px] leading-snug">
                Resolves automatically in&nbsp;
                <b className="font-bold">{autoCloseCountdown.days}d {autoCloseCountdown.hours}h</b>
                &nbsp;— confirm it's done to close now.
              </span>
            </div>
          )}

          {/* ── Role Actions (top of sidebar) ─────────────────────────── */}
          <RoleActionsPanel
            ticket={ticket}
            role={role}
            loading={processing}
            onModeratorAction={(action) => setModeratorModal(action)}
            onModeratorEdit={() => setShowEditModal(true)}
            onAssigneeAction={handleAssigneeAction}
            onRequestorAction={handleRequestorAction}
          />

          {/* ── SLA (no card wrapper — SLACard self-manages visibility) ── */}
          <SLACard
            submittedDate={ticket.submittedDate}
            dueDate={(ticket as any).dueDate}
            slaHours={(ticket as any).slaHours || 72}
            status={ticket.status}
          />

          {/* ── Overview ──────────────────────────────────────────────── */}
          <Card
            className="rounded-2xl border-0 overflow-hidden ring-1 ring-black/[0.04]"
            style={{ boxShadow: '0 4px 20px -8px rgba(39,76,119,0.12), 0 1px 3px rgba(39,76,119,0.04)' }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3.5">
                <div
                  className="h-3 w-0.5 rounded-full"
                  style={{ backgroundColor: THEME.colors.primary }}
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: THEME.colors.primary }}>
                  Overview
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { Icon: Building2, label: 'Department', value: ticket.department },
                  { Icon: Tag,       label: 'Category',   value: (ticket as any).category || '—' },
                  { Icon: User,      label: 'Requestor',  value: ticket.requestorName },
                  { Icon: User,      label: 'Assignee',   value: ticket.assigneeName || 'Unassigned' },
                ].map(({ Icon, label, value }) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-xl p-2.5 transition-colors hover:bg-opacity-80 flex items-start gap-2.5"
                    style={{ backgroundColor: THEME.colors.background + '80' }}
                  >
                    <div
                      className="flex-none w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: THEME.colors.white,
                        boxShadow: `inset 0 0 0 1px ${THEME.colors.light}80`,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: THEME.colors.medium }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: THEME.colors.gray }}>
                        {label}
                      </p>
                      <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: THEME.colors.primary }} title={value}>
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 pt-3 border-t text-[11px]"
                style={{ borderColor: THEME.colors.light + '50' }}
              >
                <span className="inline-flex items-center gap-1" style={{ color: THEME.colors.gray }}>
                  <Calendar className="w-3 h-3" />
                  Created&nbsp;
                  <b style={{ color: THEME.colors.primary }}>{formatRelativeTime(ticket.submittedDate)}</b>
                </span>
                {ticket.assignedDate && (
                  <span className="inline-flex items-center gap-1" style={{ color: THEME.colors.gray }}>
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: THEME.colors.light }} />
                    Assigned&nbsp;
                    <b style={{ color: THEME.colors.primary }}>{formatRelativeTime(ticket.assignedDate)}</b>
                  </span>
                )}
                {ticket.resolvedDate && (
                  <span className="inline-flex items-center gap-1" style={{ color: THEME.colors.gray }}>
                    <CheckCircle className="w-3 h-3" style={{ color: THEME.colors.success }} />
                    Resolved&nbsp;
                    <b style={{ color: THEME.colors.primary }}>{formatRelativeTime(ticket.resolvedDate)}</b>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Description ───────────────────────────────────────────── */}
          <Card
            className="rounded-2xl border-0 overflow-hidden ring-1 ring-black/[0.04] relative"
            style={{ boxShadow: '0 4px 20px -8px rgba(39,76,119,0.12), 0 1px 3px rgba(39,76,119,0.04)' }}
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
              style={{
                background: `linear-gradient(180deg, ${THEME.colors.primary} 0%, ${THEME.colors.medium} 100%)`,
              }}
            />
            <CardContent className="p-4 pl-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="h-3 w-0.5 rounded-full"
                  style={{ backgroundColor: THEME.colors.medium }}
                />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: THEME.colors.medium }}>
                  Description
                </p>
              </div>
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{displayDesc}</p>
              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:scale-[1.02]"
                  style={{
                    color: THEME.colors.primary,
                    backgroundColor: THEME.colors.light + '30',
                  }}
                >
                  {descExpanded
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Show More</>}
                </button>
              )}
            </CardContent>
          </Card>

          {/* ── Participants ──────────────────────────────────────────── */}
          <ParticipantsCard ticket={ticket} />

          {/* ── Attachments ───────────────────────────────────────────── */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <AttachmentsCard
              ticketAttachments={ticket.attachments}
              onDownload={(att: any) => window.open(typeof att === 'string' ? att : att.url, '_blank')}
            />
          )}

          {/* ── Timeline ──────────────────────────────────────────────── */}
          <TicketTimeline ticket={ticket} />

          <div className="h-4" />
        </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Feedback alert */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        buttonText="OK"
      />

      {/* Delete draft confirm */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteDraft}
        title="Delete Draft"
        description="Are you sure you want to permanently delete this draft? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />

      {/* ── Moderator modals ── */}
      {(role === 'moderator' || role === 'admin') && (
        <>
          <InitialReviewModal
            isOpen={showInitialReview}
            onClose={() => setShowInitialReview(false)}
            onConfirm={handleConfirmReview}
            onReject={handleReject}
            onPostpone={handlePostpone}
            ticket={ticket}
            assignees={assignees}
            loading={processing}
          />
          <EditTicketModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSave={handleUpdateTicket}
            ticket={ticket}
            loading={processing}
          />
          {moderatorModal === 'assign' && (
            <AssignTicketModal
              isOpen
              onClose={() => setModeratorModal(null)}
              onAssign={handleAssign}
              assignees={assignees}
              ticketSubject={ticket.subject}
              ticketDepartment={ticket.department}
            />
          )}
          {moderatorModal === 'reassign' && (
            <AssignTicketModal
              isOpen
              onClose={() => setModeratorModal(null)}
              onAssign={handleReassign}
              assignees={assignees}
              ticketSubject={ticket.subject}
              ticketDepartment={ticket.department}
              loading={processing}
            />
          )}
          {moderatorModal === 'reject' && (
            <RejectTicketModal
              isOpen
              onClose={() => setModeratorModal(null)}
              onConfirm={handleReject}
              ticketId={ticket.ticketId}
              ticketSubject={ticket.subject}
            />
          )}
          {moderatorModal === 'postpone' && (
            <PostponeModal
              isOpen
              onClose={() => setModeratorModal(null)}
              onConfirm={handlePostpone}
              ticketId={ticket.ticketId}
            />
          )}
          {moderatorModal === 'clarify' && (
            <ClarificationModal
              isOpen
              onClose={() => setModeratorModal(null)}
              onConfirm={handleClarify}
              ticketId={ticket.ticketId}
            />
          )}
        </>
      )}

      {/* ── Requestor modals ── */}
      <ResolveModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onResolve={handleResolve}
        onRequestRework={() => setShowResolveModal(false)}
      />
      <ReopenModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        onSubmit={handleReopen}
        reopenCount={reopenCount}
        maxReopens={2}
      />

      {/* ── Assignee: Progress modal ── */}
      {progressModal && (
        <InlineModal title="Update Progress" onClose={() => setProgressModal(false)}>
          <div className="mb-4">
            <div className="flex justify-between text-sm font-medium mb-2">
              <span style={{ color: THEME.colors.primary }}>Progress</span>
              <span style={{ color: THEME.colors.medium }}>{progressPct}%</span>
            </div>
            {/* Visual progress bar */}
            <div
              className="w-full h-2 rounded-full overflow-hidden mb-2"
              style={{ backgroundColor: THEME.colors.light }}
            >
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${progressPct}%`, backgroundColor: THEME.colors.medium }}
              />
            </div>
            <input
              type="range" min="0" max="100" value={progressPct}
              onChange={e => setProgressPct(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <textarea
            className="w-full rounded-xl text-sm resize-none p-3 mb-4 focus:outline-none focus:ring-2 border"
            style={{ borderColor: THEME.colors.light, minHeight: 80 }}
            placeholder="Notes (optional)..."
            value={progressNotes}
            onChange={e => setProgressNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setProgressModal(false)}>Cancel</Button>
            <Button variant="primary" fullWidth onClick={handleSaveProgress} loading={processing}>Save</Button>
          </div>
        </InlineModal>
      )}

      {/* ── Assignee: Complete modal ── */}
      {completeModal && (
        <InlineModal title="Complete Task" onClose={() => setCompleteModal(false)}>
          <textarea
            className="w-full rounded-xl text-sm resize-none p-3 mb-4 border focus:outline-none"
            style={{ borderColor: THEME.colors.light, minHeight: 100 }}
            placeholder="Completion notes (required)..."
            value={completeNotes}
            onChange={e => setCompleteNotes(e.target.value)}
          />
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1.5" style={{ color: THEME.colors.gray }}>
              Attach proof of completion (optional)
            </p>
            <input
              type="file"
              className="text-sm w-full"
              onChange={e => setCompleteFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setCompleteModal(false)}>Cancel</Button>
            <Button variant="success" fullWidth onClick={handleComplete} loading={processing}>
              Mark Complete
            </Button>
          </div>
        </InlineModal>
      )}

      {/* ── Assignee: Postpone modal ── */}
      {assigneePostponeModal && (
        <InlineModal title="Request Postponement" onClose={() => setAssigneePostponeModal(false)}>
          <textarea
            className="w-full rounded-xl text-sm resize-none p-3 mb-4 border focus:outline-none"
            style={{ borderColor: THEME.colors.light, minHeight: 90 }}
            placeholder="Reason for postponement..."
            value={postponeReason}
            onChange={e => setPostponeReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setAssigneePostponeModal(false)}>Cancel</Button>
            <Button variant="primary" fullWidth onClick={handleAssigneePostpone} loading={processing}>Submit</Button>
          </div>
        </InlineModal>
      )}

    </div>
  );
}
