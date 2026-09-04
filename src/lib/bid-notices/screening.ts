import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getAllNoticeTableNames,
  getNoticeTableName,
  getNoticeTypeDbValues,
  resolveBidNoticeDatasetForSiteId,
  resolveDatasetFromNoticeTableName,
} from "./dataset";
import { getBidNoticeById } from "./notices";
import type { BidNoticeType } from "./types";
import { chunkIds } from "./utils";

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
    const { data, error } = await supabase
      .from("user_bid_notice_screening")
      .select("notice_id, status")
      .eq("user_id", userId);

    if (error) {
      return { statuses: {}, error: normalizeScreeningError(error.message) };
    }

    const rawStatuses: Record<string, BidNoticeScreeningStatus> = {};
    for (const row of data ?? []) {
      rawStatuses[row.notice_id as string] = parseScreeningStatus(
        row.status as string,
      );
    }

    if (filters?.siteId == null && !filters?.noticeType) {
      return { statuses: rawStatuses, error: null };
    }

    const noticeIds = Object.keys(rawStatuses);
    if (noticeIds.length === 0) {
      return { statuses: {}, error: null };
    }

    const dataset = await resolveBidNoticeDatasetForSiteId(filters.siteId!);
    const tables =
      filters?.siteId != null
        ? [getNoticeTableName(dataset)]
        : getAllNoticeTableNames();

    const matched = new Set<string>();
    for (const table of tables) {
      for (const idChunk of chunkIds(noticeIds)) {
        let query = supabase
          .from(table)
          .select("id")
          .in("id", idChunk)
          .eq("is_deleted", false);
        if (filters?.siteId != null) {
          query = query.eq("site_id", filters.siteId);
        }
        if (filters?.noticeType) {
          const tableDataset = resolveDatasetFromNoticeTableName(table);
          const noticeTypeValues = getNoticeTypeDbValues(
            tableDataset,
            filters.noticeType,
          );
          query =
            noticeTypeValues.length === 1
              ? query.eq("notice_type", noticeTypeValues[0]!)
              : query.in("notice_type", noticeTypeValues);
        }
        const { data: noticeRows, error: noticeError } = await query;
        if (noticeError) {
          return {
            statuses: {},
            error: normalizeScreeningError(noticeError.message),
          };
        }
        for (const row of noticeRows ?? []) {
          matched.add(row.id as string);
        }
      }
    }

    const statuses: Record<string, BidNoticeScreeningStatus> = {};
    for (const [noticeId, status] of Object.entries(rawStatuses)) {
      if (matched.has(noticeId)) {
        statuses[noticeId] = status;
      }
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

    const { notice, error: noticeError } = await getBidNoticeById(noticeId);

    if (noticeError) {
      return { status: "WAITING", error: normalizeScreeningError(noticeError) };
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

const BULK_SCREENING_MAX_NOTICE_IDS = 10_000;

export async function bulkSetNoticeScreeningStatuses(
  userId: string,
  noticeIds: string[],
  status: BidNoticeScreeningStatus,
): Promise<{ updatedCount: number; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { updatedCount: 0, error: configError };
  }

  const uniqueIds = [...new Set(noticeIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { updatedCount: 0, error: "선별할 공고가 없습니다." };
  }
  if (uniqueIds.length > BULK_SCREENING_MAX_NOTICE_IDS) {
    return {
      updatedCount: 0,
      error: `일괄 선별은 최대 ${BULK_SCREENING_MAX_NOTICE_IDS.toLocaleString("ko-KR")}건까지 가능합니다.`,
    };
  }

  const nextStatus = parseScreeningStatus(status);
  const now = new Date().toISOString();

  try {
    const supabase = createServerClient();
    let updatedCount = 0;

    for (const idChunk of chunkIds(uniqueIds)) {
      const rows = idChunk.map((noticeId) => ({
        user_id: userId,
        notice_id: noticeId,
        status: nextStatus,
        updated_at: now,
      }));

      const { error } = await supabase
        .from("user_bid_notice_screening")
        .upsert(rows, { onConflict: "user_id,notice_id" });

      if (error) {
        return {
          updatedCount,
          error: normalizeScreeningError(error.message),
        };
      }
      updatedCount += idChunk.length;
    }

    return { updatedCount, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "일괄 선별에 실패했습니다.";
    return { updatedCount: 0, error: normalizeScreeningError(message) };
  }
}
