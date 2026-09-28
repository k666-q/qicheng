import { NextRequest } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";
import { recordEvent } from "@/lib/admin/usage-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "track", POLICIES.cheap);
  if (limited) return limited;
  try {
    const body = await req.json();
    const userId = body.userId || "anonymous";
    const event = body.event || "unknown";
    const meta = body.meta || {};

    recordEvent(userId, event, meta);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }
}
