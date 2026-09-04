import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCrawlSites } from "@/lib/crawl-sites";
import type { DeadlineWindow } from "./deadline";
import {
  getNoticeSearchOrFilter,
  getNoticeListOrderColumn,
  getNoticeSelect,
  getNoticeTableName,
  getNoticeTypeDbValues,
  excludesExpiredNoticesInDefaultList,
  hasNoticeDateColumn,
  isCrawlMasterDataset,
  isNoticeTypeValidForDataset,
  resolveBidNoticeDatasetForSiteId,
  resolveBidNoticeDatasetFromSite,
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
import { chunkIds, getOpenDetail } from "./utils";
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
  /** null/undefined = 전체 사이트 */
  siteId?: number | null;
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
  /** 입찰공고 목록 「구분」(purchase_type) 필터 */
  purchaseType?: string | null;
}

function getNoticePurchaseType(notice: KhnpBidNoticeRow): string | null {
  const value = getOpenDetail(notice)?.purchase_type?.trim();
  return value ? value : null;
}

function collectPurchaseTypes(notices: KhnpBidNoticeRow[]): string[] {
  const values = new Set<string>();
  for (const notice of notices) {
    const value = getNoticePurchaseType(notice);
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, "ko"));
}

function applyPurchaseTypeFilter(
  notices: KhnpBidNoticeRow[],
  purchaseType?: string | null,
): KhnpBidNoticeRow[] {
  const trimmed = purchaseType?.trim();
  if (!trimmed) return notices;
  return notices.filter(
    (notice) => getNoticePurchaseType(notice) === trimmed,
  );
}

