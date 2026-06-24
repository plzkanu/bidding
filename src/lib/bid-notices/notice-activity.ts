import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { findUserById } from "@/lib/users-store";
import {
  parseScreeningStatus,
  SCREENING_STATUS_LABELS,
  type BidNoticeScreeningStatus,
} from "@/lib/bid-notices/screening";
import { WORK_RESULT_KIND_LABELS } from "@/lib/bid-notices/work-results";

export type NoticeActivityKind = "SCREENING" | "ORDER_REPORT" | "BID" | "ESTIMATE";

export interface NoticeActivityEntry {
  id: string;
  kind: NoticeActivityKind;
  userId: string;
  userName: string;
  userDepartment: string | null;
  /** 화면 표시용 (예: 선별 · 대상, 작업 · 입찰) */
  actionLabel: string;
  performedAt: string;
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 처리 이력을 조회할 수 없습니다.";
  }
  return null;
}

interface ResolvedUserInfo {
  name: string;
  department: string | null;
}

async function resolveUserInfo(userId: string): Promise<ResolvedUserInfo> {
  const user = await findUserById(userId);
  if (!user) {
    return { name: userId, department: null };
  }
  const department = user.department?.trim() || null;
  return { name: user.name, department };
}

function screeningActionLabel(status: BidNoticeScreeningStatus): string {
  return `선별 · ${SCREENING_STATUS_LABELS[status]}`;
}

function workActionLabel(kind: Exclude<NoticeActivityKind, "SCREENING">): string {
  return `작업 · ${WORK_RESULT_KIND_LABELS[kind]}`;
}

/** 공고별 선별·작업 처리 이력 (전체 사용자) */
export async function getNoticeActivityLog(
  noticeId: string,
): Promise<{ activities: NoticeActivityEntry[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { activities: [], error: configError };
  }

  try {
    const supabase = createServerClient();

    const [
      { data: screeningRows, error: screeningError },
      { data: orderReportRows, error: orderReportError },
      { data: bidRows, error: bidError },
      { data: estimateRows, error: estimateError },
    ] = await Promise.all([
      supabase
        .from("user_bid_notice_screening")
        .select("id, user_id, status, updated_at")
        .eq("notice_id", noticeId)
        .in("status", ["EXCLUDED", "TARGET"]),
      supabase
        .from("user_order_reports")
        .select("id, user_id, created_at")
        .eq("notice_id", noticeId),
      supabase
        .from("user_bid_submissions")
        .select("id, user_id, created_at")
        .eq("notice_id", noticeId),
      supabase
        .from("user_estimate_submissions")
        .select("id, user_id, created_at")
        .eq("notice_id", noticeId),
    ]);

    const firstError =
      screeningError?.message ??
      orderReportError?.message ??
      bidError?.message ??
      estimateError?.message;
    if (firstError) {
      return { activities: [], error: firstError };
    }

    const rawEntries: Omit<
      NoticeActivityEntry,
      "userName" | "userDepartment"
    >[] = [];

    for (const row of screeningRows ?? []) {
      const status = parseScreeningStatus(row.status as string);
      rawEntries.push({
        id: row.id as string,
        kind: "SCREENING",
        userId: row.user_id as string,
        actionLabel: screeningActionLabel(status),
        performedAt: (row.updated_at as string) ?? new Date().toISOString(),
      });
    }

    for (const row of orderReportRows ?? []) {
      rawEntries.push({
        id: row.id as string,
        kind: "ORDER_REPORT",
        userId: row.user_id as string,
        actionLabel: workActionLabel("ORDER_REPORT"),
        performedAt: (row.created_at as string) ?? new Date().toISOString(),
      });
    }

    for (const row of bidRows ?? []) {
      rawEntries.push({
        id: row.id as string,
        kind: "BID",
        userId: row.user_id as string,
        actionLabel: workActionLabel("BID"),
        performedAt: (row.created_at as string) ?? new Date().toISOString(),
      });
    }

    for (const row of estimateRows ?? []) {
      rawEntries.push({
        id: row.id as string,
        kind: "ESTIMATE",
        userId: row.user_id as string,
        actionLabel: workActionLabel("ESTIMATE"),
        performedAt: (row.created_at as string) ?? new Date().toISOString(),
      });
    }

    const userCache = new Map<string, ResolvedUserInfo>();
    async function getUserInfo(userId: string): Promise<ResolvedUserInfo> {
      const cached = userCache.get(userId);
      if (cached) return cached;
      const info = await resolveUserInfo(userId);
      userCache.set(userId, info);
      return info;
    }

    const activities = await Promise.all(
      rawEntries.map(async (entry) => {
        const user = await getUserInfo(entry.userId);
        return {
          ...entry,
          userName: user.name,
          userDepartment: user.department,
        };
      }),
    );

    activities.sort(
      (a, b) =>
        new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
    );

    return { activities, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "처리 이력 조회에 실패했습니다.";
    return { activities: [], error: message };
  }
}
