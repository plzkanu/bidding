"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IdleTimeoutSettings } from "@/lib/app-settings-types";

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];

async function endUsageAndLogout() {
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
  } finally {
    await fetch("/api/auth/logout", { method: "POST", keepalive: true });
  }
}

/**
 * 관리자가 지정한 미사용 타임아웃을 감시합니다.
 * 타임아웃 시 팝업을 띄우고, 연장하기면 타이머를 재시작합니다.
 */
export function IdleTimeoutWatcher() {
  const router = useRouter();
  const [settings, setSettings] = useState<IdleTimeoutSettings | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [graceRemaining, setGraceRemaining] = useState(0);
  const [isExtending, setIsExtending] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const loggingOutRef = useRef(false);
  const graceDeadlineRef = useRef<number | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/session/idle-timeout");
      if (!response.ok) return;
      const data = (await response.json()) as {
        settings?: IdleTimeoutSettings;
      };
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch {
      // 설정 조회 실패 시 타임아웃 감시 생략
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!settings || settings.idleTimeoutMinutes <= 0) {
      warningShownRef.current = false;
      graceDeadlineRef.current = null;
      setShowWarning(false);
      setGraceRemaining(0);
    }
  }, [settings]);

  const performLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setShowWarning(false);
    try {
      await endUsageAndLogout();
    } finally {
      router.push("/login?reason=idle");
      router.refresh();
    }
  }, [router]);

  const extendSession = useCallback(async () => {
    setIsExtending(true);
    try {
      await fetch("/api/auth/extend", { method: "POST" });
      lastActivityRef.current = Date.now();
      warningShownRef.current = false;
      graceDeadlineRef.current = null;
      setShowWarning(false);
      setGraceRemaining(0);
    } catch {
      // 연장 API 실패해도 클라이언트 타이머는 재시작
      lastActivityRef.current = Date.now();
      warningShownRef.current = false;
      graceDeadlineRef.current = null;
      setShowWarning(false);
      setGraceRemaining(0);
    } finally {
      setIsExtending(false);
    }
  }, []);

  // 사용자 활동 → 마지막 활동 시각 갱신 (경고 중에는 무시)
  useEffect(() => {
    if (!settings || settings.idleTimeoutMinutes <= 0) return;

    let throttleUntil = 0;
    function onActivity() {
      if (warningShownRef.current || loggingOutRef.current) return;
      const now = Date.now();
      if (now < throttleUntil) return;
      throttleUntil = now + 1000;
      lastActivityRef.current = now;
    }

    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, onActivity, { passive: true });
    }
    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, onActivity);
      }
    };
  }, [settings]);

  // 유휴 감시 + 유예 카운트다운
  useEffect(() => {
    if (!settings || settings.idleTimeoutMinutes <= 0) return;

    const idleMs = settings.idleTimeoutMinutes * 60 * 1000;
    const graceMs = settings.graceSeconds * 1000;

    const intervalId = window.setInterval(() => {
      if (loggingOutRef.current) return;

      const now = Date.now();

      if (warningShownRef.current) {
        const deadline = graceDeadlineRef.current ?? now + graceMs;
        graceDeadlineRef.current = deadline;
        const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
        setGraceRemaining(remaining);
        if (remaining <= 0) {
          void performLogout();
        }
        return;
      }

      if (now - lastActivityRef.current >= idleMs) {
        warningShownRef.current = true;
        graceDeadlineRef.current = now + graceMs;
        setShowWarning(true);
        setGraceRemaining(settings.graceSeconds);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [settings, performLogout]);

  // 탭이 다시 보일 때 설정 재조회 (관리자가 변경했을 수 있음)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void loadSettings();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadSettings]);

  if (!showWarning) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-desc"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="idle-timeout-title"
          className="text-lg font-bold text-[#004b87]"
        >
          세션 타임아웃
        </h2>
        <p id="idle-timeout-desc" className="mt-3 text-sm leading-relaxed text-slate-600">
          일정 시간 동안 사용이 없어 세션이 만료되었습니다.
          <br />
          계속 사용하려면 <strong className="font-semibold text-slate-800">연장하기</strong>를
          눌러 주세요.
          {graceRemaining > 0 ? (
            <>
              <br />
              <span className="mt-2 inline-block text-[#004b87]">
                {graceRemaining}초 후 자동으로 로그아웃됩니다.
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void performLogout()}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            로그아웃
          </button>
          <button
            type="button"
            onClick={() => void extendSession()}
            disabled={isExtending}
            className="rounded-lg bg-[#004b87] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003a6b] disabled:opacity-60"
          >
            {isExtending ? "연장 중..." : "연장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
