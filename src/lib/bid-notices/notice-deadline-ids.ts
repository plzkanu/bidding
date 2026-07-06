import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getNoticeDeadline,
  isApproachingDeadline,
  isDeadlineExpired,
  type DeadlineListFilter,
  type DeadlineWindow,
} from "./deadline";
import { getFavoriteNoticeIds } from "./favorites";
import {
  fetchBidNoticesByIdsForSite,
  fetchBidNoticesForSite,
} from "./notice-repository";
import type { BidNoticeType, KhnpBidNoticeRow } from "./types";

function getNoticeDeadlineSortKey(row: KhnpBidNoticeRow): number {
  const d = getNoticeDeadline(row);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
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

    const { notices: favoriteNotices, error: listError } =
      await fetchBidNoticesByIdsForSite({
        siteId: options.siteId,
        noticeType: options.noticeType,
        noticeIds: favoriteIds,
      });
    if (listError) {
      return { noticeIds: [], error: listError };
    }
    notices = favoriteNotices;
  } else {
    const { notices: siteNotices, error } = await fetchBidNoticesForSite({
      siteId: options.siteId,
      noticeType: options.noticeType,
    });
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

    const { notices: favoriteNotices, error: listError } =
      await fetchBidNoticesByIdsForSite({
        siteId: options.siteId,
        noticeType: options.noticeType,
        noticeIds: favoriteIds,
      });
    if (listError) {
      return { noticeIds: [], error: listError };
    }
    notices = favoriteNotices;
  } else {
    const { notices: siteNotices, error } = await fetchBidNoticesForSite({
      siteId: options.siteId,
      noticeType: options.noticeType,
    });
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
