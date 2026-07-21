/**
 * Ticket Store (Zustand)
 * Global state for tickets cache and active ticket
 */

import { create } from 'zustand';
import { Ticket } from '../types';

interface TicketState {
  tickets: Ticket[];
  activeTicket: Ticket | null;
  filters: {
    status?: string;
    priority?: string;
    department?: string;
    search?: string;
  };
  
  // Actions
  setTickets: (tickets: Ticket[]) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (id: string, updates: Partial<Ticket>) => void;
  removeTicket: (id: string) => void;
  setActiveTicket: (ticket: Ticket | null) => void;
  setFilters: (filters: TicketState['filters']) => void;
  clearFilters: () => void;
}

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  activeTicket: null,
  filters: {},

  setTickets: (tickets) => set({ tickets }),

  addTicket: (ticket) => set((state) => ({
    tickets: [ticket, ...state.tickets],
  })),

  updateTicket: (id, updates) => set((state) => ({
    tickets: state.tickets.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ),
    activeTicket: state.activeTicket?.id === id
      ? { ...state.activeTicket, ...updates }
      : state.activeTicket,
  })),

  removeTicket: (id) => set((state) => ({
    tickets: state.tickets.filter(t => t.id !== id),
    activeTicket: state.activeTicket?.id === id ? null : state.activeTicket,
  })),

  setActiveTicket: (ticket) => set({ activeTicket: ticket }),

  setFilters: (filters) => set({ filters }),

  clearFilters: () => set({ filters: {} }),
}));

