import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBidNoticeById, getBidNoticesByIds } from "./notice-repository";
import type { KhnpBidNoticeRow } from "./types";

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
  if (
    message.includes("relationship") ||
    message.includes("Could not find a relationship")
  ) {
    return false;
  }
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
      .select("id, notice_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { submissions: [], error: normalizeEstimatesError(error.message) };
    }

    const rows = data ?? [];
    const { notices, error: noticeError } = await getBidNoticesByIds(
      rows.map((row) => row.notice_id as string),
    );
    if (noticeError) {
      return { submissions: [], error: normalizeEstimatesError(noticeError) };
    }

    const submissions: UserEstimateSubmission[] = rows
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
    const { notice, error: noticeError } = await getBidNoticeById(noticeId);
    if (noticeError) {
      return { error: normalizeEstimatesError(noticeError) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("user_estimate_submissions").insert({
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
            "견적 등록에 실패했습니다. Supabase에서 019_srm_bid_notice.sql(FK 제거) 적용 후 schema cache를 새로고침해 주세요.",
        };
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
