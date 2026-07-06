import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBidNoticeById, getBidNoticesByIds } from "./notice-repository";
import type { KhnpBidNoticeRow } from "./types";

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
  if (
    message.includes("relationship") ||
    message.includes("Could not find a relationship")
  ) {
    return false;
  }
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
      .select("id, notice_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { submissions: [], error: normalizeSubmissionsError(error.message) };
    }

    const rows = data ?? [];
    const noticeIds = rows.map((row) => row.notice_id as string);
    const { notices, error: noticeError } = await getBidNoticesByIds(noticeIds);
    if (noticeError) {
      return { submissions: [], error: normalizeSubmissionsError(noticeError) };
    }

    const submissions: UserBidSubmission[] = rows
      .map((row) => {
        const notice = notices.get(row.notice_id as string);
        if (!notice) return null;

        return {
          id: row.id as string,
          noticeId: row.notice_id as string,
          submittedAt: row.created_at as string,
          siteId: notice.site_id,
          notice,
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
    const { notice, error: noticeError } = await getBidNoticeById(noticeId);
    if (noticeError) {
      return { error: normalizeSubmissionsError(noticeError) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("user_bid_submissions").insert({
      user_id: userId,
      notice_id: noticeId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: null };
      }
      if (error.code === "23503") {
        return {
          error:
            "입찰 등록에 실패했습니다. Supabase에서 019_srm_bid_notice.sql(FK 제거) 적용 후 schema cache를 새로고침해 주세요.",
        };
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
