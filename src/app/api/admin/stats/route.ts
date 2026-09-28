import { NextRequest } from "next/server";
import { getStats } from "@/lib/admin/usage-store";
import { rateLimitGuard, POLICIES } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = rateLimitGuard(req, "admin-stats", POLICIES.llm);
  if (limited) return limited;

  // 没有配置 ADMIN_TOKEN 时接口直接关闭（fail closed），不再有默认口令
  const expected = process.env.ADMIN_TOKEN;
  const token = req.headers.get("x-admin-token");
  if (!expected || !token || token !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stats = getStats();
  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json" },
  });
}
