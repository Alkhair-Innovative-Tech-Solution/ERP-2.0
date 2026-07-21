"use client"

import { useUser } from "@/hooks/use-user";
import { useSignIn } from "@/hooks/user-signed-in";
import { useRouter } from "next/navigation";


const useHandldeLogout = () => {
    const router = useRouter()

    const handleLogout = async () => {
        try {
            const res = await fetch("/api/auth/logout/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            })

            if (res.ok) {
                const data = await res.json()
                if (data?.status == 200) {
                    console.log("✅ Logout successful from backend")
                    triggerLogout()
                    return true;
                }
            } else if (res.status === 404) {
                console.warn("⚠️ User session not found (404). Clearing local state anyway")
                triggerLogout();
                return true;
            } else {
                console.warn(`⚠️ Backend logout failed with status ${res.status}. Clearing local state anyway`)
                triggerLogout(); // Clear local state even if backend fails
                return true;
            }
        } catch (error) {
            console.error("❌ Error during logout:", error)
            console.log("🔄 Clearing local state despite error")
            triggerLogout(); // Always clear local state to prevent orphaned sessions
            return false;
        }

        function triggerLogout() {
            useUser.getState().setUser(null)
            useSignIn.getState().setSignedIn(false)
            console.log("🧹 Cleared user from local storage")
            router.push("/")
        }
    }

    return handleLogout;
};

export default useHandldeLogout;

