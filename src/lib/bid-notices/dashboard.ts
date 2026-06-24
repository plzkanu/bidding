import { createServerClient } from "@/lib/supabase/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";

import { listUserEstimateSubmissions } from "./estimates";

import { getFavoriteNoticeIds } from "./favorites";

import { listUserBidSubmissions } from "./submissions";

import { listUserOrderReports } from "./order-reports";

import { getScreeningStatusMap } from "./screening";

import { formatDeptNameForList } from "./utils";

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

import type {

  BidNoticeType,

  KhnpBidNoticeRow,

} from "./types";



const NOTICE_TYPES: BidNoticeType[] = ["BID", "PRIVATE", "PLAN_SPEC"];



const NOTICE_SELECT = `

  *,

  khnp_bid_open (*),

  khnp_bid_private (*),

  khnp_bid_plan_spec (*)

`;



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

}



export interface DashboardNoticeCalendar {

  rangeStart: string;

  rangeEnd: string;

  countsByDate: Record<string, number>;

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



export interface DashboardOrgActivity {

  label: string;

  participateCount: number;

  bidCount: number;

}



export interface DashboardData {

  favorites: DashboardFavoriteItem[];

  approachingCounts: ApproachingDeadlineCounts;

  kpis: DashboardKpis;

  noticeCalendar: DashboardNoticeCalendar;

  deadlineSchedule: DashboardScheduleEntry[];

  estimates: DashboardEstimateEntry[];

  orgActivity: DashboardOrgActivity[];

