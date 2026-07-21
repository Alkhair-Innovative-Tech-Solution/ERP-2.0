//user signed in
import { persist } from "zustand/middleware";
import { create } from "zustand";

interface UserSignedInState {
  signedIn: boolean; // Changed Boolean to boolean
  setSignedIn: (signedIn: boolean) => void;
}

export const useSignIn = create<UserSignedInState>()(
  persist(
    (set) => ({
      signedIn: false,
      setSignedIn: (signedIn: boolean) => set({ signedIn }), // Changed any to boolean
    }),
    {
      name: "is-Login",
      partialize: (state: UserSignedInState) => ({ signedIn: state.signedIn }), // Use proper type
      onRehydrateStorage: () => (state) => {
        if (state?.signedIn) {
          console.log("Sign-in state rehydrated");
        }
      },
      skipHydration: true, // Skip initial hydration to prevent errors
    }
  )
);
