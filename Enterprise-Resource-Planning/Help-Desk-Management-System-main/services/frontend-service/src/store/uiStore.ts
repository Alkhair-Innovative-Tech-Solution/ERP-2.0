/**
 * UI Store (Zustand)
 * Global state for UI elements (sidebar, modals, theme, etc.)
 */

import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  theme: 'light' | 'dark';
  toast: {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    visible: boolean;
  } | null;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  showToast: (message: string, type?: UIState['toast']['type']) => void;
  hideToast: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  theme: 'light',
  toast: null,

  toggleSidebar: () => set((state) => ({ 
    sidebarOpen: !state.sidebarOpen 
  })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openModal: (modalId) => set({ activeModal: modalId }),

  closeModal: () => set({ activeModal: null }),

  showToast: (message, type = 'info') => set({
    toast: { message, type, visible: true },
  }),

  hideToast: () => set({ toast: null }),

  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  },
}));