  error: string | null;

}



function emptyCounts(): ApproachingDeadlineCounts {

  return {

    week: { BID: 0, PRIVATE: 0, PLAN_SPEC: 0 },

    day: { BID: 0, PRIVATE: 0, PLAN_SPEC: 0 },

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



async function fetchNoticesForSite(

  siteId: number,

  noticeType: BidNoticeType,

): Promise<{ notices: KhnpBidNoticeRow[]; error: string | null }> {

  const supabase = createServerClient();

  const { data, error } = await supabase

    .from("khnp_bid_notice")

    .select(NOTICE_SELECT)

    .eq("site_id", siteId)

    .eq("notice_type", noticeType)

    .eq("is_deleted", false)

    .order("notice_date", { ascending: false, nullsFirst: false });



  if (error) {

    return { notices: [], error: error.message };

  }



  return { notices: (data ?? []) as KhnpBidNoticeRow[], error: null };

}



export async function getApproachingNoticeIds(options: {

  siteId: number;

  noticeType: BidNoticeType;

  window: DeadlineWindow;

  userId?: string;

  favoritesOnly?: boolean;

}): Promise<{ noticeIds: string[]; error: string | null }> {

  if (!isSupabaseConfigured()) {

    return { noticeIds: [], error: null };

  }



  let notices: KhnpBidNoticeRow[];



  if (options.favoritesOnly) {

    if (!options.userId) {

      return { noticeIds: [], error: "로그인이 필요합니다." };

    }



    const { noticeIds: favoriteIds, error: favError } =

      await getFavoriteNoticeIds(options.userId, {

        siteId: options.siteId,

        noticeType: options.noticeType,

      });

    if (favError) {

      return { noticeIds: [], error: favError };

    }

    if (favoriteIds.length === 0) {

      return { noticeIds: [], error: null };

    }



    const supabase = createServerClient();

    const { data, error: listError } = await supabase

      .from("khnp_bid_notice")

      .select(NOTICE_SELECT)

      .in("id", favoriteIds)

      .eq("site_id", options.siteId)

      .eq("notice_type", options.noticeType)

      .eq("is_deleted", false);



    if (listError) {

      return { noticeIds: [], error: listError.message };

    }



    notices = (data ?? []) as KhnpBidNoticeRow[];

  } else {

    const { notices: siteNotices, error } = await fetchNoticesForSite(

      options.siteId,

      options.noticeType,

    );

    if (error) {

      return { noticeIds: [], error };

    }

    notices = siteNotices;

  }



  const now = new Date();

  const ids = notices

    .filter((row) => isApproachingDeadline(row, options.window, now))

    .sort((a, b) => {

      const da = getNoticeDeadlineSortKey(a);

      const db = getNoticeDeadlineSortKey(b);

      return da - db;

    })

    .map((row) => row.id);



  return { noticeIds: ids, error: null };

}



export async function getNoticeIdsByDeadlineStatus(options: {

  siteId: number;

  noticeType: BidNoticeType;

  status: DeadlineListFilter;

  userId?: string;

  favoritesOnly?: boolean;

}): Promise<{ noticeIds: string[]; error: string | null }> {

  if (!isSupabaseConfigured()) {

    return { noticeIds: [], error: null };

  }



  let notices: KhnpBidNoticeRow[];



  if (options.favoritesOnly) {

    if (!options.userId) {

      return { noticeIds: [], error: "로그인이 필요합니다." };

    }



    const { noticeIds: favoriteIds, error: favError } =

      await getFavoriteNoticeIds(options.userId, {

        siteId: options.siteId,

        noticeType: options.noticeType,

      });

    if (favError) {

      return { noticeIds: [], error: favError };

    }

    if (favoriteIds.length === 0) {

      return { noticeIds: [], error: null };

    }



    const supabase = createServerClient();

    const { data, error: listError } = await supabase

      .from("khnp_bid_notice")

      .select(NOTICE_SELECT)

      .in("id", favoriteIds)

      .eq("site_id", options.siteId)

      .eq("notice_type", options.noticeType)

      .eq("is_deleted", false);



    if (listError) {

      return { noticeIds: [], error: listError.message };

    }



    notices = (data ?? []) as KhnpBidNoticeRow[];

  } else {

    const { notices: siteNotices, error } = await fetchNoticesForSite(

      options.siteId,

      options.noticeType,

    );

    if (error) {

      return { noticeIds: [], error };

    }

    notices = siteNotices;

  }



  const now = new Date();

  const ids = notices

    .filter((row) =>

      options.status === "expired"

        ? isDeadlineExpired(row, now)

        : !isDeadlineExpired(row, now),

    )

    .sort((a, b) => {

      const dateA = a.notice_date ? new Date(a.notice_date).getTime() : 0;

      const dateB = b.notice_date ? new Date(b.notice_date).getTime() : 0;

      if (dateB !== dateA) return dateB - dateA;

      return (b.notice_no ?? "").localeCompare(a.notice_no ?? "", "ko");

    })

    .map((row) => row.id);



  return { noticeIds: ids, error: null };

}



function getNoticeDeadlineSortKey(row: KhnpBidNoticeRow): number {

  const d = getNoticeDeadline(row);

  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;

}



function emptyNoticeCalendar(): DashboardNoticeCalendar {

  const { startYmd, endYmd } = getKstRollingMonthRange();

  return {

    rangeStart: startYmd,

    rangeEnd: endYmd,

    countsByDate: {},

    noticesByDate: {},

  };

}



function buildNoticeCalendar(

  notices: Array<{ notice: KhnpBidNoticeRow; siteName: string | null }>,

  now: Date,

): DashboardNoticeCalendar {

  const { startYmd, endYmd } = getKstRollingMonthRange(now);

  const countsByDate: Record<string, number> = {};

  const noticesByDate: Record<string, DashboardCalendarNotice[]> = {};



  for (const item of notices) {

    if (!item.notice.notice_date) continue;

    const ymd = toKstDateYmd(item.notice.notice_date);

    if (!ymd || ymd < startYmd || ymd > endYmd) continue;



    countsByDate[ymd] = (countsByDate[ymd] ?? 0) + 1;

    const bucket = noticesByDate[ymd] ?? [];

    bucket.push({ notice: item.notice, siteName: item.siteName });

    noticesByDate[ymd] = bucket;

  }



  for (const ymd of Object.keys(noticesByDate)) {

    noticesByDate[ymd]!.sort(

      (a, b) =>

        new Date(b.notice.notice_date ?? 0).getTime() -

        new Date(a.notice.notice_date ?? 0).getTime(),

    );

  }



  return { rangeStart: startYmd, rangeEnd: endYmd, countsByDate, noticesByDate };

}



function buildOrgActivity(

  notices: KhnpBidNoticeRow[],

  bidIds: Set<string>,

): DashboardOrgActivity[] {

  const map = new Map<string, { participate: number; bid: number }>();



  for (const notice of notices) {

    const formatted = formatDeptNameForList(notice.dept_name);

    const label = formatted === "-" ? "미기재" : formatted;

    const current = map.get(label) ?? { participate: 0, bid: 0 };

    current.participate += 1;

    if (bidIds.has(notice.id)) {

      current.bid += 1;

    }

    map.set(label, current);

  }



  return [...map.entries()]

    .map(([label, counts]) => ({

      label,

      participateCount: counts.participate,

      bidCount: counts.bid,

    }))

    .sort((a, b) => b.participateCount - a.participateCount)

    .slice(0, 5);

}



export async function getDashboardData(options: {

  userId: string;

  siteId: number;

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

      orgActivity: [],

      error: null,

    };

  }



  const limit = Math.min(50, Math.max(1, options.favoriteLimit ?? 15));

  const now = new Date();



  try {

    const supabase = createServerClient();

    const { start: monthStart, end: monthEnd } = getKstMonthRange(now);

    const { startIso: calendarStart, endIso: calendarEnd } =
      getKstRollingMonthRange(now);



    const [

      { noticeIds: favoriteIdsList, error: favError },

      { submissions: bidSubmissions, error: bidError },

      { submissions: estimateSubmissions, error: estimateError },

      { reports: orderReports, error: orderReportError },

      { count: monthlyCount, error: monthlyError },

      { data: recentRows, error: recentError },

      { data: calendarRows, error: calendarError },

      { statuses: screeningStatuses, error: screeningError },

    ] = await Promise.all([

      getFavoriteNoticeIds(options.userId, { siteId: options.siteId }),

      listUserBidSubmissions(options.userId),

      listUserEstimateSubmissions(options.userId),

      listUserOrderReports(options.userId),

      supabase

        .from("khnp_bid_notice")

        .select("id", { count: "exact", head: true })

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .gte("notice_date", monthStart)

        .lt("notice_date", monthEnd),

      supabase

        .from("khnp_bid_notice")

        .select(`${NOTICE_SELECT}, crawl_sites ( site_name )`)

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .order("notice_date", { ascending: false, nullsFirst: false })

        .limit(40),

      supabase

        .from("khnp_bid_notice")

        .select(`${NOTICE_SELECT}, crawl_sites ( site_name )`)

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .gte("notice_date", calendarStart)

        .lt("notice_date", calendarEnd)

        .not("notice_date", "is", null)

        .order("notice_date", { ascending: false }),

      getScreeningStatusMap(options.userId, { siteId: options.siteId }),

    ]);



    const firstError =

      favError ??

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

      orgActivity: [],

      error: typeof firstError === "string" ? firstError : firstError.message,

      };

    }



    const favoriteIds = new Set(favoriteIdsList);

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



    const allSiteNotices = ((recentRows ?? []) as Array<

      KhnpBidNoticeRow & {

        crawl_sites: { site_name: string } | { site_name: string }[] | null;

      }

    >).map((row) => {

      const { crawl_sites, ...notice } = row;

      return {

        notice: notice as KhnpBidNoticeRow,

        siteName: resolveSiteName(crawl_sites),

      };

    });



    const activeNotices = allSiteNotices.filter(

      ({ notice }) => !isDeadlineExpired(notice, now),

    );



    let favorites: DashboardFavoriteItem[] = [];

    if (favoriteIds.size > 0) {

      const { data: favRows, error: favListError } = await supabase

        .from("khnp_bid_notice")

        .select(`${NOTICE_SELECT}, crawl_sites ( site_name )`)

        .in("id", [...favoriteIds])

        .eq("site_id", options.siteId)

        .eq("is_deleted", false)

        .order("notice_date", { ascending: false, nullsFirst: false })

        .limit(limit);



      if (favListError) {

        return {

          favorites: [],

          approachingCounts: emptyCounts(),

          kpis: emptyKpis(),

          noticeCalendar: emptyNoticeCalendar(),

          deadlineSchedule: [],

          estimates: [],

          orgActivity: [],

          error: favListError.message,

        };

      }



      favorites = (favRows ?? []).map((row) => {

        const { crawl_sites, ...notice } = row as KhnpBidNoticeRow & {

          crawl_sites: { site_name: string } | { site_name: string }[] | null;

        };

        return {

          notice: notice as KhnpBidNoticeRow,

          siteName: resolveSiteName(crawl_sites),

        };

      });

    }



    const approachingCounts = emptyCounts();

    for (const { notice } of favorites) {

      const noticeType = notice.notice_type;

      if (!NOTICE_TYPES.includes(noticeType)) continue;

      if (isApproachingDeadline(notice, "week", now)) {

        approachingCounts.week[noticeType] += 1;

      }

      if (isApproachingDeadline(notice, "day", now)) {

        approachingCounts.day[noticeType] += 1;

      }

    }



    const urgentDeadlineCount = NOTICE_TYPES.reduce(

      (sum, type) => sum + approachingCounts.day[type],

      0,

    );



    const reviewingCount = favorites.filter(

      ({ notice }) => !isDeadlineExpired(notice, now),

    ).length;



    const calendarNotices = ((calendarRows ?? []) as Array<

      KhnpBidNoticeRow & {

        crawl_sites: { site_name: string } | { site_name: string }[] | null;

      }

    >).map((row) => {

      const { crawl_sites, ...notice } = row;

      return {

        notice: notice as KhnpBidNoticeRow,

        siteName: resolveSiteName(crawl_sites),

      };

    });



    const noticeCalendar = buildNoticeCalendar(calendarNotices, now);



    const deadlineSchedule: DashboardScheduleEntry[] = [

      ...favorites.map(({ notice, siteName }) => ({ notice, siteName })),

      ...activeNotices.filter(({ notice }) => !favoriteIds.has(notice.id)),

    ]

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



    const estimateNoticeIds = new Set([

      ...siteEstimateIds,

      ...siteOrderReportIds,

      ...favoriteIds,

    ]);



    const estimates: DashboardEstimateEntry[] = [...estimateNoticeIds]

      .map((noticeId) => {

        const found = allSiteNotices.find(({ notice }) => notice.id === noticeId);

        if (!found) return null;

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



    const orgActivity = buildOrgActivity(

      activeNotices.map(({ notice }) => notice),

      siteBidIds,

    );



    return {

      favorites,

      approachingCounts,

      kpis: {

        monthlyNotices: monthlyCount ?? 0,

        reviewingCount,

        urgentDeadlineCount,

        submittedCount: siteBidIds.size,

        estimateCount: siteEstimateIds.size,

      },

      noticeCalendar,

      deadlineSchedule,

      estimates,

      orgActivity,

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

      orgActivity: [],

      error: message,

    };

  }

}


