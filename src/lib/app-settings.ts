import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatSupabaseNetworkError } from "@/lib/supabase/fetch";
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_GRACE_SECONDS,
  type IdleTimeoutSettings,
} from "@/lib/app-settings-types";

export type { IdleTimeoutSettings } from "@/lib/app-settings-types";
export {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_GRACE_SECONDS,
} from "@/lib/app-settings-types";

export const IDLE_TIMEOUT_MINUTES_KEY = "idle_timeout_minutes";

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. 시스템 설정은 Supabase app_settings 테이블에 저장됩니다.",
    );
  }
}

function parseIdleTimeoutMinutes(raw: string | null | undefined): number {
  if (raw == null || raw === "") {
    return DEFAULT_IDLE_TIMEOUT_MINUTES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_IDLE_TIMEOUT_MINUTES;
  }
  return Math.min(parsed, 24 * 60);
}

export async function getIdleTimeoutSettings(): Promise<IdleTimeoutSettings> {
  if (!isSupabaseConfigured()) {
    return {
      idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
      graceSeconds: IDLE_TIMEOUT_GRACE_SECONDS,
    };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", IDLE_TIMEOUT_MINUTES_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return {
    idleTimeoutMinutes: parseIdleTimeoutMinutes(
      data?.value as string | undefined,
    ),
    graceSeconds: IDLE_TIMEOUT_GRACE_SECONDS,
  };
}

export async function setIdleTimeoutMinutes(
  minutes: number,
): Promise<IdleTimeoutSettings> {
  requireSupabase();

  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new Error(
      "타임아웃은 0~1440분(24시간) 사이여야 합니다. 0은 비활성입니다.",
    );
  }

  const normalized = Math.floor(minutes);
  const supabase = createServerClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: IDLE_TIMEOUT_MINUTES_KEY,
      value: String(normalized),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return {
    idleTimeoutMinutes: normalized,
    graceSeconds: IDLE_TIMEOUT_GRACE_SECONDS,
  };
}
