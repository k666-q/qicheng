"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CosmicBackground } from "@/components/universe/CosmicBackground";
import { CyberOverlay } from "@/components/universe/CyberOverlay";
import { signIn, signUp, clearAllUserData } from "@/lib/auth/local";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      setTimeout(() => {
        const result =
          mode === "register"
            ? signUp(email, password, nickname)
            : signIn(email, password);

        setLoading(false);
        if (result.success) {
          if (result.user.role === "admin") {
            router.push("/admin");
          } else {
            router.push("/universe?welcome=1");
          }
        } else {
          setError(result.error);
        }
      }, 500);
    },
    [mode, email, password, nickname, router]
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#050510] px-6">
      <CosmicBackground />
      <CyberOverlay />

      {/* 返回首页 */}
      <button
        onClick={() => router.push("/")}
        className="fixed top-5 left-5 z-50 flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <span className="text-lg">&larr;</span> 首页
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 text-cyan-300 text-2xl font-bold bg-black/40 shadow-[0_0_30px_rgba(34,211,238,0.15)] mb-4">
            N
          </div>
          <h1 className="neon-title text-xl font-semibold tracking-wider">Nexiova</h1>
          <p className="mt-2 text-xs text-white/35">
            {mode === "login" ? "欢迎回来" : "开启你的学习宇宙"}
          </p>
        </div>

        {/* 表单 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-[#0c0c18]/80 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
        >
          {/* Tab */}
          <div className="flex items-center gap-1 mb-6 bg-white/[0.03] rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-xs font-medium tracking-wider rounded-md transition-all ${
                mode === "login"
                  ? "bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)_inset]"
                  : "text-white/35 hover:text-white/50"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 text-xs font-medium tracking-wider rounded-md transition-all ${
                mode === "register"
                  ? "bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)_inset]"
                  : "text-white/35 hover:text-white/50"
              }`}
            >
              注册
            </button>
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-[11px] text-white/40 tracking-wider mb-1.5">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="你的名字"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-cyan-400/40 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] text-white/40 tracking-wider mb-1.5">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-cyan-400/40 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/40 tracking-wider mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-cyan-400/40 transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full py-3 text-sm font-medium tracking-wider text-black bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl hover:opacity-90 transition-all shadow-[0_0_25px_rgba(34,211,238,0.25)] disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "登录" : "注册"}
          </button>

          {/* 第三方占位 */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-white/20 tracking-wider">其他方式</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled
              className="flex-1 py-2.5 text-xs text-white/20 border border-white/5 rounded-xl cursor-not-allowed"
            >
              微信登录（即将开放）
            </button>
            <button
              type="button"
              disabled
              className="flex-1 py-2.5 text-xs text-white/20 border border-white/5 rounded-xl cursor-not-allowed"
            >
              手机号（即将开放）
            </button>
          </div>
        </form>

        {/* 底部工具 */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => {
              clearAllUserData();
              alert("本机学习数据已清除");
            }}
            className="text-[10px] text-white/15 hover:text-red-300/50 transition-colors"
          >
            重置本机数据
          </button>
          <div className="flex gap-4 text-[10px] text-white/15">
            <span className="cursor-pointer hover:text-white/30">隐私政策</span>
            <span className="cursor-pointer hover:text-white/30">用户协议</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050510]" />}>
      <LoginContent />
    </Suspense>
  );
}
