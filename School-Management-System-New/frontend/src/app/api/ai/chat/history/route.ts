import { NextRequest } from "next/server";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://ai-service:8014";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const conv = req.nextUrl.searchParams.get("conversation_id") || "";
  const qs = conv ? `?conversation_id=${conv}` : "";
  const upstream = await fetch(`${AI_SERVICE}/api/ai/history/${qs}`, {
    headers: { Authorization: auth },
  });
  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
