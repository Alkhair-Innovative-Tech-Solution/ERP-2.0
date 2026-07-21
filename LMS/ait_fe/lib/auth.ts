import { cookies } from "next/headers";

const AUTH_TOKEN_LIFE = 43200; // 12 hours in seconds (12 * 60 * 60)
const REFRESH_TOKEN_NAME = "auth-refresh-token";
const TOKEN_NAME = "auth-token";

// Get Access Token
export async function getToken() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get(TOKEN_NAME);
    return authToken?.value;
}

// Get Refresh Token
export async function getRefreshToken() {
    const cookieStore = await cookies();
    const authToken = cookieStore.get(REFRESH_TOKEN_NAME);
    return authToken?.value;
}

// Set Access Token
export async function setToken(authToken: string) {
    const cookieStore = await cookies();
    cookieStore.set({
        name: TOKEN_NAME,
        value: authToken,
        httpOnly: true,
        sameSite: "strict",
        maxAge: AUTH_TOKEN_LIFE,
        secure: process.env.NODE_ENV === "production",
    });
}

// Set Refresh Token
export async function setReFreshToken(authRefreshToken: string) {
    const cookieStore = await cookies();
    cookieStore.set({
        name: REFRESH_TOKEN_NAME,
        value: authRefreshToken,
        httpOnly: true,
        sameSite: "strict",
        maxAge: AUTH_TOKEN_LIFE,
        secure: process.env.NODE_ENV === "production",
    });
}

// Refresh Access Token
export async function refreshToken() {
    try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
            throw new Error("No refresh token available");
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!res.ok) {
            throw new Error("Failed to refresh token");
        }

        const data = await res.json();
        if (data.access) {
            await setToken(data.access);
            return data.access;
        }
        throw new Error("No access token in refresh response");
    } catch (error) {
        console.error("Token refresh failed:", error);
        await deleteTokens();
        throw error;
    }
}

// Delete Tokens (Logout)
export async function deleteTokens() {
    const cookieStore = await cookies();
    cookieStore.set({
        name: TOKEN_NAME,
        value: "",
        maxAge: -1,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });

    cookieStore.set({
        name: REFRESH_TOKEN_NAME,
        value: "",
        maxAge: -1,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });

    // Also clear bridge token
    cookieStore.set({
        name: "lms_bridge_token",
        value: "",
        maxAge: -1,
        httpOnly: false, // Accessible by JS
        sameSite: "lax", // Allow sharing on same domain
        secure: false, // Allow on localhost http
        path: "/"
    });
}

// Set LMS Bridge Token (Non-HttpOnly, for sharing with LMS frontend via document.cookie)
export async function setLmsBridgeToken(token: string) {
    const cookieStore = await cookies();
    cookieStore.set({
        name: "lms_bridge_token",
        value: token,
        httpOnly: false, // Intentionally false so client-side LMS can read it
        sameSite: "lax",
        maxAge: 60 * 5, // Short lived (5 mins) just for handover
        secure: false, // Allow on localhost http
        path: "/"
    });
}
