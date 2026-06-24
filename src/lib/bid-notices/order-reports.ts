import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { KhnpBidNoticeRow } from "./types";

const NOTICE_SELECT = `
  *,
  khnp_bid_open (*),
  khnp_bid_private (*),
  khnp_bid_plan_spec (*)
`;

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
      return { reports: [], error: normalizeOrderReportsError(error.message) };
    }

    const reports: UserOrderReport[] = (data ?? [])
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
    const supabase = createServerClient();

    const { data: notice, error: noticeError } = await supabase
      .from("khnp_bid_notice")
      .select("id")
      .eq("id", noticeId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (noticeError) {
      return { error: normalizeOrderReportsError(noticeError.message) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const { error } = await supabase.from("user_order_reports").insert({
      user_id: userId,
      notice_id: noticeId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: null };
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
