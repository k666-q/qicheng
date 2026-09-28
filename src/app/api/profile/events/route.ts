import { NextRequest, NextResponse } from "next/server";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req, "profile-events", POLICIES.cheap);
  if (limited) return limited;
  try {
    const body = await req.json();
    const events = body.events as { event_type: string; event_data?: Record<string, unknown> }[];

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // MVP: just acknowledge. Events are stored client-side in localStorage.
    // When auth is added, this will write to Supabase profile_events table.
    return NextResponse.json({ success: true, count: events.length });
  } catch {
    return NextResponse.json({ success: true });
  }
}
