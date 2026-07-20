import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DeadlineWindow } from "./deadline";
import {
  getNoticeSearchOrFilter,
  getNoticeSelect,
  getNoticeTableName,
  getNoticeTypeDbValues,
  hasNoticeDateColumn,
  isCrawlMasterDataset,
  resolveBidNoticeDatasetForSiteId,
  type BidNoticeDataset,
  type CrawlMasterDataset,
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
import { getFavoriteNoticeIds } from "./favorites";
import { getActiveScreeningKeywordTexts } from "./screening-keywords";
import { buildKeywordMatchOrFilter, sanitizeKeywordForIlike } from "./screening-keywords-utils";
import {
  getNoticeDeadline,
  isApproachingDeadline,
  isDeadlineExpired,
} from "./deadline";
import type {
  BidNoticeListResult,
  BidNoticeType,
  ExBidNoticeRow,
  G2bBidNoticeRow,
  KhnpBidNoticeRow,
  KogasBidNoticeRow,
  KrBidNoticeRow,
  LhBidNoticeRow,
} from "./types";
import { chunkIds } from "./utils";
import { matchesExListNoticeType } from "./normalize-ex";
import { matchesG2bListNoticeType } from "./normalize-g2b";
import { matchesKogasListNoticeType } from "./normalize-kogas";
import { matchesKrListNoticeType } from "./normalize-kr";
import { matchesLhListNoticeType } from "./normalize-lh";

type CrawlMasterListRow =
  | G2bBidNoticeRow
  | KogasBidNoticeRow
  | LhBidNoticeRow
  | ExBidNoticeRow
  | KrBidNoticeRow;

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
  search: string | undefined,
  dataset: BidNoticeDataset,
): T {
  const trimmed = search?.trim();
  if (!trimmed) return query;

  const safe = trimmed.replace(/[,()]/g, " ").trim();
  if (!safe) return query;

  const pattern = `%${safe}%`;
  return query.or(getNoticeSearchOrFilter(dataset, pattern)) as T;
}

