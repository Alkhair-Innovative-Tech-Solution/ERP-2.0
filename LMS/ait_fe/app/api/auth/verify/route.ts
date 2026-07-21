// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken, getRefreshToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = await getToken();
  const refreshToken = await getRefreshToken();


  if (token && refreshToken) {
    return NextResponse.json({ authenticated: true });
  } 
  return NextResponse.json({ authenticated: false });
}


