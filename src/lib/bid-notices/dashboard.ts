import { createServerClient } from "@/lib/supabase/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { listUserEstimateSubmissions } from "./estimates";

import { getFavoriteNoticeIds, getOtherDepartmentFavoriteRows } from "./favorites";

import { listUserBidSubmissions } from "./submissions";

import { listUserOrderReports } from "./order-reports";

import { getScreeningStatusMap } from "./screening";

import {
  getKstRollingMonthRange,
  toKstDateYmd,
} from "./notice-date";

import {

  getDeadlineCountdown,

  getNoticeDeadline,

  isApproachingDeadline,

  isDeadlineExpired,

  type DeadlineListFilter,

  type DeadlineWindow,

} from "./deadline";

import {
  fetchBidNoticesForSite,
  normalizeNoticeRow,
} from "./notice-repository";
import {
  getNoticeListOrderColumn,
  getNoticeSelect,
  getNoticeTableName,
  getNoticeTypesForDataset,
  hasNoticeDateColumn,
  resolveBidNoticeDatasetForSiteId,
  type BidNoticeDataset,
} from "./dataset";
import type {
  BidNoticeType,
  G2bBidNoticeRow,
  KhnpBidNoticeRow,
  KogasBidNoticeRow,
  SrmBidNoticeRow,
} from "./types";

export {
  getApproachingNoticeIds,
  getNoticeIdsByDeadlineStatus,
} from "./notice-deadline-ids";



export interface DashboardFavoriteItem {

  notice: KhnpBidNoticeRow;

  siteName: string | null;

}



export interface ApproachingDeadlineCounts {

  week: Record<BidNoticeType, number>;

  day: Record<BidNoticeType, number>;

}



export type DashboardNoticeStatus = "new" | "review" | "submitted" | "missed";



export interface DashboardKpis {

  monthlyNotices: number;

  reviewingCount: number;

  urgentDeadlineCount: number;

  submittedCount: number;

  estimateCount: number;

}



export interface DashboardCalendarNotice {

  notice: KhnpBidNoticeRow;

  siteName: string | null;

  /** mine = 내 관심, other = 타부서 관심, both = 둘 다, none = 일반(전체 모드) */
  favoriteSource?: "mine" | "other" | "both" | "none";

}



export interface DashboardNoticeCalendar {

  rangeStart: string;

  rangeEnd: string;

  countsByDate: Record<string, number>;

  /** 관심공고만 모드: 내 관심공고 건수 */
  mineCountsByDate: Record<string, number>;

  /** 관심공고만 모드: 타부서 관심공고 건수 */
  otherDeptCountsByDate: Record<string, number>;

  noticesByDate: Record<string, DashboardCalendarNotice[]>;

}



export interface DashboardScheduleEntry {

  notice: KhnpBidNoticeRow;

  siteName: string | null;

  deadlineIso: string;

  scheduleLabel: string;

  urgent: boolean;

}



export interface DashboardEstimateEntry {

  notice: KhnpBidNoticeRow;

  siteName: string | null;

  hasEstimate: boolean;

  hasBid: boolean;

  submittedAt: string | null;

}



export interface DashboardOtherDeptFavoriteItem {

  notice: KhnpBidNoticeRow;

  siteName: string | null;

  department: string;

  favoritedBy: Array<{ userId: string; name: string }>;

  latestFavoritedAt: string | null;

}



export type DashboardScope = "all" | "favorites";

export interface DashboardData {

  favorites: DashboardFavoriteItem[];

  approachingCounts: ApproachingDeadlineCounts;

  kpis: DashboardKpis;

  noticeCalendar: DashboardNoticeCalendar;

  deadlineSchedule: DashboardScheduleEntry[];

  estimates: DashboardEstimateEntry[];

  otherDeptFavorites: DashboardOtherDeptFavoriteItem[];

  error: string | null;

}



function emptyCounts(): ApproachingDeadlineCounts {
  return {
    week: {
      BID: 0,
      PRIVATE: 0,
      PLAN_SPEC: 0,
      SPEC_REVIEW: 0,
      PRE_SPEC: 0,
    },
    day: {
      BID: 0,
      PRIVATE: 0,
      PLAN_SPEC: 0,
      SPEC_REVIEW: 0,
      PRE_SPEC: 0,
    },
  };
}