function applyKeywordScreeningFilter<T extends NoticeQuery>(
  query: T,
  keywords: string[],
  dataset: BidNoticeDataset,
): T {
  const filter = buildKeywordMatchOrFilter(keywords, dataset);
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

function filterNoticesByNormalizedDate(
  notices: KhnpBidNoticeRow[],
  options: Pick<ListBidNoticesOptions, "noticeDate" | "noticeDateYesterday">,
): KhnpBidNoticeRow[] {
  if (options.noticeDate) {
    const { startIso, endIso } = getKstDayRange(options.noticeDate);
    const start = Date.parse(startIso);
    const end = Date.parse(endIso);
    return notices.filter((notice) => {
      if (!notice.notice_date) return false;
      const time = Date.parse(notice.notice_date);
      return time >= start && time < end;
    });
  }

  if (options.noticeDateYesterday) {
    const { startIso, endIso } = getKstYesterdayNoticeDateRange();
    const start = Date.parse(startIso);
    const end = Date.parse(endIso);
    return notices.filter((notice) => {
      if (!notice.notice_date) return false;
      const time = Date.parse(notice.notice_date);
      return time >= start && time < end;
    });
  }

  return notices;
}

function applyCreatedAtFilters<T extends NoticeQuery>(
  query: T,
  options: Pick<ListBidNoticesOptions, "noticeDate" | "noticeDateYesterday">,
): T {
  if (options.noticeDate) {
    const { startIso, endIso } = getKstDayRange(options.noticeDate);
    return query.gte("created_at", startIso).lt("created_at", endIso) as T;
  }
  if (options.noticeDateYesterday) {
    const { startIso, endIso } = getKstYesterdayNoticeDateRange();
    return query.gte("created_at", startIso).lt("created_at", endIso) as T;
  }
  return query;
}

function matchesKeywordScreening(
  notice: KhnpBidNoticeRow,
  keywords: string[],
): boolean {
  const haystack = [
    notice.title,
    notice.notice_no,
    notice.dept_name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => {
    const safe = sanitizeKeywordForIlike(keyword).toLowerCase();
    return safe.length > 0 && haystack.includes(safe);
  });
}

const CRAWL_MASTER_LIST_MATCHERS: Record<
  CrawlMasterDataset,
  (row: CrawlMasterListRow, noticeType: BidNoticeType) => boolean
> = {
  g2b: (row, noticeType) =>
    matchesG2bListNoticeType(row as G2bBidNoticeRow, noticeType),
  kogas: (row, noticeType) =>
    matchesKogasListNoticeType(row as KogasBidNoticeRow, noticeType),
  lh: (row, noticeType) =>
    matchesLhListNoticeType(row as LhBidNoticeRow, noticeType),
  ex: (row, noticeType) =>
    matchesExListNoticeType(row as ExBidNoticeRow, noticeType),
  kr: (row, noticeType) =>
    matchesKrListNoticeType(row as KrBidNoticeRow, noticeType),
};

const CRAWL_MASTER_FALLBACK_DETAIL_KEYS: Record<
  CrawlMasterDataset,
  { open: string; preSpec?: string }
> = {
  g2b: { open: "g2b_bid_open", preSpec: "g2b_bid_pre_spec" },
  kogas: { open: "kogas_bid_open", preSpec: "kogas_bid_pre_spec" },
  lh: { open: "lh_bid_open" },
  ex: { open: "ex_bid_open" },
  kr: { open: "kr_bid_open" },
};

async function listCrawlMasterBidNotices(
  dataset: CrawlMasterDataset,
  options: ListBidNoticesOptions,
  page: number,
  pageSize: number,
): Promise<BidNoticeListResult> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const detailKeys = CRAWL_MASTER_FALLBACK_DETAIL_KEYS[dataset];
  const matchNoticeType = CRAWL_MASTER_LIST_MATCHERS[dataset];

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

  const supabase = createServerClient();
  let query = supabase
    .from(getNoticeTableName(dataset))
    .select(getNoticeSelect(dataset))
    .eq("site_id", options.siteId)
    .eq("is_deleted", false);

  query = applySearchFilter(query, options.search, dataset);
  if (screeningKeywords.length > 0) {
    query = applyKeywordScreeningFilter(query, screeningKeywords, dataset);
  }
  query = applyCreatedAtFilters(query, options);

  let rows: CrawlMasterListRow[];
  const { data, error } = await query.order("created_at", {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    if (
      error.message.includes("relationship") ||
      error.message.includes("schema cache")
    ) {
      let fallbackQuery = supabase
        .from(getNoticeTableName(dataset))
        .select("*")
        .eq("site_id", options.siteId)
        .eq("is_deleted", false);
      fallbackQuery = applySearchFilter(fallbackQuery, options.search, dataset);
      if (screeningKeywords.length > 0) {
        fallbackQuery = applyKeywordScreeningFilter(
          fallbackQuery,
          screeningKeywords,
          dataset,
        );
      }
      fallbackQuery = applyCreatedAtFilters(fallbackQuery, options);
      const { data: fallbackData, error: fallbackError } =
        await fallbackQuery.order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
      if (fallbackError) {
        return { notices: [], total: 0, error: fallbackError.message };
      }
      rows = ((fallbackData ?? []) as CrawlMasterListRow[]).map((row) => ({
        ...row,
        [detailKeys.open]: null,
        ...(detailKeys.preSpec ? { [detailKeys.preSpec]: null } : {}),
      }));
    } else {
      return { notices: [], total: 0, error: error.message };
    }
  } else {
    rows = (data ?? []) as unknown as CrawlMasterListRow[];
  }

  let notices = rows
    .filter((row) => matchNoticeType(row, options.noticeType))
    .map((row) => normalizeNoticeRow(dataset, row));

  if (options.favoritesOnly) {
    if (!options.userId) {
      return { notices: [], total: 0, error: "로그인이 필요합니다." };
    }
    const { noticeIds: favoriteIds, error: favError } = await getFavoriteNoticeIds(
      options.userId,
      { siteId: options.siteId, noticeType: options.noticeType },
    );
    if (favError) {
      return { notices: [], total: 0, error: favError };
    }
    const favoriteSet = new Set(favoriteIds);
    notices = notices.filter((notice) => favoriteSet.has(notice.id));
  }

  if (screeningKeywords.length > 0) {
    notices = notices.filter((notice) =>
      matchesKeywordScreening(notice, screeningKeywords),
    );
  }

  const now = new Date();
  if (options.deadlineWindow) {
    notices = notices.filter((notice) =>
      isApproachingDeadline(notice, options.deadlineWindow!, now),
    );
    notices.sort((a, b) => {
      const da = getNoticeDeadline(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = getNoticeDeadline(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  } else if (options.deadlineClosed) {
    notices = notices.filter((notice) => isDeadlineExpired(notice, now));
  }

  return {
    notices: notices.slice(from, to + 1),
    total: notices.length,
    error: null,
  };
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

  if (isCrawlMasterDataset(dataset)) {
    try {
      return await listCrawlMasterBidNotices(dataset, options, page, pageSize);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "입찰공고 조회에 실패했습니다.";
      return { notices: [], total: 0, error: message };
    }
  }

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
      if (noticeIds.length === 0) {
        return { notices: [] as KhnpBidNoticeRow[], error: null };
      }

      const supabase = createServerClient();
      const table = getNoticeTableName(dataset);
      const select = getNoticeSelect(dataset);
      const noticeTypeValues = !isCrawlMasterDataset(dataset)
        ? getNoticeTypeDbValues(dataset, options.noticeType)
        : null;
      const rows: KhnpBidNoticeRow[] = [];

      for (const idChunk of chunkIds(noticeIds)) {
        let query = supabase
          .from(table)
          .select(select)
          .in("id", idChunk)
          .eq("site_id", options.siteId)
          .eq("is_deleted", false);

        if (noticeTypeValues) {
          query =
            noticeTypeValues.length === 1
              ? query.eq("notice_type", noticeTypeValues[0]!)
              : query.in("notice_type", noticeTypeValues);
        }

        query = applySearchFilter(query, options.search, dataset);
        if (screeningKeywords.length > 0) {
          query = applyKeywordScreeningFilter(query, screeningKeywords, dataset);
        }
        if (hasNoticeDateColumn(dataset)) {
          query = applyNoticeDateFilters(query, options);
        }

        const { data, error } = await query;
        if (error) {
          return { notices: [] as KhnpBidNoticeRow[], error: error.message };
        }

        for (const row of (data ?? []) as unknown as KhnpBidNoticeRow[]) {
          rows.push(normalizeNoticeRow(dataset, row));
        }
      }

      const orderMap = new Map(noticeIds.map((id, i) => [id, i]));
      let sorted = rows.sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );

      if (!hasNoticeDateColumn(dataset)) {
        sorted = filterNoticesByNormalizedDate(sorted, options);
      }

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
