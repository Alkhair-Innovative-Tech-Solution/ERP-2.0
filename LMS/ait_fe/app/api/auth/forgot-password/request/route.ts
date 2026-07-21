// app/api/auth/forgot-password/route.ts

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email } = await request.json()
  if (!email) {
    return NextResponse.json({ message: 'Email is required' }, { status: 400 })
  }

  try {
    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const apiRes = await fetch(
      `${baseUrl}/api/auth/forgot-password/request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    )
    const data = await apiRes.json()
    return NextResponse.json(data, { status: apiRes.status })
  } catch (err) {
    console.error('🔴 forgot-password/request error:', err)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

