import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { KhnpBidNoticeRow } from "./types";

const NOTICE_SELECT = `
  *,
  khnp_bid_open (*),
  khnp_bid_private (*),
  khnp_bid_plan_spec (*)
`;

export const SUBMISSIONS_TABLE_SETUP_MESSAGE =
  "입찰을 등록할 수 없습니다. Supabase에 user_bid_submissions 테이블이 필요합니다. supabase/migrations/004_user_bid_submissions.sql을 적용해 주세요.";

export interface UserBidSubmission {
  id: string;
  noticeId: string;
  submittedAt: string;
  siteId: number;
  notice: KhnpBidNoticeRow;
}

function isMissingSubmissionsTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_bid_submissions") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeSubmissionsError(message: string | undefined): string {
  if (isMissingSubmissionsTableError(message)) {
    return SUBMISSIONS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "입찰 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 입찰하기를 사용할 수 없습니다.";
  }
  return null;
}

export async function listUserBidSubmissions(
  userId: string,
): Promise<{ submissions: UserBidSubmission[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { submissions: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_submissions")
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
      return { submissions: [], error: normalizeSubmissionsError(error.message) };
    }

    const submissions: UserBidSubmission[] = (data ?? [])
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
      .filter((item): item is UserBidSubmission => item != null);

    return { submissions, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰 목록 조회에 실패했습니다.";
    return { submissions: [], error: normalizeSubmissionsError(message) };
  }
}

export async function getSubmissionNoticeIds(
  userId: string,
): Promise<{ noticeIds: string[]; error: string | null }> {
  const { submissions, error } = await listUserBidSubmissions(userId);
  if (error) {
    return { noticeIds: [], error };
  }
  return { noticeIds: submissions.map((s) => s.noticeId), error: null };
}

export async function isNoticeSubmitted(
  userId: string,
  noticeId: string,
): Promise<{ isSubmitted: boolean; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { isSubmitted: false, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { isSubmitted: false, error: normalizeSubmissionsError(error.message) };
    }

    return { isSubmitted: !!data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰 여부 확인에 실패했습니다.";
    return { isSubmitted: false, error: normalizeSubmissionsError(message) };
  }
}

export async function addBidSubmission(
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
      return { error: normalizeSubmissionsError(noticeError.message) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const { error } = await supabase.from("user_bid_submissions").insert({
      user_id: userId,
      notice_id: noticeId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: null };
      }
      return { error: normalizeSubmissionsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰 등록에 실패했습니다.";
    return { error: normalizeSubmissionsError(message) };
  }
}

export async function removeBidSubmission(
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
      .from("user_bid_submissions")
      .delete()
      .eq("user_id", userId)
      .eq("notice_id", noticeId);

    if (error) {
      return { error: normalizeSubmissionsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰 취소에 실패했습니다.";
    return { error: normalizeSubmissionsError(message) };
  }
}
