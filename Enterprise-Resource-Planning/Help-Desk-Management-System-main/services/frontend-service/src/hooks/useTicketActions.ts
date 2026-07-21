/**
 * useTicketActions Hook
 * Centralized ticket mutation logic
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ticketService, CreateTicketData, UpdateTicketData } from '../services/api/ticketService';
import { useTicketStore } from '../store/ticketStore';
import { useUIStore } from '../store/uiStore';
import { Ticket } from '../types';

export const useTicketActions = () => {
  const router = useRouter();
  const { addTicket, updateTicket, removeTicket, setActiveTicket } = useTicketStore();
  const { showToast } = useUIStore();

  /**
   * Create new ticket
   */
  const createTicket = useCallback(async (data: CreateTicketData): Promise<Ticket | null> => {
    try {
      const ticket = await ticketService.createTicket(data);
      addTicket(ticket);
      showToast('Ticket created successfully', 'success');
      router.push(`/requestor/ticket/${ticket.id}`);
      return ticket;
    } catch (error: any) {
      showToast(error.message || 'Failed to create ticket', 'error');
      return null;
    }
  }, [addTicket, showToast, router]);

  /**
   * Update ticket
   */
  const updateTicketAction = useCallback(async (
    id: string,
    data: UpdateTicketData
  ): Promise<Ticket | null> => {
    try {
      const ticket = await ticketService.updateTicket(id, data);
      updateTicket(id, ticket);
      showToast('Ticket updated successfully', 'success');
      return ticket;
    } catch (error: any) {
      showToast(error.message || 'Failed to update ticket', 'error');
      return null;
    }
  }, [updateTicket, showToast]);

  /**
   * Assign ticket
   */
  const assignTicket = useCallback(async (
    ticketId: string,
    assigneeId: string
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.assignTicket(ticketId, assigneeId);
      updateTicket(ticketId, ticket);
      showToast('Ticket assigned successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to assign ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Reassign ticket
   */
  const reassignTicket = useCallback(async (
    ticketId: string,
    assigneeId: string,
    reason: string
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.reassignTicket(ticketId, assigneeId, reason);
      updateTicket(ticketId, ticket);
      showToast('Ticket reassigned successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to reassign ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Change ticket status
   */
  const changeStatus = useCallback(async (
    ticketId: string,
    status: string,
    note?: string
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.changeStatus(ticketId, status, note);
      updateTicket(ticketId, ticket);
      showToast('Status updated successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to update status', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Change ticket priority
   */
  const changePriority = useCallback(async (
    ticketId: string,
    priority: string
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.changePriority(ticketId, priority);
      updateTicket(ticketId, ticket);
      showToast('Priority updated successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to update priority', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Approve ticket
   */
  const approveTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    try {
      const ticket = await ticketService.approveTicket(ticketId);
      updateTicket(ticketId, ticket);
      showToast('Ticket approved successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to approve ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Reject ticket
   */
  const rejectTicket = useCallback(async (
    ticketId: string,
    reason: string
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.rejectTicket(ticketId, reason);
      updateTicket(ticketId, ticket);
      showToast('Ticket rejected', 'warning');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to reject ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Complete ticket
   */
  const completeTicket = useCallback(async (
    ticketId: string,
    note: string,
    image?: File
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.completeTicket(ticketId, note, image);
      updateTicket(ticketId, ticket);
      showToast('Ticket completed successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to complete ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Split ticket
   */
  const splitTicket = useCallback(async (
    ticketId: string,
    subtickets: Array<{ subject: string; description: string }>
  ): Promise<boolean> => {
    try {
      const ticket = await ticketService.splitTicket(ticketId, subtickets);
      updateTicket(ticketId, ticket);
      showToast('Ticket split successfully', 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to split ticket', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  /**
   * Delete ticket
   */
  const deleteTicket = useCallback(async (ticketId: string): Promise<boolean> => {
    try {
      await ticketService.deleteTicket(ticketId);
      removeTicket(ticketId);
      showToast('Ticket deleted successfully', 'success');
      router.push('/admin/requests');
      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to delete ticket', 'error');
      return false;
    }
  }, [removeTicket, showToast, router]);

  /**
   * Add comment
   */
  const addComment = useCallback(async (
    ticketId: string,
    content: string
  ): Promise<boolean> => {
    try {
      const comment = await ticketService.addComment(ticketId, content);
      const { activeTicket } = useTicketStore.getState();

      if (activeTicket?.id === ticketId) {
        const comments = activeTicket.comments || [];
        updateTicket(ticketId, {
          comments: [...comments, comment],
        });
      }

      return true;
    } catch (error: any) {
      showToast(error.message || 'Failed to add comment', 'error');
      return false;
    }
  }, [updateTicket, showToast]);

  return {
    createTicket,
    updateTicket: updateTicketAction,
    assignTicket,
    reassignTicket,
    changeStatus,
    changePriority,
    approveTicket,
    rejectTicket,
    completeTicket,
    splitTicket,
    deleteTicket,
    addComment,
    setActiveTicket,
  };
};

