import { NextRequest } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://ai-service:8014";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const auth = req.headers.get("authorization") || "";

  const upstream = await fetch(`${AI_SERVICE}/api/ai/chat/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body,
  });

  // Stream SSE response back to browser
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
