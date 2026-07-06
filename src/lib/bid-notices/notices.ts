import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DeadlineWindow } from "./deadline";
import {
  getNoticeSelect,
  getNoticeTableName,
  resolveBidNoticeDatasetForSiteId,
} from "./dataset";
import { getKstDayRange, getKstYesterdayNoticeDateRange } from "./notice-date";
import {
  getApproachingNoticeIds,
  getNoticeIdsByDeadlineStatus,
} from "./notice-deadline-ids";
import {
  fetchBidNoticesForSite,
  getBidNoticeById,
  normalizeNoticeRow,
} from "./notice-repository";
import { getActiveScreeningKeywordTexts } from "./screening-keywords";
import { buildKeywordMatchOrFilter } from "./screening-keywords-utils";
import type {
  BidNoticeListResult,
  BidNoticeType,
  KhnpBidNoticeRow,
  SrmBidNoticeRow,
} from "./types";

export {
  fetchBidNoticesForSite,
  fetchBidNoticesByIdsForSite,
  getBidNoticeById,
  getBidNoticesByIds,
  normalizeNoticeRow,
} from "./notice-repository";

export interface ListBidNoticesOptions {
  siteId: number;
  noticeType: BidNoticeType;
  page?: number;
  pageSize?: number;
  search?: string;
  favoritesOnly?: boolean;
  userId?: string;
  deadlineWindow?: DeadlineWindow;
  deadlineClosed?: boolean;
  noticeDateYesterday?: boolean;
  noticeDate?: string;
  keywordScreeningOnly?: boolean;
}

type NoticeQuery = {
  gte(column: string, value: string): NoticeQuery;
  lt(column: string, value: string): NoticeQuery;
  or(filter: string): NoticeQuery;
};

function applySearchFilter<T extends NoticeQuery>(
  query: T,
  search?: string,
): T {
  const trimmed = search?.trim();
  if (!trimmed) return query;

  const safe = trimmed.replace(/[,()]/g, " ").trim();
  if (!safe) return query;

  const pattern = `%${safe}%`;
  return query.or(
    `title.ilike.${pattern},notice_no.ilike.${pattern},dept_name.ilike.${pattern},company_name.ilike.${pattern}`,
  ) as T;
}

function applyKeywordScreeningFilter<T extends NoticeQuery>(
  query: T,
  keywords: string[],
): T {
  const filter = buildKeywordMatchOrFilter(keywords);
  if (!filter) return query;
  return query.or(filter) as T;
}

function applyNoticeDateYesterdayFilter<T extends NoticeQuery>(
  query: T,
  enabled?: boolean,
): T {
  if (!enabled) return query;
  const { startIso, endIso } = getKstYesterdayNoticeDateRange();
  return query.gte("notice_date", startIso).lt("notice_date", endIso) as T;
}

function applyNoticeDateFilters<T extends NoticeQuery>(
  query: T,
  options: Pick<ListBidNoticesOptions, "noticeDate" | "noticeDateYesterday">,
): T {
  if (options.noticeDate) {
    const { startIso, endIso } = getKstDayRange(options.noticeDate);
    return query.gte("notice_date", startIso).lt("notice_date", endIso) as T;
  }
  return applyNoticeDateYesterdayFilter(query, options.noticeDateYesterday);
}

export async function listBidNotices(
  options: ListBidNoticesOptions,
): Promise<BidNoticeListResult> {
  if (!isSupabaseConfigured()) {
    return { notices: [], total: 0, error: null };
  }

  const dataset = await resolveBidNoticeDatasetForSiteId(options.siteId);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let screeningKeywords: string[] = [];
    if (options.keywordScreeningOnly) {
      const { keywords, error: keywordError } =
        await getActiveScreeningKeywordTexts();
      if (keywordError) {
        return { notices: [], total: 0, error: keywordError };
      }
      if (keywords.length === 0) {
        return { notices: [], total: 0, error: null };
      }
      screeningKeywords = keywords;
    }

    async function fetchFilteredNotices(noticeIds: string[]) {
      const supabase = createServerClient();
      let query = supabase
        .from(getNoticeTableName(dataset))
        .select(getNoticeSelect(dataset), { count: "exact" })
        .in("id", noticeIds)
        .eq("site_id", options.siteId)
        .eq("notice_type", options.noticeType)
        .eq("is_deleted", false);

      query = applySearchFilter(query, options.search);
      if (screeningKeywords.length > 0) {
        query = applyKeywordScreeningFilter(query, screeningKeywords);
      }
      query = applyNoticeDateFilters(query, options);

      const { data, error } = await query;
      if (error) {
        return { notices: [] as KhnpBidNoticeRow[], error: error.message };
      }

      const orderMap = new Map(noticeIds.map((id, i) => [id, i]));
      const sorted = ((data ?? []) as unknown as Array<KhnpBidNoticeRow | SrmBidNoticeRow>)
        .map((row) => normalizeNoticeRow(dataset, row))
        .sort(
          (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
        );

      return { notices: sorted, error: null };
    }

    if (options.deadlineWindow) {
      const { noticeIds, error: deadlineError } = await getApproachingNoticeIds({
        siteId: options.siteId,
        noticeType: options.noticeType,
        window: options.deadlineWindow,
        userId: options.userId,
        favoritesOnly: options.favoritesOnly,
      });

      if (deadlineError) {
        return { notices: [], total: 0, error: deadlineError };
      }
      if (noticeIds.length === 0) {
        return { notices: [], total: 0, error: null };
      }

      const { notices: sorted, error } = await fetchFilteredNotices(noticeIds);
      if (error) {
        return { notices: [], total: 0, error };
      }

      return {
        notices: sorted.slice(from, to + 1),
        total: sorted.length,
        error: null,
      };
    }

    const deadlineStatus = options.deadlineClosed ? "expired" : "active";
    const { noticeIds, error: statusError } = await getNoticeIdsByDeadlineStatus({
      siteId: options.siteId,
      noticeType: options.noticeType,
      status: deadlineStatus,
      userId: options.userId,
      favoritesOnly: options.favoritesOnly,
    });

    if (statusError) {
      return { notices: [], total: 0, error: statusError };
    }
    if (noticeIds.length === 0) {
      return { notices: [], total: 0, error: null };
    }

    const { notices: sorted, error } = await fetchFilteredNotices(noticeIds);
    if (error) {
      return { notices: [], total: 0, error };
    }

    return {
      notices: sorted.slice(from, to + 1),
      total: sorted.length,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 조회에 실패했습니다.";
    return { notices: [], total: 0, error: message };
  }
}
