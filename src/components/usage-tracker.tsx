"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const SESSION_STORAGE_KEY = "bidding_usage_session_id";
const HEARTBEAT_INTERVAL_MS = 30_000;

function readSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(sessionId: string) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // ignore
  }
}

async function postTrack(body: Record<string, unknown>) {
  const response = await fetch("/api/usage/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as {
    sessionId?: string;
  };
}

/**
 * 대시보드 내 화면 이동·활성 시간을 수집합니다.
 * 관리자 사용 현황 화면에서 조회합니다.
 */
export function UsageTracker() {
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = readSessionId();
  }, []);

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) {
      return;
    }

    let cancelled = false;

    async function trackPageview() {
      const data = await postTrack({
        action: "pageview",
        pathname,
        sessionId: sessionIdRef.current,
      });
      if (cancelled || !data?.sessionId) return;
      sessionIdRef.current = data.sessionId;
      writeSessionId(data.sessionId);
    }

    void trackPageview();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    async function sendHeartbeat() {
      if (document.visibilityState !== "visible") return;
      const data = await postTrack({
        action: "heartbeat",
        sessionId: sessionIdRef.current,
      });
      if (data?.sessionId) {
        sessionIdRef.current = data.sessionId;
        writeSessionId(data.sessionId);
      }
    }

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    }

    function onPageHide() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void postTrack({ action: "end", sessionId });
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
