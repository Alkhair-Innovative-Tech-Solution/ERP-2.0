import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, otp, new_password } = await request.json()
  if (!email || !otp || !new_password) {
    return NextResponse.json(
      { message: 'Email, OTP and new password are required' },
      { status: 400 }
    )
  }

  try {
    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const apiRes = await fetch(
      `${baseUrl}/api/auth/forgot-password/reset`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password }),
      }
    )
    const data = await apiRes.json()
    return NextResponse.json(data, { status: apiRes.status })
  } catch (err) {
    console.error('🔴 forgot-password/reset error:', err)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