function emptyKpis(): DashboardKpis {

  return {

    monthlyNotices: 0,

    reviewingCount: 0,

    urgentDeadlineCount: 0,

    submittedCount: 0,

    estimateCount: 0,

  };

}



function mapDashboardNoticeRow(
  dataset: BidNoticeDataset,
  row: (KhnpBidNoticeRow | SrmBidNoticeRow | G2bBidNoticeRow | KogasBidNoticeRow) & {
    crawl_sites: { site_name: string } | { site_name: string }[] | null;
  },
): KhnpBidNoticeRow {
  const { crawl_sites: _crawlSites, ...notice } = row;
  return normalizeNoticeRow(
    dataset,
    notice as KhnpBidNoticeRow | SrmBidNoticeRow | G2bBidNoticeRow | KogasBidNoticeRow,
  );
}

function resolveSiteName(
  crawlSites: { site_name: string } | { site_name: string }[] | null,
): string | null {
  if (crawlSites == null) return null;
  return Array.isArray(crawlSites) ? crawlSites[0]?.site_name ?? null : crawlSites.site_name;
}

function getKstMonthRange(now: Date = new Date()): { start: string; end: string } {

  const formatter = new Intl.DateTimeFormat("en-CA", {

    timeZone: "Asia/Seoul",

    year: "numeric",

    month: "2-digit",

  });

  const parts = formatter.formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";

  const month = parts.find((p) => p.type === "month")?.value ?? "01";

  const start = `${year}-${month}-01`;

  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;

  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);

  const end = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  return { start, end };

}



function emptyNoticeCalendar(): DashboardNoticeCalendar {

  const { startYmd, endYmd } = getKstRollingMonthRange();

  return {

    rangeStart: startYmd,

    rangeEnd: endYmd,

    countsByDate: {},

    mineCountsByDate: {},

    otherDeptCountsByDate: {},

    noticesByDate: {},

  };

}



function buildNoticeCalendar(

  notices: Array<{
    notice: KhnpBidNoticeRow;
    siteName: string | null;
    favoriteSource?: DashboardCalendarNotice["favoriteSource"];
  }>,

  now: Date,

): DashboardNoticeCalendar {

  const { startYmd, endYmd } = getKstRollingMonthRange(now);

  const countsByDate: Record<string, number> = {};

  const mineCountsByDate: Record<string, number> = {};

  const otherDeptCountsByDate: Record<string, number> = {};

  const noticesByDate: Record<string, DashboardCalendarNotice[]> = {};



  for (const item of notices) {

    if (!item.notice.notice_date) continue;

    const ymd = toKstDateYmd(item.notice.notice_date);

    if (!ymd || ymd < startYmd || ymd > endYmd) continue;



    countsByDate[ymd] = (countsByDate[ymd] ?? 0) + 1;

    const source = item.favoriteSource ?? "none";
    if (source === "mine" || source === "both") {
      mineCountsByDate[ymd] = (mineCountsByDate[ymd] ?? 0) + 1;
    }
    if (source === "other" || source === "both") {
      otherDeptCountsByDate[ymd] = (otherDeptCountsByDate[ymd] ?? 0) + 1;
    }

    const bucket = noticesByDate[ymd] ?? [];

    bucket.push({
      notice: item.notice,
      siteName: item.siteName,
      favoriteSource: source,
    });

    noticesByDate[ymd] = bucket;

  }



  for (const ymd of Object.keys(noticesByDate)) {

    noticesByDate[ymd]!.sort(

      (a, b) =>

        new Date(b.notice.notice_date ?? 0).getTime() -

        new Date(a.notice.notice_date ?? 0).getTime(),

    );

  }



  return {
    rangeStart: startYmd,
    rangeEnd: endYmd,
    countsByDate,
    mineCountsByDate,
    otherDeptCountsByDate,
    noticesByDate,
  };

}



