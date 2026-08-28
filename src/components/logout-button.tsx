"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    try {
      let sessionId: string | null = null;
      try {
        sessionId = sessionStorage.getItem("bidding_usage_session_id");
      } catch {
        // ignore
      }
      if (sessionId) {
        await fetch("/api/usage/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", sessionId }),
          keepalive: true,
        });
        try {
          sessionStorage.removeItem("bidding_usage_session_id");
        } catch {
          // ignore
        }
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className={
        className ??
        "rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
      }
    >
      {isLoading ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
