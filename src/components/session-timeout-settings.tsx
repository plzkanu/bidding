"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { IdleTimeoutSettings } from "@/lib/app-settings-types";

export function SessionTimeoutSettings() {
  const [settings, setSettings] = useState<IdleTimeoutSettings | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings");
      const data = (await response.json()) as {
        settings?: IdleTimeoutSettings;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "설정을 불러오지 못했습니다.");
      }
      const next = data.settings!;
      setSettings(next);
      setEnabled(next.idleTimeoutMinutes > 0);
      setMinutes(
        String(
          next.idleTimeoutMinutes > 0 ? next.idleTimeoutMinutes : 30,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setInfo("");

    try {
      const parsed = enabled ? Number.parseInt(minutes, 10) : 0;
      if (enabled && (!Number.isFinite(parsed) || parsed < 1)) {
        throw new Error("타임아웃은 1분 이상으로 입력해 주세요.");
      }
      if (enabled && parsed > 1440) {
        throw new Error("타임아웃은 최대 1440분(24시간)까지 지정할 수 있습니다.");
      }

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleTimeoutMinutes: enabled ? parsed : 0 }),
      });
      const data = (await response.json()) as {
        settings?: IdleTimeoutSettings;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "설정 저장에 실패했습니다.");
      }

      const next = data.settings!;
      setSettings(next);
      setEnabled(next.idleTimeoutMinutes > 0);
      setMinutes(
        String(
          next.idleTimeoutMinutes > 0 ? next.idleTimeoutMinutes : 30,
        ),
      );
      setInfo(
        next.idleTimeoutMinutes > 0
          ? `미사용 ${next.idleTimeoutMinutes}분 후 타임아웃 팝업이 표시되도록 저장했습니다.`
          : "미사용 타임아웃을 비활성화했습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">
          미사용 타임아웃
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          지정한 시간 동안 마우스·키보드 등 입력이 없으면 사용자에게 타임아웃
          팝업을 표시합니다. 연장하기를 누르면 다시 동일한 시간만큼 연장됩니다.
          연장하지 않으면 약 {settings?.graceSeconds ?? 60}초 후 자동
          로그아웃됩니다.
        </p>
      </div>

      <div className="px-5 py-5">
        {error ? (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {info}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-500">설정을 불러오는 중...</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-md space-y-5">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="size-4 rounded border-slate-300 text-[#004b87] focus:ring-[#009ada]"
              />
              미사용 타임아웃 사용
            </label>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                타임아웃 시간 (분)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                required={enabled}
                disabled={!enabled}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                1~1440분. 체크 해제 시 타임아웃을 사용하지 않습니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#004b87] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003a6b] disabled:opacity-60"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
