import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getNoticeSelect,
  getNoticeTableName,
  resolveBidNoticeDatasetForSiteId,
  type BidNoticeDataset,
} from "./dataset";
import { normalizeSrmBidNoticeRow } from "./normalize-srm";
import type { BidNoticeType, KhnpBidNoticeRow, SrmBidNoticeRow } from "./types";

export function normalizeNoticeRow(
  dataset: BidNoticeDataset,
  row: KhnpBidNoticeRow | SrmBidNoticeRow,
): KhnpBidNoticeRow {
  if (dataset === "srm") {
    return normalizeSrmBidNoticeRow(row as SrmBidNoticeRow);
  }
  return { ...(row as KhnpBidNoticeRow), dataset: "khnp" };
}

export async function fetchBidNoticesForSite(options: {
  siteId: number;
  noticeType: BidNoticeType;
  dataset?: BidNoticeDataset;
}): Promise<{ notices: KhnpBidNoticeRow[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { notices: [], error: null };
  }

  const dataset =
    options.dataset ?? (await resolveBidNoticeDatasetForSiteId(options.siteId));
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from(getNoticeTableName(dataset))
    .select(getNoticeSelect(dataset))
    .eq("site_id", options.siteId)
    .eq("notice_type", options.noticeType)
    .eq("is_deleted", false)
    .order("notice_date", { ascending: false, nullsFirst: false });

  if (error) {
    return { notices: [], error: error.message };
  }

  const notices = ((data ?? []) as unknown as Array<KhnpBidNoticeRow | SrmBidNoticeRow>).map(
    (row) => normalizeNoticeRow(dataset, row),
  );

  return { notices, error: null };
}

export async function fetchBidNoticesByIdsForSite(options: {
  siteId: number;
  noticeType: BidNoticeType;
  noticeIds: string[];
}): Promise<{ notices: KhnpBidNoticeRow[]; error: string | null }> {
  if (options.noticeIds.length === 0) {
    return { notices: [], error: null };
  }

  const dataset = await resolveBidNoticeDatasetForSiteId(options.siteId);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from(getNoticeTableName(dataset))
    .select(getNoticeSelect(dataset))
    .in("id", options.noticeIds)
    .eq("site_id", options.siteId)
    .eq("notice_type", options.noticeType)
    .eq("is_deleted", false);

  if (error) {
    return { notices: [], error: error.message };
  }

  const notices = ((data ?? []) as unknown as Array<KhnpBidNoticeRow | SrmBidNoticeRow>).map(
    (row) => normalizeNoticeRow(dataset, row),
  );

  return { notices, error: null };
}

export async function getBidNoticeById(
  id: string,
): Promise<{ notice: KhnpBidNoticeRow | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { notice: null, error: null };
  }

  try {
    const supabase = createServerClient();

    for (const dataset of ["khnp", "srm"] as const) {
      const { data, error } = await supabase
        .from(getNoticeTableName(dataset))
        .select(getNoticeSelect(dataset))
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (error) {
        return { notice: null, error: error.message };
      }

      if (data) {
        return {
          notice: normalizeNoticeRow(
            dataset,
            data as unknown as KhnpBidNoticeRow | SrmBidNoticeRow,
          ),
          error: null,
        };
      }
    }

    return { notice: null, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 상세 조회에 실패했습니다.";
    return { notice: null, error: message };
  }
}

export async function getBidNoticesByIds(
  noticeIds: string[],
): Promise<{ notices: Map<string, KhnpBidNoticeRow>; error: string | null }> {
  const uniqueIds = [...new Set(noticeIds.filter(Boolean))];
  const notices = new Map<string, KhnpBidNoticeRow>();

  if (uniqueIds.length === 0) {
    return { notices, error: null };
  }

  if (!isSupabaseConfigured()) {
    return { notices, error: null };
  }

  try {
    const supabase = createServerClient();

    for (const dataset of ["khnp", "srm"] as const) {
      const { data, error } = await supabase
        .from(getNoticeTableName(dataset))
        .select(getNoticeSelect(dataset))
        .in("id", uniqueIds)
        .eq("is_deleted", false);

      if (error) {
        return { notices, error: error.message };
      }

      for (const row of (data ?? []) as unknown as Array<
        KhnpBidNoticeRow | SrmBidNoticeRow
      >) {
        const normalized = normalizeNoticeRow(dataset, row);
        notices.set(normalized.id, normalized);
      }
    }

    return { notices, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 조회에 실패했습니다.";
    return { notices, error: message };
  }
}
