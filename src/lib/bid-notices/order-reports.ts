import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBidNoticeById, getBidNoticesByIds } from "./notice-repository";
import type { KhnpBidNoticeRow } from "./types";

export const ORDER_REPORTS_TABLE_SETUP_MESSAGE =
  "발주보고를 등록할 수 없습니다. Supabase에 user_order_reports 테이블이 필요합니다. supabase/migrations/006_user_order_reports.sql을 적용해 주세요.";

export interface UserOrderReport {
  id: string;
  noticeId: string;
  submittedAt: string;
  siteId: number;
  notice: KhnpBidNoticeRow;
}

function isMissingOrderReportsTableError(message: string | undefined): boolean {
  if (!message) return false;
  if (
    message.includes("relationship") ||
    message.includes("Could not find a relationship")
  ) {
    return false;
  }
  return (
    message.includes("user_order_reports") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeOrderReportsError(message: string | undefined): string {
  if (isMissingOrderReportsTableError(message)) {
    return ORDER_REPORTS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "발주보고 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 발주보고를 사용할 수 없습니다.";
  }
  return null;
}

export async function listUserOrderReports(
  userId: string,
): Promise<{ reports: UserOrderReport[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { reports: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_order_reports")
      .select("id, notice_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { reports: [], error: normalizeOrderReportsError(error.message) };
    }

    const rows = data ?? [];
    const { notices, error: noticeError } = await getBidNoticesByIds(
      rows.map((row) => row.notice_id as string),
    );
    if (noticeError) {
      return { reports: [], error: normalizeOrderReportsError(noticeError) };
    }

    const reports: UserOrderReport[] = rows
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
      .filter((item): item is UserOrderReport => item != null);

    return { reports, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발주보고 목록 조회에 실패했습니다.";
    return { reports: [], error: normalizeOrderReportsError(message) };
  }
}

export async function isNoticeOrderReported(
  userId: string,
  noticeId: string,
): Promise<{ isOrderReported: boolean; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { isOrderReported: false, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_order_reports")
      .select("id")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return {
        isOrderReported: false,
        error: normalizeOrderReportsError(error.message),
      };
    }

    return { isOrderReported: !!data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발주보고 여부 확인에 실패했습니다.";
    return { isOrderReported: false, error: normalizeOrderReportsError(message) };
  }
}

export async function addOrderReport(
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
      return { error: normalizeOrderReportsError(noticeError) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("user_order_reports").insert({
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
            "발주보고 등록에 실패했습니다. Supabase에서 019_srm_bid_notice.sql(FK 제거) 적용 후 schema cache를 새로고침해 주세요.",
        };
      }
      return { error: normalizeOrderReportsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발주보고 등록에 실패했습니다.";
    return { error: normalizeOrderReportsError(message) };
  }
}

export async function removeOrderReport(
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
      .from("user_order_reports")
      .delete()
      .eq("user_id", userId)
      .eq("notice_id", noticeId);

    if (error) {
      return { error: normalizeOrderReportsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발주보고 취소에 실패했습니다.";
    return { error: normalizeOrderReportsError(message) };
  }
}
