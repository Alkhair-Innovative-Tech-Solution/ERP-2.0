/**
 * Auth Store (Zustand)
 * Global state for authentication and user session
 */

import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  login: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,

  setUser: (user) => {
    // Sync with localStorage
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    }

    set({
      user,
      isAuthenticated: !!user
    });
  },

  setToken: (token) => {
    // Sync with localStorage
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }

    set({ token });
  },

  setRefreshToken: (refreshToken) => {
    // Sync with localStorage
    if (typeof window !== 'undefined') {
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
    }

    set({ refreshToken });
  },

  login: (user, token, refreshToken) => {
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    }

    set({
      user,
      token,
      refreshToken: refreshToken || null,
      isAuthenticated: true,
      loading: false
    });
  },

  logout: () => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false
    });
  },

  setLoading: (loading) => set({ loading }),
}));