export async function getDashboardData(options: {

  userId: string;

  siteId: number;

  /** 현재 사용자 부서 — 타부서 관심공고 판별용 */
  department?: string;

  /** all = 사이트 전체, favorites = 관심공고만 */
  scope?: DashboardScope;

  favoriteLimit?: number;

}): Promise<DashboardData> {

  if (!isSupabaseConfigured()) {

    return {

      favorites: [],

      approachingCounts: emptyCounts(),

      kpis: emptyKpis(),

      noticeCalendar: emptyNoticeCalendar(),

      deadlineSchedule: [],

      estimates: [],

      otherDeptFavorites: [],

      error: null,

    };

  }



  const limit = Math.min(50, Math.max(1, options.favoriteLimit ?? 15));

  const scope: DashboardScope =
    options.scope === "favorites" ? "favorites" : "all";

  const now = new Date();



  try {

    const supabase = createServerClient();
    const dataset = await resolveBidNoticeDatasetForSiteId(options.siteId);
    const noticeTable = getNoticeTableName(dataset);
    const noticeSelect = `${getNoticeSelect(dataset)}, crawl_sites ( site_name )`;
    const siteNoticeTypes = getNoticeTypesForDataset(dataset);
    const listOrderColumn = getNoticeListOrderColumn(dataset);
    const dateColumn = hasNoticeDateColumn(dataset) ? "notice_date" : "created_at";

    const { start: monthStart, end: monthEnd } = getKstMonthRange(now);

    const { startIso: calendarStart, endIso: calendarEnd } =
      getKstRollingMonthRange(now);



    const [

      { noticeIds: favoriteIdsList, error: favError },

      {
        rows: otherDeptFavRows,
        noticeIds: otherDeptNoticeIds,
        error: otherDeptFavError,
      },

      { submissions: bidSubmissions, error: bidError },

      { submissions: estimateSubmissions, error: estimateError },

      { reports: orderReports, error: orderReportError },

      { count: monthlyCount, error: monthlyError },

      { data: recentRows, error: recentError },

      { data: calendarRows, error: calendarError },

      { statuses: screeningStatuses, error: screeningError },

    ] = await Promise.all([

      getFavoriteNoticeIds(options.userId, { siteId: options.siteId }),

      getOtherDepartmentFavoriteRows({
        currentUserId: options.userId,
        currentDepartment: options.department ?? "",
        siteId: options.siteId,
      }),

      listUserBidSubmissions(options.userId),

      listUserEstimateSubmissions(options.userId),

      listUserOrderReports(options.userId),

      supabase

        .from(noticeTable)

        .select("id", { count: "exact", head: true })

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .gte(dateColumn, monthStart)

        .lt(dateColumn, monthEnd),

      supabase

        .from(noticeTable)

        .select(noticeSelect)

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .order(listOrderColumn, { ascending: false, nullsFirst: false })

        .limit(40),

      supabase

        .from(noticeTable)

        .select(noticeSelect)

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .gte(dateColumn, calendarStart)

        .lt(dateColumn, calendarEnd)

        .not(dateColumn, "is", null)

        .order(listOrderColumn, { ascending: false }),

      getScreeningStatusMap(options.userId, { siteId: options.siteId }),

    ]);



    const firstError =

      favError ??

      otherDeptFavError ??

      bidError ??

      estimateError ??

      orderReportError ??

      monthlyError ??

      recentError ??

      calendarError ??

      screeningError;

    if (firstError) {

      return {

        favorites: [],

        approachingCounts: emptyCounts(),

        kpis: emptyKpis(),

        noticeCalendar: emptyNoticeCalendar(),

      deadlineSchedule: [],

      estimates: [],

      otherDeptFavorites: [],

      error: typeof firstError === "string" ? firstError : firstError.message,

      };

    }



    const favoriteIds = new Set(favoriteIdsList);
    const otherDeptFavoriteIds = new Set(otherDeptNoticeIds);

    const siteBidIds = new Set(

      bidSubmissions

        .filter((s) => s.siteId === options.siteId)

        .map((s) => s.noticeId),

    );

    const siteEstimateIds = new Set(

      estimateSubmissions

        .filter((s) => s.siteId === options.siteId)

        .map((s) => s.noticeId),

    );

    const siteOrderReportIds = new Set(

      orderReports

        .filter((r) => r.siteId === options.siteId)

        .map((r) => r.noticeId),

    );



    const allSiteNotices = ((recentRows ?? []) as unknown as Array<
      (KhnpBidNoticeRow | SrmBidNoticeRow | G2bBidNoticeRow | KogasBidNoticeRow) & {
        crawl_sites: { site_name: string } | { site_name: string }[] | null;
      }
    >).map((row) => {
      const { crawl_sites } = row;
      return {
        notice: mapDashboardNoticeRow(dataset, row),
        siteName: resolveSiteName(crawl_sites),
      };
    });



    const activeNotices = allSiteNotices.filter(

      ({ notice }) => !isDeadlineExpired(notice, now),

    );



    let favorites: DashboardFavoriteItem[] = [];

    if (favoriteIds.size > 0) {

      const { data: favRows, error: favListError } = await supabase

        .from(noticeTable)

        .select(noticeSelect)

        .in("id", [...favoriteIds])

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .order(listOrderColumn, { ascending: false, nullsFirst: false })

        .limit(Math.min(500, Math.max(limit, favoriteIds.size)));



      if (favListError) {

        return {

          favorites: [],

          approachingCounts: emptyCounts(),

          kpis: emptyKpis(),

          noticeCalendar: emptyNoticeCalendar(),

          deadlineSchedule: [],

          estimates: [],

          otherDeptFavorites: [],

          error: favListError.message,

        };

      }



      favorites = (favRows ?? []).map((row) => {
        const typedRow = row as unknown as (KhnpBidNoticeRow | SrmBidNoticeRow) & {
          crawl_sites: { site_name: string } | { site_name: string }[] | null;
        };
        const { crawl_sites } = typedRow;
        return {
          notice: mapDashboardNoticeRow(dataset, typedRow),
          siteName: resolveSiteName(crawl_sites),
        };
      });

    }



    const approachingSource =
      scope === "favorites"
        ? favorites
        : [
            ...favorites,
            ...activeNotices.filter(({ notice }) => !favoriteIds.has(notice.id)),
          ];

    const approachingCounts = emptyCounts();

    for (const { notice } of approachingSource) {

      const noticeType = notice.notice_type;

      if (!siteNoticeTypes.includes(noticeType)) continue;

      if (isApproachingDeadline(notice, "week", now)) {

        approachingCounts.week[noticeType] += 1;

      }

      if (isApproachingDeadline(notice, "day", now)) {

        approachingCounts.day[noticeType] += 1;

      }

    }



    const urgentDeadlineCount = siteNoticeTypes.reduce(

      (sum, type) => sum + approachingCounts.day[type],

      0,

    );



    const reviewingSource =
      scope === "favorites" ? favorites : activeNotices;

    const reviewingCount = reviewingSource.filter(

      ({ notice }) => !isDeadlineExpired(notice, now),

    ).length;



    const calendarNoticesRaw = ((calendarRows ?? []) as unknown as Array<
      (KhnpBidNoticeRow | SrmBidNoticeRow) & {
        crawl_sites: { site_name: string } | { site_name: string }[] | null;
      }
    >).map((row) => {
      const { crawl_sites } = row;
      return {
        notice: mapDashboardNoticeRow(dataset, row),
        siteName: resolveSiteName(crawl_sites),
      };
    });

    // 타부서 관심공고 상세 (캘린더·패널용)
    const otherDeptMetaById = new Map(
      otherDeptFavRows.map((row) => [row.noticeId, row]),
    );
    let otherDeptNoticeItems: Array<{
      notice: KhnpBidNoticeRow;
      siteName: string | null;
    }> = [];

    if (otherDeptFavoriteIds.size > 0) {
      const { data: otherRows, error: otherListError } = await supabase
        .from(noticeTable)
        .select(noticeSelect)
        .in("id", [...otherDeptFavoriteIds])
        .eq("site_id", options.siteId)
        .eq("is_deleted", false)
        .order(listOrderColumn, { ascending: false, nullsFirst: false })
        .limit(500);

      if (otherListError) {
        return {
          favorites: [],
          approachingCounts: emptyCounts(),
          kpis: emptyKpis(),
          noticeCalendar: emptyNoticeCalendar(),
          deadlineSchedule: [],
          estimates: [],
          otherDeptFavorites: [],
          error: otherListError.message,
        };
      }

      otherDeptNoticeItems = (otherRows ?? []).map((row) => {
        const typedRow = row as unknown as (KhnpBidNoticeRow | SrmBidNoticeRow) & {
          crawl_sites: { site_name: string } | { site_name: string }[] | null;
        };
        const { crawl_sites } = typedRow;
        return {
          notice: mapDashboardNoticeRow(dataset, typedRow),
          siteName: resolveSiteName(crawl_sites),
        };
      });
    }

    const resolveFavoriteSource = (
      noticeId: string,
    ): DashboardCalendarNotice["favoriteSource"] => {
      const isMine = favoriteIds.has(noticeId);
      const isOther = otherDeptFavoriteIds.has(noticeId);
      if (isMine && isOther) return "both";
      if (isMine) return "mine";
      if (isOther) return "other";
      return "none";
    };

    let calendarNotices: Array<{
      notice: KhnpBidNoticeRow;
      siteName: string | null;
      favoriteSource?: DashboardCalendarNotice["favoriteSource"];
    }>;

    if (scope === "favorites") {
      const byId = new Map<
        string,
        {
          notice: KhnpBidNoticeRow;
          siteName: string | null;
          favoriteSource: DashboardCalendarNotice["favoriteSource"];
        }
      >();
      for (const item of favorites) {
        byId.set(item.notice.id, {
          notice: item.notice,
          siteName: item.siteName,
          favoriteSource: resolveFavoriteSource(item.notice.id),
        });
      }
      for (const item of otherDeptNoticeItems) {
        const existing = byId.get(item.notice.id);
        if (existing) {
          existing.favoriteSource = resolveFavoriteSource(item.notice.id);
        } else {
          byId.set(item.notice.id, {
            notice: item.notice,
            siteName: item.siteName,
            favoriteSource: resolveFavoriteSource(item.notice.id),
          });
        }
      }
      calendarNotices = [...byId.values()];
    } else {
      calendarNotices = calendarNoticesRaw.map((item) => ({
        ...item,
        favoriteSource: resolveFavoriteSource(item.notice.id),
      }));
    }

    const noticeCalendar = buildNoticeCalendar(calendarNotices, now);

    const otherDeptFavorites: DashboardOtherDeptFavoriteItem[] =
      otherDeptNoticeItems
        .map(({ notice, siteName }) => {
          const meta = otherDeptMetaById.get(notice.id);
          if (!meta) return null;
          return {
            notice,
            siteName,
            department: meta.department,
            favoritedBy: meta.users,
            latestFavoritedAt: meta.latestFavoritedAt,
          };
        })
        .filter(
          (item): item is DashboardOtherDeptFavoriteItem => item != null,
        )
        .sort((a, b) => {
          const aTime = a.latestFavoritedAt
            ? new Date(a.latestFavoritedAt).getTime()
            : 0;
          const bTime = b.latestFavoritedAt
            ? new Date(b.latestFavoritedAt).getTime()
            : 0;
          return bTime - aTime;
        })
        .slice(0, 20);



    const deadlineCandidates =
      scope === "favorites"
        ? [
            ...favorites.map(({ notice, siteName }) => ({ notice, siteName })),
            ...otherDeptNoticeItems.filter(
              ({ notice }) => !favoriteIds.has(notice.id),
            ),
          ]
        : [
            ...favorites.map(({ notice, siteName }) => ({ notice, siteName })),
            ...activeNotices.filter(({ notice }) => !favoriteIds.has(notice.id)),
          ];

    const deadlineSchedule: DashboardScheduleEntry[] = deadlineCandidates

      .map(({ notice, siteName }) => {

        const deadline = getNoticeDeadline(notice);

        if (!deadline || isDeadlineExpired(notice, now)) return null;

        const countdown = getDeadlineCountdown(notice, now);

        return {

          notice,

          siteName,

          deadlineIso: deadline.toISOString(),

          scheduleLabel: "입찰 마감",

          urgent:

            countdown?.urgency === "urgent" || countdown?.urgency === "warning",

        };

      })

      .filter((entry): entry is DashboardScheduleEntry => entry != null)

      .filter((entry) => screeningStatuses[entry.notice.id] !== "EXCLUDED")

      .sort(

        (a, b) =>

          new Date(a.deadlineIso).getTime() - new Date(b.deadlineIso).getTime(),

      )

      .filter((entry, index, arr) => {

        const key = entry.notice.id;

        return arr.findIndex((e) => e.notice.id === key) === index;

      })

      .slice(0, 10);



    const estimateNoticeIds =
      scope === "favorites"
        ? new Set(
            [...favoriteIds].filter(
              (id) =>
                siteEstimateIds.has(id) ||
                siteOrderReportIds.has(id) ||
                favoriteIds.has(id),
            ),
          )
        : new Set([
            ...siteEstimateIds,
            ...siteOrderReportIds,
            ...favoriteIds,
          ]);



    const estimates: DashboardEstimateEntry[] = [...estimateNoticeIds]

      .map((noticeId) => {

        const found =
          allSiteNotices.find(({ notice }) => notice.id === noticeId) ??
          favorites.find(({ notice }) => notice.id === noticeId);

        if (!found) return null;

        if (scope === "favorites" && !favoriteIds.has(noticeId)) {
          return null;
        }

        const estimate = estimateSubmissions.find((s) => s.noticeId === noticeId);

        return {

          notice: found.notice,

          siteName: found.siteName,

          hasEstimate: siteEstimateIds.has(noticeId),

          hasBid: siteBidIds.has(noticeId),

          submittedAt: estimate?.submittedAt ?? null,

        };

      })

      .filter((entry): entry is DashboardEstimateEntry => entry != null)

      .sort((a, b) => {

        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;

        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;

        return bTime - aTime;

      })

      .slice(0, 4);



    let monthlyNotices = monthlyCount ?? 0;
    if (scope === "favorites") {
      if (favoriteIds.size === 0) {
        monthlyNotices = 0;
      } else {
        const { count: favMonthlyCount, error: favMonthlyError } = await supabase
          .from(noticeTable)
          .select("id", { count: "exact", head: true })
          .eq("site_id", options.siteId)
          .eq("is_deleted", false)
          .in("id", [...favoriteIds])
          .gte(dateColumn, monthStart)
          .lt(dateColumn, monthEnd);

        if (favMonthlyError) {
          return {
            favorites: [],
            approachingCounts: emptyCounts(),
            kpis: emptyKpis(),
            noticeCalendar: emptyNoticeCalendar(),
            deadlineSchedule: [],
            estimates: [],
            otherDeptFavorites: [],
            error: favMonthlyError.message,
          };
        }
        monthlyNotices = favMonthlyCount ?? 0;
      }
    }

    const submittedCount =
      scope === "favorites"
        ? [...siteBidIds].filter((id) => favoriteIds.has(id)).length
        : siteBidIds.size;

    const estimateCount =
      scope === "favorites"
        ? [...siteEstimateIds].filter((id) => favoriteIds.has(id)).length
        : siteEstimateIds.size;



    return {

      favorites,

      approachingCounts,

      kpis: {

        monthlyNotices,

        reviewingCount,

        urgentDeadlineCount,

        submittedCount,

        estimateCount,

      },

      noticeCalendar,

      deadlineSchedule,

      estimates,

      otherDeptFavorites,

      error: null,

    };

  } catch (err) {

    const message =

      err instanceof Error ? err.message : "대시보드 데이터 조회에 실패했습니다.";

    return {

      favorites: [],

      approachingCounts: emptyCounts(),

      kpis: emptyKpis(),

      noticeCalendar: emptyNoticeCalendar(),

      deadlineSchedule: [],

      estimates: [],

      otherDeptFavorites: [],

      error: message,

    };

  }

}


