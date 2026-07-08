/**
 * 客户端埋点上报。
 * 在关键动作处调用，数据发送到 /api/track 由服务端存储。
 */

export function trackUsage(event: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const userId = localStorage.getItem("qc_anonymous_id") || "anonymous";

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, event, meta }),
  }).catch(() => {});
}
