import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const path = req.nextUrl.pathname.replace(/^\/api\/admission/, "");
        const rawBody = await req.text();
        console.log(`📥 Incoming POST to /api/admission${path}, body length: ${rawBody.length}`);

        let body = {};
        if (rawBody) {
            try {
                body = JSON.parse(rawBody);
            } catch (e) {
                console.error(`❌ Failed to parse JSON body: "${rawBody.substring(0, 100)}..."`);
                return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
            }
        }

        const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        // Ensure trailing slash for Django
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;
        const targetUrl = `${baseUrl}/api/admission${normalizedPath}`;

        console.log(`🚀 Proxying POST to: ${targetUrl}`);

        const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: rawBody || JSON.stringify({}),
        });

        console.log(`✅ Backend response: ${res.status} for ${targetUrl}`);

        const contentType = res.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        } else {
            const text = await res.text();
            console.error(`❌ Non-JSON response from ${targetUrl}: ${text.substring(0, 200)}`);
            return NextResponse.json({
                error: "Backend returned non-JSON response",
                details: text.substring(0, 200)
            }, { status: res.status || 500 });
        }
    } catch (error: any) {
        console.error("❌ Admission proxy POST error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const path = req.nextUrl.pathname.replace(/^\/api\/admission/, "");
        const baseUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        // Ensure trailing slash for Django
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;
        const targetUrl = `${baseUrl}/api/admission${normalizedPath}`;

        console.log(`🚀 Proxying GET to: ${targetUrl}`);

        const res = await fetch(targetUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        const contentType = res.headers.get("content-type");

        // Check if response is JSON
        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            return NextResponse.json(data, { status: res.status });
        } else {
            // If not JSON, return text
            const text = await res.text();
            console.error(`❌ Non-JSON response: ${text.substring(0, 200)}`);
            return NextResponse.json({
                error: "Backend returned non-JSON response",
                details: text.substring(0, 200)
            }, { status: res.status || 500 });
        }
    } catch (error: any) {
        console.error("❌ Admission proxy GET error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
