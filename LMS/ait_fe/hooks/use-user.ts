//use user

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  user: any | null;
  setUser: (user: any | null) => void;
}

export const useUser = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: "user-storage",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          console.log("User state rehydrated");
        }
      },
      skipHydration: true, // Skip initial hydration to prevent errors
    }
  )
);
