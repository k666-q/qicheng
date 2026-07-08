"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, signOut } from "@/lib/auth/local";
import { CosmicBackground } from "@/components/universe/CosmicBackground";

const ADMIN_TOKEN = "nexiova-admin-2026";

type Stats = {
  totalUsers: number;
  todayActive: number;
  weekActive: number;
  totalEvents: number;
  todayEvents: number;
  aiByEndpoint: Record<string, { total: number; today: number }>;
  topAIUsers: { id: string; count: number }[];
  activeUsers: { id: string; firstSeen: string; lastSeen: string; eventCount: number }[];
  recentEvents: { userId: string; event: string; timestamp: string; meta?: Record<string, unknown> }[];
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-cyan-400/15 bg-[#0c0c18]/80 backdrop-blur-md p-5">
      <div className="text-[11px] text-white/35 tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold font-mono text-cyan-300">{value}</div>
      {sub && <div className="text-[10px] text-white/25 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "ai" | "users" | "events">("overview");

  const user = typeof window !== "undefined" ? getUser() : null;

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/login");
      return;
    }
    fetchStats();
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-token": ADMIN_TOKEN },
      });
      if (!res.ok) throw new Error("Unauthorized");
      setStats(await res.json());
    } catch {
      setError("无法加载数据");
    }
  }, []);

  if (!user || user.role !== "admin") {
    return <div className="min-h-screen bg-[#050510] flex items-center justify-center text-white/30 text-sm">无权限</div>;
  }

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      <CosmicBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 text-cyan-300 text-sm font-bold bg-black/40">
            N
          </div>
          <span className="text-sm font-semibold text-white/60 tracking-wider">Admin Panel</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchStats} className="text-xs text-cyan-300/60 hover:text-cyan-300 transition-colors">
            刷新
          </button>
          <button
            onClick={() => { signOut(); router.push("/"); }}
            className="text-xs text-white/30 hover:text-red-300 transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-8">
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Tab Nav */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] rounded-lg p-1 w-fit">
          {(["overview", "ai", "users", "events"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium tracking-wider rounded-md transition-all ${
                tab === t
                  ? "bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)_inset]"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {{ overview: "概览", ai: "AI 用量", users: "用户", events: "事件流" }[t]}
            </button>
          ))}
        </div>

        {!stats ? (
          <p className="text-white/30 text-sm animate-pulse">加载中...</p>
        ) : (
          <>
            {/* 概览 */}
            {tab === "overview" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="总用户数" value={stats.totalUsers} />
                <StatCard label="今日活跃" value={stats.todayActive} />
                <StatCard label="7 日活跃" value={stats.weekActive} />
                <StatCard label="总事件数" value={stats.totalEvents} sub={`今日 ${stats.todayEvents}`} />
              </div>
            )}

            {/* AI 用量 */}
            {tab === "ai" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-white/50 mb-3 tracking-wider">按接口分组</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(stats.aiByEndpoint).map(([ep, v]) => (
                      <div key={ep} className="rounded-xl border border-white/5 bg-[#0c0c18]/60 p-4 flex items-center justify-between">
                        <span className="text-xs font-mono text-white/60">{ep}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-cyan-300">{v.total}</span>
                          <span className="text-[10px] text-white/25 ml-2">今日 {v.today}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(stats.aiByEndpoint).length === 0 && (
                      <p className="text-white/20 text-xs">暂无 AI 调用记录</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/50 mb-3 tracking-wider">Top 用户用量</h3>
                  <div className="space-y-2">
                    {stats.topAIUsers.map((u, i) => (
                      <div key={u.id} className="flex items-center gap-3 text-xs">
                        <span className="w-5 text-right text-white/20 font-mono">{i + 1}</span>
                        <span className="font-mono text-white/50 truncate flex-1">{u.id.slice(0, 12)}...</span>
                        <span className="font-mono text-cyan-300">{u.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 用户列表 */}
            {tab === "users" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-2 px-3 font-medium tracking-wider">用户 ID</th>
                      <th className="text-left py-2 px-3 font-medium tracking-wider">首次</th>
                      <th className="text-left py-2 px-3 font-medium tracking-wider">最近</th>
                      <th className="text-right py-2 px-3 font-medium tracking-wider">事件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.activeUsers.map((u) => (
                      <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-mono text-white/50 truncate max-w-[150px]">{u.id.slice(0, 16)}...</td>
                        <td className="py-2 px-3 text-white/30">{new Date(u.firstSeen).toLocaleDateString("zh-CN")}</td>
                        <td className="py-2 px-3 text-white/30">{new Date(u.lastSeen).toLocaleDateString("zh-CN")}</td>
                        <td className="py-2 px-3 text-right font-mono text-cyan-300">{u.eventCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.activeUsers.length === 0 && <p className="text-white/20 text-xs py-4 text-center">暂无用户数据</p>}
              </div>
            )}

            {/* 事件流 */}
            {tab === "events" && (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto scrollbar-cosmic">
                {stats.recentEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1.5 px-3 rounded-lg hover:bg-white/[0.02]">
                    <span className="text-white/20 font-mono w-[130px] shrink-0">
                      {new Date(e.timestamp).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                    <span className="font-mono text-white/40 truncate w-[100px] shrink-0">{e.userId.slice(0, 10)}</span>
                    <span className={`font-mono truncate ${
                      e.event.startsWith("ai_call:") ? "text-amber-300/70" : "text-cyan-300/70"
                    }`}>
                      {e.event}
                    </span>
                  </div>
                ))}
                {stats.recentEvents.length === 0 && <p className="text-white/20 text-xs text-center py-4">暂无事件</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
