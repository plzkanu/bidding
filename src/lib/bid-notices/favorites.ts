import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getNoticeTableName,
  resolveBidNoticeDatasetForSiteId,
} from "./dataset";
import type { BidNoticeType } from "./types";
import { getBidNoticeById } from "./notices";

export const FAVORITES_TABLE_SETUP_MESSAGE =
  "관심공고를 저장할 수 없습니다. Supabase에 user_bid_favorites 테이블이 필요합니다. 관리자에게 문의하거나 supabase/migrations/002_user_bid_favorites.sql을 적용해 주세요.";

function isMissingFavoritesTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_bid_favorites") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeFavoritesError(message: string | undefined): string {
  if (isMissingFavoritesTableError(message)) {
    return FAVORITES_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "관심공고 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 관심공고를 사용할 수 없습니다.";
  }
  return null;
}

async function filterFavoriteNoticeIds(
  noticeIds: string[],
  filters?: { siteId?: number; noticeType?: BidNoticeType },
): Promise<{ noticeIds: string[]; error: string | null }> {
  if (noticeIds.length === 0) {
    return { noticeIds: [], error: null };
  }
  if (filters?.siteId == null && !filters?.noticeType) {
    return { noticeIds, error: null };
  }

  const dataset =
    filters?.siteId != null
      ? await resolveBidNoticeDatasetForSiteId(filters.siteId)
      : "khnp";

  const tables =
    filters?.siteId != null
      ? [getNoticeTableName(dataset)]
      : ["khnp_bid_notice", "srm_bid_notice"];

  const matched = new Set<string>();

  for (const table of tables) {
    let query = createServerClient()
      .from(table)
      .select("id")
      .in("id", noticeIds)
      .eq("is_deleted", false);

    if (filters?.siteId != null) {
      query = query.eq("site_id", filters.siteId);
    }
    if (filters?.noticeType) {
      query = query.eq("notice_type", filters.noticeType);
    }

    const { data, error } = await query;
    if (error) {
      return { noticeIds: [], error: normalizeFavoritesError(error.message) };
    }
    for (const row of data ?? []) {
      matched.add(row.id as string);
    }
  }

  return {
    noticeIds: noticeIds.filter((id) => matched.has(id)),
    error: null,
  };
}

export async function getFavoriteNoticeIds(
  userId: string,
  filters?: { siteId?: number; noticeType?: BidNoticeType },
): Promise<{ noticeIds: string[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { noticeIds: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_favorites")
      .select("notice_id")
      .eq("user_id", userId);

    if (error) {
      return { noticeIds: [], error: normalizeFavoritesError(error.message) };
    }

    const noticeIds = (data ?? []).map((row) => row.notice_id as string);
    return filterFavoriteNoticeIds(noticeIds, filters);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "관심공고 조회에 실패했습니다.";
    return { noticeIds: [], error: normalizeFavoritesError(message) };
  }
}

export async function isNoticeFavorite(
  userId: string,
  noticeId: string,
): Promise<{ isFavorite: boolean; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { isFavorite: false, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { isFavorite: false, error: normalizeFavoritesError(error.message) };
    }

    return { isFavorite: !!data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "관심공고 확인에 실패했습니다.";
    return { isFavorite: false, error: normalizeFavoritesError(message) };
  }
}

export async function addNoticeFavorite(
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
      return { error: normalizeFavoritesError(noticeError) };
    }
    if (!notice) {
      return { error: "공고를 찾을 수 없습니다." };
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("user_bid_favorites").insert({
      user_id: userId,
      notice_id: noticeId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: null };
      }
      return { error: normalizeFavoritesError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "관심공고 등록에 실패했습니다.";
    return { error: normalizeFavoritesError(message) };
  }
}

export async function removeNoticeFavorite(
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
      .from("user_bid_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("notice_id", noticeId);

    if (error) {
      return { error: normalizeFavoritesError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "관심공고 해제에 실패했습니다.";
    return { error: normalizeFavoritesError(message) };
  }
}
