import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { BidNoticeType } from "./types";

export type BidNoticeScreeningStatus = "WAITING" | "EXCLUDED" | "TARGET";

export const SCREENING_STATUS_LABELS: Record<BidNoticeScreeningStatus, string> = {
  WAITING: "대기",
  EXCLUDED: "미대상",
  TARGET: "대상",
};

const SCREENING_CYCLE: BidNoticeScreeningStatus[] = [
  "WAITING",
  "EXCLUDED",
  "TARGET",
];

export const SCREENING_TABLE_SETUP_MESSAGE =
  "선별 상태를 저장할 수 없습니다. Supabase에 user_bid_notice_screening 테이블이 필요합니다. supabase/migrations/008_user_bid_notice_screening.sql을 적용해 주세요.";

function isMissingScreeningTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_bid_notice_screening") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeScreeningError(message: string | undefined): string {
  if (isMissingScreeningTableError(message)) {
    return SCREENING_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "선별 상태 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 선별 상태를 사용할 수 없습니다.";
  }
  return null;
}

export function parseScreeningStatus(
  value: string | null | undefined,
): BidNoticeScreeningStatus {
  if (value === "EXCLUDED" || value === "TARGET" || value === "WAITING") {
    return value;
  }
  return "WAITING";
}

export function getNextScreeningStatus(
  current: BidNoticeScreeningStatus,
): BidNoticeScreeningStatus {
  const index = SCREENING_CYCLE.indexOf(current);
  return SCREENING_CYCLE[(index + 1) % SCREENING_CYCLE.length];
}

export async function getScreeningStatusMap(
  userId: string,
  filters?: { siteId?: number; noticeType?: BidNoticeType },
): Promise<{
  statuses: Record<string, BidNoticeScreeningStatus>;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { statuses: {}, error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("user_bid_notice_screening")
      .select("notice_id, status, khnp_bid_notice!inner(site_id, notice_type, is_deleted)")
      .eq("user_id", userId)
      .eq("khnp_bid_notice.is_deleted", false);

    if (filters?.siteId != null) {
      query = query.eq("khnp_bid_notice.site_id", filters.siteId);
    }
    if (filters?.noticeType) {
      query = query.eq("khnp_bid_notice.notice_type", filters.noticeType);
    }

    const { data, error } = await query;

    if (error) {
      return { statuses: {}, error: normalizeScreeningError(error.message) };
    }

    const statuses: Record<string, BidNoticeScreeningStatus> = {};
    for (const row of data ?? []) {
      statuses[row.notice_id as string] = parseScreeningStatus(
        row.status as string,
      );
    }

    return { statuses, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "선별 상태 조회에 실패했습니다.";
    return { statuses: {}, error: normalizeScreeningError(message) };
  }
}

export async function getNoticeScreeningStatus(
  userId: string,
  noticeId: string,
): Promise<{ status: BidNoticeScreeningStatus; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { status: "WAITING", error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_notice_screening")
      .select("status")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { status: "WAITING", error: normalizeScreeningError(error.message) };
    }

    return {
      status: parseScreeningStatus(data?.status as string | undefined),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "선별 상태 조회에 실패했습니다.";
    return { status: "WAITING", error: normalizeScreeningError(message) };
  }
}

export async function cycleNoticeScreeningStatus(
  userId: string,
  noticeId: string,
): Promise<{ status: BidNoticeScreeningStatus; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { status: "WAITING", error: configError };
  }

  try {
    const supabase = createServerClient();

    const { data: notice, error: noticeError } = await supabase
      .from("khnp_bid_notice")
      .select("id")
      .eq("id", noticeId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (noticeError) {
      return { status: "WAITING", error: normalizeScreeningError(noticeError.message) };
    }
    if (!notice) {
      return { status: "WAITING", error: "공고를 찾을 수 없습니다." };
    }

    const { data: existing, error: existingError } = await supabase
      .from("user_bid_notice_screening")
      .select("status")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (existingError) {
      return {
        status: "WAITING",
        error: normalizeScreeningError(existingError.message),
      };
    }

    const current = parseScreeningStatus(existing?.status as string | undefined);
    const next = getNextScreeningStatus(current);

    const { error: upsertError } = await supabase
      .from("user_bid_notice_screening")
      .upsert(
        {
          user_id: userId,
          notice_id: noticeId,
          status: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,notice_id" },
      );

    if (upsertError) {
      return { status: current, error: normalizeScreeningError(upsertError.message) };
    }

    return { status: next, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "선별 상태 변경에 실패했습니다.";
    return { status: "WAITING", error: normalizeScreeningError(message) };
  }
}
