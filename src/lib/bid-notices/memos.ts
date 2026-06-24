import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const MEMO_MAX_LENGTH = 10_000;

export const MEMOS_TABLE_SETUP_MESSAGE =
  "메모를 저장할 수 없습니다. Supabase에 user_bid_notice_memos 테이블이 필요합니다. supabase/migrations/003_user_bid_notice_memos.sql을 적용해 주세요.";

export interface NoticeMemo {
  memo: string;
  updatedAt: string | null;
}

function isMissingMemosTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_bid_notice_memos") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeMemosError(message: string | undefined): string {
  if (isMissingMemosTableError(message)) {
    return MEMOS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "메모 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 메모를 사용할 수 없습니다.";
  }
  return null;
}

export async function getNoticeMemo(
  userId: string,
  noticeId: string,
): Promise<{ data: NoticeMemo | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { data: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_notice_memos")
      .select("memo, updated_at")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { data: null, error: normalizeMemosError(error.message) };
    }

    if (!data) {
      return { data: null, error: null };
    }

    return {
      data: {
        memo: (data.memo as string) ?? "",
        updatedAt: (data.updated_at as string) ?? null,
      },
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "메모 조회에 실패했습니다.";
    return { data: null, error: normalizeMemosError(message) };
  }
}

export async function saveNoticeMemo(
  userId: string,
  noticeId: string,
  memo: string,
): Promise<{ data: NoticeMemo | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { data: null, error: configError };
  }

  const trimmed = memo.trim();
  if (trimmed.length > MEMO_MAX_LENGTH) {
    return {
      data: null,
      error: `메모는 ${MEMO_MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`,
    };
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
      return { data: null, error: normalizeMemosError(noticeError.message) };
    }
    if (!notice) {
      return { data: null, error: "공고를 찾을 수 없습니다." };
    }

    if (!trimmed) {
      const { error: deleteError } = await supabase
        .from("user_bid_notice_memos")
        .delete()
        .eq("user_id", userId)
        .eq("notice_id", noticeId);

      if (deleteError) {
        return { data: null, error: normalizeMemosError(deleteError.message) };
      }

      return { data: { memo: "", updatedAt: null }, error: null };
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_bid_notice_memos")
      .upsert(
        {
          user_id: userId,
          notice_id: noticeId,
          memo: trimmed,
          updated_at: now,
        },
        { onConflict: "user_id,notice_id" },
      )
      .select("memo, updated_at")
      .single();

    if (error) {
      return { data: null, error: normalizeMemosError(error.message) };
    }

    return {
      data: {
        memo: (data.memo as string) ?? trimmed,
        updatedAt: (data.updated_at as string) ?? now,
      },
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "메모 저장에 실패했습니다.";
    return { data: null, error: normalizeMemosError(message) };
  }
}
