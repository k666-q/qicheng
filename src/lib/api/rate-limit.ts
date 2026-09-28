// 轻量限流：按 IP + 路由的滑动窗口，内存实现。
// Serverless 下是"每实例"粒度，无法做到全局精确，但足以拦住朴素脚本刷接口。
// 需要全局精确时替换为 Upstash/Redis 实现，接口不变。

import type { NextRequest } from "next/server";

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type RateLimitPolicy = {
  perMinute: number;
  perDay: number;
};

export const POLICIES = {
  /** 普通 LLM 对话/生成路由 */
  llm: { perMinute: 20, perDay: 200 } as RateLimitPolicy,
  /** 重型：计划生成 */
  heavy: { perMinute: 6, perDay: 60 } as RateLimitPolicy,
  /** Manim 渲染：执行 AI 生成代码，最严格 */
  manim: { perMinute: 3, perDay: 20 } as RateLimitPolicy,
  /** 埋点等廉价接口 */
  cheap: { perMinute: 120, perDay: 5000 } as RateLimitPolicy,
};

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function prune(bucket: Bucket, now: number) {
  const cutoff = now - DAY;
  while (bucket.hits.length && bucket.hits[0] < cutoff) bucket.hits.shift();
}

// 定期清理空桶，防止内存无限增长
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 10 * MINUTE) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    prune(b, now);
    if (b.hits.length === 0) buckets.delete(k);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; reason: "minute" | "day" };

export function checkRateLimit(req: NextRequest, route: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const key = `${route}:${clientIp(req)}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, now);

  const lastMinute = bucket.hits.filter((t) => t > now - MINUTE).length;
  if (lastMinute >= policy.perMinute) {
    const oldest = bucket.hits.find((t) => t > now - MINUTE) ?? now;
    return { ok: false, retryAfterSec: Math.ceil((oldest + MINUTE - now) / 1000), reason: "minute" };
  }
  if (bucket.hits.length >= policy.perDay) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.hits[0] + DAY - now) / 1000), reason: "day" };
  }

  bucket.hits.push(now);
  return { ok: true };
}

/** 一行接入：超限时返回 429 Response，否则返回 null */
export function rateLimitGuard(req: NextRequest, route: string, policy: RateLimitPolicy): Response | null {
  const r = checkRateLimit(req, route, policy);
  if (r.ok) return null;
  return new Response(
    JSON.stringify({
      success: false,
      error: r.reason === "minute" ? "请求太频繁，请稍后再试" : "今日额度已用完，明天再来",
      retryAfter: r.retryAfterSec,
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(r.retryAfterSec) },
    }
  );
}
