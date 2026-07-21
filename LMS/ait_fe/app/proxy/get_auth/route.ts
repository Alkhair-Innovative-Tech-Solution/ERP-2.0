import { getToken, refreshToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Extract the API endpoint from query params
    const path = req.nextUrl.searchParams.get("url");
    // 🔹 Multi-Tenancy: Get org_id from query params or headers
    const orgId = req.nextUrl.searchParams.get("org_id") || req.headers.get("x-org-id") || "";
    const campusId = req.nextUrl.searchParams.get("campus_id") || req.headers.get("x-campus-id") || "";
    let accessToken = await getToken();

    if (!path) {
      return NextResponse.json({ message: "Missing 'url' parameter", status: 400 });
    }

    // Make the request
    const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const makeRequest = async (token: string) => {
      return await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // 🔹 Multi-Tenancy: Pass org_id and campus_id headers
          ...(orgId ? { "X-Org-Id": orgId } : {}),
          ...(campusId ? { "X-Campus-Id": campusId } : {}),
        },
      });
    };

    let res = await makeRequest(accessToken || '');
    let responseData;
    console.log(res);

    try {
      responseData = await res.json();
    } catch (error) {
      console.error("Failed to parse response as JSON:", error);
      return NextResponse.json({
        error: "Invalid response from server. Please try again later.",
        status: 500
      });
    }

    // If token is invalid/expired, try to refresh it
    if (res.status === 401 && responseData.code === 'token_not_valid') {
      try {
        const newAccessToken = await refreshToken();
        if (!newAccessToken) {
          throw new Error("Failed to refresh token");
        }
        res = await makeRequest(newAccessToken);
        responseData = await res.json();
      } catch (error) {
        console.error("Token refresh failed:", error);
        return NextResponse.json({
          error: "Authentication failed. Please login again.",
          status: 401
        });
      }
    }

    if (res.ok) {
      // Return the data directly if it's already in the correct format
      if (responseData.data) {
        return NextResponse.json(responseData);
      }
      // Otherwise wrap it in a data property
      return NextResponse.json({ data: responseData });
    } else {
      return NextResponse.json({
        error: responseData.message || "Failed to fetch data",
        status: res.status
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      error: "An unexpected error occurred",
      status: 500
    });
  }
}
