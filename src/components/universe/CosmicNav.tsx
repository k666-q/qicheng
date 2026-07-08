"use client";

// 全局统一底部导航（深色宇宙风格玻璃态 dock）。
// 挂在宇宙页等主页面底部中央，消除对计划页 header 导航的依赖。

import { usePathname, useRouter } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const ITEMS: NavItem[] = [
  {
    href: "/universe",
    label: "宇宙",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.5 2.5 2.5 15.5 0 18m-6.7-3.2c3-2.2 10.4-2.2 13.4 0M5.3 6.2c3 2.2 10.4 2.2 13.4 0" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "计划",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M9 8h6m-9.75 12h13.5A2.25 2.25 0 0021 17.75V6.25A2.25 2.25 0 0018.75 4H5.25A2.25 2.25 0 003 6.25v11.5A2.25 2.25 0 005.25 20z" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "笔记",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/growth",
    label: "成长",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8m0 0v5m0-5h-5" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "画像",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
      </svg>
    ),
  },
  {
    href: "/cards",
    label: "卡片",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h9a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm13 3l1.5.5a2 2 0 011.2 2.6L18 20" />
      </svg>
    ),
  },
];

export function CosmicNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="cyber-panel pointer-events-auto flex items-center gap-0.5 border-cyan-400/20 bg-black/75 p-1 shadow-lg shadow-cyan-500/10">
      {ITEMS.map((item) => {
        const active =
          item.href === "/universe"
            ? pathname === "/universe"
            : pathname.startsWith(item.href);
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            title={item.label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all ${
              active
                ? "bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)_inset]"
                : "text-white/40 hover:bg-cyan-400/5 hover:text-cyan-100/80"
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-medium leading-none tracking-wider">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
