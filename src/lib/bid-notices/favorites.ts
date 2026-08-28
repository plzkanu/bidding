import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getAllNoticeTableNames,
  getNoticeTableName,
  getNoticeTypeDbValues,
  resolveBidNoticeDatasetForSiteId,
  resolveDatasetFromNoticeTableName,
} from "./dataset";
import type { BidNoticeType } from "./types";
import { getBidNoticeById } from "./notices";
import { chunkIds } from "./utils";

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
      : getAllNoticeTableNames();

  const matched = new Set<string>();
  const supabase = createServerClient();

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

      const { data, error } = await query;
      if (error) {
        return { noticeIds: [], error: normalizeFavoritesError(error.message) };
      }
      for (const row of data ?? []) {
        matched.add(row.id as string);
      }
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

export interface OtherDepartmentFavoriteRow {
  noticeId: string;
  department: string;
  users: Array<{ userId: string; name: string }>;
  latestFavoritedAt: string | null;
}

/**
 * 현재 사용자와 다른 부서 소속 사용자가 등록한 관심공고를 집계합니다.
 * 동일 공고를 여러 타부서·사용자가 등록한 경우 하나로 묶습니다.
 */
export async function getOtherDepartmentFavoriteRows(options: {
  currentUserId: string;
  currentDepartment: string;
  siteId?: number;
}): Promise<{
  rows: OtherDepartmentFavoriteRow[];
  noticeIds: string[];
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { rows: [], noticeIds: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const myDept = options.currentDepartment.trim().toLowerCase();

    const { data: users, error: usersError } = await supabase
      .from("bid_users")
      .select("id, name, department, active")
      .eq("active", true);

    if (usersError) {
      return {
        rows: [],
        noticeIds: [],
        error: normalizeFavoritesError(usersError.message),
      };
    }

    const otherDeptUsers = (users ?? []).filter((row) => {
      const id = String(row.id);
      if (id === options.currentUserId) return false;
      const dept = String(row.department ?? "").trim();
      if (!dept) return false;
      if (!myDept) return true;
      return dept.toLowerCase() !== myDept;
    });

    if (otherDeptUsers.length === 0) {
      return { rows: [], noticeIds: [], error: null };
    }

    const userMap = new Map(
      otherDeptUsers.map((row) => [
        String(row.id),
        {
          name: String(row.name ?? row.id),
          department: String(row.department ?? "").trim(),
        },
      ]),
    );
    const otherUserIds = [...userMap.keys()];

    const { data: favRows, error: favError } = await supabase
      .from("user_bid_favorites")
      .select("user_id, notice_id, created_at")
      .in("user_id", otherUserIds);

    if (favError) {
      return {
        rows: [],
        noticeIds: [],
        error: normalizeFavoritesError(favError.message),
      };
    }

    const rawNoticeIds = [
      ...new Set((favRows ?? []).map((row) => row.notice_id as string)),
    ];
    const { noticeIds: filteredIds, error: filterError } =
      await filterFavoriteNoticeIds(rawNoticeIds, {
        siteId: options.siteId,
      });
    if (filterError) {
      return { rows: [], noticeIds: [], error: filterError };
    }

    const allowed = new Set(filteredIds);
    const byNotice = new Map<
      string,
      {
        department: string;
        users: Map<string, string>;
        latestFavoritedAt: string | null;
      }
    >();

    for (const row of favRows ?? []) {
      const noticeId = row.notice_id as string;
      if (!allowed.has(noticeId)) continue;
      const userId = String(row.user_id);
      const user = userMap.get(userId);
      if (!user) continue;

      const current = byNotice.get(noticeId) ?? {
        department: user.department,
        users: new Map<string, string>(),
        latestFavoritedAt: null as string | null,
      };
      current.users.set(userId, user.name);
      if (
        !current.department ||
        (user.department && current.department !== user.department)
      ) {
        // 여러 부서면 첫 부서를 유지하고, 표시는 집계 시 처리
        if (!current.department) current.department = user.department;
      }
      const createdAt = (row.created_at as string | null) ?? null;
      if (
        createdAt &&
        (!current.latestFavoritedAt ||
          new Date(createdAt) > new Date(current.latestFavoritedAt))
      ) {
        current.latestFavoritedAt = createdAt;
      }
      byNotice.set(noticeId, current);
    }

    // 부서별로 묶되, 공고당 여러 부서가 있을 수 있어 부서명 목록을 합침
    const deptByNotice = new Map<string, Set<string>>();
    for (const row of favRows ?? []) {
      const noticeId = row.notice_id as string;
      if (!allowed.has(noticeId)) continue;
      const user = userMap.get(String(row.user_id));
      if (!user?.department) continue;
      const set = deptByNotice.get(noticeId) ?? new Set<string>();
      set.add(user.department);
      deptByNotice.set(noticeId, set);
    }

    const rows: OtherDepartmentFavoriteRow[] = [...byNotice.entries()]
      .map(([noticeId, value]) => {
        const depts = [...(deptByNotice.get(noticeId) ?? [])].sort((a, b) =>
          a.localeCompare(b, "ko"),
        );
        return {
          noticeId,
          department: depts.join(", ") || value.department,
          users: [...value.users.entries()].map(([userId, name]) => ({
            userId,
            name,
          })),
          latestFavoritedAt: value.latestFavoritedAt,
        };
      })
      .sort((a, b) => {
        const aTime = a.latestFavoritedAt
          ? new Date(a.latestFavoritedAt).getTime()
          : 0;
        const bTime = b.latestFavoritedAt
          ? new Date(b.latestFavoritedAt).getTime()
          : 0;
        return bTime - aTime;
      });

    return {
      rows,
      noticeIds: rows.map((row) => row.noticeId),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "타부서 관심공고 조회에 실패했습니다.";
    return {
      rows: [],
      noticeIds: [],
      error: normalizeFavoritesError(message),
    };
  }
}
