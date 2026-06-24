import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { KhnpBidNoticeRow } from "./types";

const NOTICE_SELECT = `
  *,
  khnp_bid_open (*),
  khnp_bid_private (*),
  khnp_bid_plan_spec (*)
`;

export const ESTIMATES_TABLE_SETUP_MESSAGE =
  "견적을 등록할 수 없습니다. Supabase에 user_estimate_submissions 테이블이 필요합니다. supabase/migrations/005_user_estimate_submissions.sql을 적용해 주세요.";

export interface UserEstimateSubmission {
  id: string;
  noticeId: string;
  submittedAt: string;
  siteId: number;
  notice: KhnpBidNoticeRow;
}

function isMissingEstimatesTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_estimate_submissions") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeEstimatesError(message: string | undefined): string {
  if (isMissingEstimatesTableError(message)) {
    return ESTIMATES_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "견적 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 견적내기를 사용할 수 없습니다.";
  }
  return null;
}

export async function listUserEstimateSubmissions(
  userId: string,
): Promise<{ submissions: UserEstimateSubmission[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { submissions: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_estimate_submissions")
      .select(
        `
        id,
        notice_id,
        created_at,
        khnp_bid_notice!inner (${NOTICE_SELECT})
      `,
      )
      .eq("user_id", userId)
      .eq("khnp_bid_notice.is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      return { submissions: [], error: normalizeEstimatesError(error.message) };
    }

    const submissions: UserEstimateSubmission[] = (data ?? [])
      .map((row) => {
        const notice = row.khnp_bid_notice as KhnpBidNoticeRow | KhnpBidNoticeRow[] | null;
        const resolved = Array.isArray(notice) ? notice[0] : notice;
        if (!resolved) return null;

        return {
          id: row.id as string,
          noticeId: row.notice_id as string,
          submittedAt: row.created_at as string,
          siteId: resolved.site_id,
          notice: resolved,
        };
      })
      .filter((item): item is UserEstimateSubmission => item != null);

    return { submissions, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "견적 목록 조회에 실패했습니다.";
    return { submissions: [], error: normalizeEstimatesError(message) };
  }
}

export async function isNoticeEstimated(
  userId: string,
  noticeId: string,
): Promise<{ isEstimated: boolean; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { isEstimated: false, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_estimate_submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { isEstimated: false, error: normalizeEstimatesError(error.message) };
    }

    return { isEstimated: !!data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "견적 여부 확인에 실패했습니다.";
    return { isEstimated: false, error: normalizeEstimatesError(message) };
  }
}

export async function addEstimateSubmission(
  userId: string,
  noticeId: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
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
      return { error: normalizeEstimatesError(noticeError.message) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const { error } = await supabase.from("user_estimate_submissions").insert({
      user_id: userId,
      notice_id: noticeId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: null };
      }
      return { error: normalizeEstimatesError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "견적 등록에 실패했습니다.";
    return { error: normalizeEstimatesError(message) };
  }
}

export async function removeEstimateSubmission(
  userId: string,
  noticeId: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("user_estimate_submissions")
      .delete()
      .eq("user_id", userId)
      .eq("notice_id", noticeId);

    if (error) {
      return { error: normalizeEstimatesError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "견적 취소에 실패했습니다.";
    return { error: normalizeEstimatesError(message) };
  }
}
