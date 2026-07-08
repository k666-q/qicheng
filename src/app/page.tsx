"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";

export default function Home() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const user = localStorage.getItem("qc_auth_user");
      if (user) {
        const parsed = JSON.parse(user);
        if (parsed.role === "admin") {
          router.replace("/admin");
        } else {
          router.replace("/universe");
        }
        return;
      }
    } catch {}
    setShowLanding(true);
  }, [router]);

  if (showLanding === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050510]">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-bold shadow-lg shadow-indigo-900/30">
            N
          </div>
          <p className="text-sm text-white/40 animate-pulse">Loading...</p>
        </div>
      </main>
    );
  }

  return <LandingPage />;
}
