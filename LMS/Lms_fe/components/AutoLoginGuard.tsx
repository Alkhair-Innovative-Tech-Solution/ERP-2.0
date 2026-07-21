"use client";

import { useEffect } from "react";
import { authAPI } from "@/lib/api";
import { getRoleDashboardPath, UserRole } from "@/lib/auth";

export default function AutoLoginGuard() {
    useEffect(() => {
        const checkBridgeToken = async () => {
            // 1. Check if we already have a session (avoid unnecessary work)
            const existingToken = localStorage.getItem("lms_token");
            if (existingToken) return;

            // 2. Check for bridge cookie from AIT FE
            // Simple parse
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
            };

            const token = getCookie("lms_bridge_token");

            if (token) {
                console.log("Bridge token found. Attempting auto-login...");

                // Temporarily set token so API client uses it
                localStorage.setItem("lms_token", token);

                try {
                    // 3. Verify token and get user info
                    const user = await authAPI.getCurrentUser();

                    if (user) {
                        console.log("Bridge login success. User:", user);
                        localStorage.setItem("lms_user", JSON.stringify(user));

                        // 4. Clear bridge cookie so we don't loop or reuse
                        document.cookie = "lms_bridge_token=; path=/; max-age=0";

                        // 5. Redirect to correct dashboard
                        // Check if getRoleDashboardPath exists and is exported
                        // If not, default to /dashboard
                        const targetPath = user.role ? getRoleDashboardPath(user.role as UserRole) : '/dashboard';
                        window.location.href = targetPath;
                    }
                } catch (error) {
                    console.error("Bridge login failed:", error);
                    // Clean up if invalid
                    localStorage.removeItem("lms_token");
                    // Optionally clear cookie to stop retrying
                    document.cookie = "lms_bridge_token=; path=/; max-age=0";
                }
            }
        };

        checkBridgeToken();
    }, []);

    return null;
}
