import { NextRequest, NextResponse } from 'next/server';
import { setReFreshToken, setToken, setLmsBridgeToken } from "@/lib/auth";
import { useUser } from '@/hooks/use-user';
import { useSignIn } from '@/hooks/user-signed-in';

export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: "Username and password required", status: 400 });
    }

    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Try lead login endpoint first for multi-credential support (CNIC, Student ID, Lead ID, email)
    const leadRes = await fetch(`${baseUrl}/api/auth/lead/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: email, password }),
    });

    if (leadRes.ok) {
      const leadData = await leadRes.json();
      const access = leadData.access || leadData.access_token || leadData.token;
      const refresh = leadData.refresh || leadData.refresh_token;
      if (access && refresh) {
        await setReFreshToken(refresh);
        await setToken(access);
        await setLmsBridgeToken(access);
        await useUser.getState().setUser(leadData.user);
        await useSignIn.getState().setSignedIn(true);
      }
      return NextResponse.json({ user: leadData.user, account_type: leadData.account_type || 'lead', lead: leadData.lead, status: 200 });
    }

    // Fallback to standard login
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const responseData = await res.json();
    console.log("responseData :", responseData);

    // Check if backend returned a special status (e.g., 301 for redirection)
    if (responseData.status === 301) {
      return NextResponse.json({ message: responseData.message || "Redirect status", status: 301 });
    } else if (res.ok) {
      // Validate that tokens are present before setting them
      const access = responseData.access || responseData.access_token || responseData.token;
      const refresh = responseData.refresh || responseData.refresh_token;

      if (access && refresh) {
        await setReFreshToken(refresh);
        await setToken(access);
        await setLmsBridgeToken(access); // Bridge to LMS
        await useUser.getState().setUser(responseData.user)
        await useSignIn.getState().setSignedIn(true)
      } else {
        console.warn("Tokens missing in response");
      }
      const user = responseData.user;
      return NextResponse.json({ user, status: 200 });
    } else {
      return NextResponse.json({
        message: responseData.message || "Failed to process login",
        status: res.status,
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Internal Server Error", status: 500 });
  }
}