function finalizeNoticePage(
  notices: KhnpBidNoticeRow[],
  options: Pick<ListBidNoticesOptions, "purchaseType">,
  page: number,
  pageSize: number,
): BidNoticeListResult {
  const purchaseTypes = collectPurchaseTypes(notices);
  const filtered = applyPurchaseTypeFilter(notices, options.purchaseType);
  const from = (page - 1) * pageSize;
  return {
    notices: filtered.slice(from, from + pageSize),
    total: filtered.length,
    purchaseTypes,
    error: null,
  };
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
  let orFilter = getNoticeSearchOrFilter(dataset, pattern);
  if (/^[A-Za-z0-9_-]+$/.test(safe)) {
    orFilter = `${orFilter},notice_no.eq.${safe}`;
  }
  return query.or(orFilter) as T;
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

function hasActiveSearch(search: string | undefined): boolean {
  return Boolean(search?.trim());
}

async function listStandardBidNoticesWithSearchFirst(
  dataset: BidNoticeDataset,
  options: ListBidNoticesOptions & { siteId: number },
  page: number,
  pageSize: number,
  screeningKeywords: string[],
): Promise<BidNoticeListResult> {
  const supabase = createServerClient();
  const table = getNoticeTableName(dataset);
  const select = getNoticeSelect(dataset);
  const noticeTypeValues = getNoticeTypeDbValues(dataset, options.noticeType);

  let query = supabase
    .from(table)
    .select(select)
    .eq("site_id", options.siteId)
    .eq("is_deleted", false);

  if (noticeTypeValues.length === 1) {
    query = query.eq("notice_type", noticeTypeValues[0]!);
  } else {
    query = query.in("notice_type", noticeTypeValues);
  }

  query = applySearchFilter(query, options.search, dataset);
  if (hasNoticeDateColumn(dataset)) {
    query = applyNoticeDateFilters(query, options);
  }

  const { data, error } = await query.order(getNoticeListOrderColumn(dataset), {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    return { notices: [], total: 0, error: error.message };
  }

  let notices = ((data ?? []) as unknown as KhnpBidNoticeRow[]).map((row) =>
    normalizeNoticeRow(dataset, row),
  );

  if (!hasNoticeDateColumn(dataset)) {
    notices = filterNoticesByNormalizedDate(notices, options);
  }

  if (screeningKeywords.length > 0) {
    notices = notices.filter((notice) =>
      matchesKeywordScreening(notice, screeningKeywords),
    );
  }

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
  } else if (!hasActiveSearch(options.search)) {
    if (excludesExpiredNoticesInDefaultList(dataset)) {
      notices = notices.filter((notice) => !isDeadlineExpired(notice, now));
    }
  }

  return finalizeNoticePage(notices, options, page, pageSize);
}

async function listCrawlMasterBidNotices(
  dataset: CrawlMasterDataset,
  options: ListBidNoticesOptions & { siteId: number },
  page: number,
  pageSize: number,
): Promise<BidNoticeListResult> {
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
      rows = ((fallbackData ?? []) as unknown as CrawlMasterListRow[]).map((row) => ({
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
      { siteId: options.siteId ?? undefined, noticeType: options.noticeType },
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

  return finalizeNoticePage(notices, options, page, pageSize);
}

export async function listBidNotices(
  options: ListBidNoticesOptions,
): Promise<BidNoticeListResult> {
  if (!isSupabaseConfigured()) {
    return { notices: [], total: 0, error: null };
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  if (options.siteId == null) {
    return listBidNoticesAcrossSites(options, page, pageSize);
  }

  return listBidNoticesForSite(
    { ...options, siteId: options.siteId },
    page,
    pageSize,
  );
}

async function listAllNoticesForSite(
  siteId: number,
  options: Omit<ListBidNoticesOptions, "siteId" | "page" | "pageSize">,
): Promise<BidNoticeListResult> {
  const pageSize = 100;
  let page = 1;
  const notices: KhnpBidNoticeRow[] = [];
  let total = Infinity;

  while (notices.length < total && page <= 40) {
    const result = await listBidNoticesForSite(
      { ...options, siteId, page, pageSize },
      page,
      pageSize,
    );
    if (result.error) {
      return result;
    }
    total = result.total;
    notices.push(...result.notices);
    if (result.notices.length === 0) break;
    page += 1;
  }

  return { notices, total: notices.length, error: null };
}

async function listBidNoticesAcrossSites(
  options: ListBidNoticesOptions,
  page: number,
  pageSize: number,
): Promise<BidNoticeListResult> {
  const { sites, error: sitesError } = await getCrawlSites({ activeOnly: true });
  if (sitesError) {
    return { notices: [], total: 0, error: sitesError };
  }

  const eligibleSites = sites.filter((site) => {
    const dataset = resolveBidNoticeDatasetFromSite(site);
    return isNoticeTypeValidForDataset(dataset, options.noticeType);
  });

  if (eligibleSites.length === 0) {
    return { notices: [], total: 0, error: null };
  }

  const results = await Promise.all(
    eligibleSites.map((site) =>
      listAllNoticesForSite(site.id, {
        noticeType: options.noticeType,
        search: options.search,
        favoritesOnly: options.favoritesOnly,
        userId: options.userId,
        deadlineWindow: options.deadlineWindow,
        deadlineClosed: options.deadlineClosed,
        noticeDateYesterday: options.noticeDateYesterday,
        noticeDate: options.noticeDate,
        keywordScreeningOnly: options.keywordScreeningOnly,
      }),
    ),
  );

  const firstError = results.find((result) => result.error)?.error ?? null;
  if (firstError) {
    return { notices: [], total: 0, error: firstError };
  }

  const merged = results.flatMap((result) => result.notices);
  const seen = new Set<string>();
  const unique = merged.filter((notice) => {
    if (seen.has(notice.id)) return false;
    seen.add(notice.id);
    return true;
  });

  unique.sort((a, b) => {
    const aTime = Date.parse(a.notice_date ?? a.created_at ?? "") || 0;
    const bTime = Date.parse(b.notice_date ?? b.created_at ?? "") || 0;
    return bTime - aTime;
  });

  return finalizeNoticePage(unique, options, page, pageSize);
}

async function listBidNoticesForSite(
  options: ListBidNoticesOptions & { siteId: number },
  page: number,
  pageSize: number,
): Promise<BidNoticeListResult> {
  const dataset = await resolveBidNoticeDatasetForSiteId(options.siteId);

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

    if (hasActiveSearch(options.search)) {
      return listStandardBidNoticesWithSearchFirst(
        dataset,
        options,
        page,
        pageSize,
        screeningKeywords,
      );
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

      return finalizeNoticePage(sorted, options, page, pageSize);
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

    return finalizeNoticePage(sorted, options, page, pageSize);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 조회에 실패했습니다.";
    return { notices: [], total: 0, error: message };
  }
}
