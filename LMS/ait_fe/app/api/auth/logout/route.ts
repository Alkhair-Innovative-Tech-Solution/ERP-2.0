import { deleteTokens } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
    console.log("✅ Sending logout request to backend")
    try {
        const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });

        // Always delete tokens, even if backend fails
        await deleteTokens();

        if (res.ok) {
            console.log("✅ Backend logout successful");
            return NextResponse.json({ message: "success", status: 200 });
        } else {
            console.warn(`⚠️ Backend logout failed with status ${res.status}, but tokens cleared`);
            return NextResponse.json({ message: "success", status: 200 }); // Still return success since tokens are cleared
        }

    } catch (error) {
        console.error("❌ Logout error:", error);
        await deleteTokens(); // Always delete tokens even on error
        return NextResponse.json({ message: "success", status: 200 }); // Return success since tokens are cleared
    }
}
