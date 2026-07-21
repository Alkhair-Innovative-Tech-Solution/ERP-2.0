import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  try {
    // Extract the API endpoint from query params
    const path = req.nextUrl.searchParams.get("url");
    // 🔹 Multi-Tenancy: Get org_id from query params or headers
    const orgId = req.nextUrl.searchParams.get("org_id") || req.headers.get("x-org-id") || "";
    const campusId = req.nextUrl.searchParams.get("campus_id") || req.headers.get("x-campus-id") || "";

    if (!path) {
      return NextResponse.json({ message: "Missing 'url' parameter", status: 400 });
    } else {
      console.log("ye lo path :", path)
    }

    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const targetUrl = `${baseUrl}${path}`;
    console.log(`[Proxy Debug] Fetching: ${targetUrl}`);
    console.log(`[Proxy Debug] API_GATEWAY_URL: ${process.env.API_GATEWAY_URL}`);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // 🔹 Multi-Tenancy: Pass org_id and campus_id headers
        ...(orgId ? { "X-Org-Id": orgId } : {}),
        ...(campusId ? { "X-Campus-Id": campusId } : {}),
      },
    });

    const responseData = await res.json();

    console.log(responseData)
    if (res.ok) {
      return NextResponse.json({ data: responseData, status: 200 });
    } else {
      return NextResponse.json({ message: responseData.message || "Failed to fetch data", status: res.status });
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ message: "An unexpected error occurred", status: 500 });
  }
}
