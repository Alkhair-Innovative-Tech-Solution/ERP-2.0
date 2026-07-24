import { create } from "zustand";

interface AuthStore {
  isAuthenticated: boolean;
  username: string | null;
  setAuth: (username: string) => void;
  clearAuth: () => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  username: null,
  setAuth: (username) => set({ isAuthenticated: true, username }),
  clearAuth: () => set({ isAuthenticated: false, username: null }),
  checkAuth: () => {
    if (typeof window === "undefined") return false;
    const token = localStorage.getItem("access_token");
    return !!token;
  },
}));
