"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Globe,
  ClipboardList,
  BookOpen,
  TrendingUp,
  User,
  Layers,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LogOut,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/universe", label: "宇宙", icon: Globe },
  { href: "/plan", label: "计划", icon: ClipboardList },
  { href: "/notes", label: "笔记", icon: BookOpen },
  { href: "/growth", label: "成长", icon: TrendingUp },
  { href: "/cards", label: "卡片", icon: Layers },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/profile", label: "画像", icon: User },
];

const IMMERSIVE_ROUTES = ["/onboarding", "/first-day", "/plan/task", "/plan/learn", "/universe/learn", "/login", "/admin"];

const STORAGE_KEY = "qc_siderail_expanded";

function applyRailWidth(expanded: boolean) {
  document.documentElement.style.setProperty(
    "--siderail-width",
    expanded ? "var(--siderail-width-expanded)" : "52px"
  );
}

export function SideRail() {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ nickname: string; email: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("qc_auth_user");
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {}
  }, [pathname]);

  const isImmersive = pathname === "/" || IMMERSIVE_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {}
    setExpanded(saved);
    applyRailWidth(saved);
  }, []);

  useEffect(() => {
    if (isImmersive) {
      document.documentElement.style.setProperty("--siderail-width", "0px");
    } else {
      applyRailWidth(expanded);
    }
  }, [isImmersive, expanded]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      applyRailWidth(next);
      return next;
    });
  }, []);

  const isActive = (href: string) =>
    href === "/universe"
      ? pathname === "/universe" || pathname.startsWith("/universe/")
      : pathname.startsWith(href);

  if (isImmersive) return null;

  const showLabel = expanded || mobileOpen;

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <button
        key={item.href}
        onClick={() => router.push(item.href)}
        title={showLabel ? undefined : item.label}
        className={cn(
          "flex items-center transition-all duration-150",
          showLabel ? "h-10 gap-3 px-3 rounded-lg" : "h-10 w-10 justify-center rounded-lg",
          active
            ? "bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)_inset,0_0_8px_rgba(34,211,238,0.15)]"
            : "text-white/40 hover:bg-cyan-400/8 hover:text-cyan-100/80"
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
        {showLabel && (
          <span className="text-[13px] font-medium tracking-wider">{item.label}</span>
        )}
      </button>
    );
  };

  const navContent = (
    <>
      {/* Logo */}
      <div className={cn("flex items-center mb-5", showLabel ? "justify-between px-1" : "flex-col gap-2")}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 text-cyan-300 text-[15px] font-bold shrink-0 shadow-[0_0_14px_rgba(34,211,238,0.2),inset_0_0_8px_rgba(34,211,238,0.1)] bg-black/60">
          N
        </div>
        {showLabel && (
          <span className="neon-title text-[15px] font-semibold truncate ml-3 mr-auto">
            Nexiova
          </span>
        )}
        {!mobileOpen && (
          <button
            onClick={toggle}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"
            title={expanded ? "收起" : "展开"}
          >
            {expanded
              ? <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
              : <ChevronsRight className="h-4 w-4" strokeWidth={1.5} />
            }
          </button>
        )}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-white/30 hover:text-cyan-300 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className={cn("flex flex-col gap-1", !showLabel && "items-center")}>
        {NAV_ITEMS.map(renderItem)}
      </div>

      <div className="flex-1" />

      <div className={cn("flex flex-col gap-1", !showLabel && "items-center")}>
        {BOTTOM_ITEMS.map(renderItem)}

        {/* 用户区 */}
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              title={showLabel ? undefined : currentUser.nickname}
              className={cn(
                "flex items-center transition-all duration-150",
                showLabel ? "h-10 gap-3 px-3 rounded-lg w-full" : "h-10 w-10 justify-center rounded-lg",
                "text-white/40 hover:bg-cyan-400/8 hover:text-cyan-100/80"
              )}
            >
              <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-[10px] font-bold text-cyan-200 shrink-0">
                {currentUser.nickname.charAt(0).toUpperCase()}
              </div>
              {showLabel && (
                <span className="text-[13px] font-medium tracking-wider truncate">{currentUser.nickname}</span>
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-12 left-0 z-50 w-48 rounded-xl border border-white/10 bg-[#0c0c18]/95 backdrop-blur-xl p-2 shadow-xl">
                <div className="px-3 py-2 text-[11px] text-white/30 truncate border-b border-white/5 mb-1">
                  {currentUser.email}
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push("/profile"); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/50 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <User className="h-3.5 w-3.5" strokeWidth={1.5} /> 画像
                </button>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    localStorage.removeItem("qc_auth_user");
                    setCurrentUser(null);
                    router.push("/");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-300/60 hover:bg-red-400/5 rounded-lg transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} /> 退出登录
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push("/login")}
            title={showLabel ? undefined : "登录"}
            className={cn(
              "flex items-center transition-all duration-150",
              showLabel ? "h-10 gap-3 px-3 rounded-lg" : "h-10 w-10 justify-center rounded-lg",
              "text-cyan-300/50 hover:bg-cyan-400/8 hover:text-cyan-200"
            )}
          >
            <LogIn className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
            {showLabel && <span className="text-[13px] font-medium tracking-wider">登录</span>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* 移动端 hamburger — 不用 cyber-panel（其 position:relative 会覆盖 fixed） */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-[60] flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/25 bg-black/80 text-cyan-300 backdrop-blur-md shadow-[0_0_14px_rgba(34,211,238,0.15)]"
        aria-label="打开导航"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[55] md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <nav
            onClick={(e) => e.stopPropagation()}
            className="cyber-rail-bg absolute left-0 top-0 h-full w-[220px] flex flex-col py-4 px-3 border-r border-cyan-400/20 backdrop-blur-xl shadow-[4px_0_30px_rgba(0,0,0,0.6),0_0_20px_rgba(34,211,238,0.06)] animate-in slide-in-from-left duration-200"
          >
            {navContent}
          </nav>
        </div>
      )}

      {/* 桌面端固定侧栏 — 赛博朋克风格（手写样式，避免 cyber-panel 的 position:relative 覆盖 fixed） */}
      <nav
        className={cn(
          "cyber-rail-bg hidden md:flex fixed left-0 top-0 z-50 h-screen flex-col py-4 gap-0.5",
          "w-[var(--siderail-width)] border-r border-cyan-400/20 backdrop-blur-xl",
          "shadow-[2px_0_20px_rgba(0,0,0,0.4),0_0_15px_rgba(34,211,238,0.04)]",
          "transition-[width] duration-[var(--dur-base)] ease-[var(--ease)]",
          expanded ? "px-3 items-stretch" : "px-0 items-center"
        )}
      >
        {navContent}
      </nav>
    </>
  );
}
