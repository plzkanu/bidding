import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  BID_NOTICE_DATASETS,
  getNoticeListOrderColumn,
  getNoticeSelect,
  getNoticeTableName,
  getNoticeTypeDbValues,
  isCrawlMasterDataset,
  resolveBidNoticeDatasetForSiteId,
  type BidNoticeDataset,
  type CrawlMasterDataset,
} from "./dataset";
import { matchesExListNoticeType, normalizeExBidNoticeRow } from "./normalize-ex";
import { matchesG2bListNoticeType, normalizeG2bBidNoticeRow } from "./normalize-g2b";
import {
  matchesKogasListNoticeType,
  normalizeKogasBidNoticeRow,
} from "./normalize-kogas";
import { matchesKrListNoticeType, normalizeKrBidNoticeRow } from "./normalize-kr";
import { matchesLhListNoticeType, normalizeLhBidNoticeRow } from "./normalize-lh";
import { normalizeSrmBidNoticeRow } from "./normalize-srm";
import type {
  BidNoticeType,
  ExBidNoticeRow,
  G2bBidNoticeRow,
  KhnpBidNoticeRow,
  KogasBidNoticeRow,
  KrBidNoticeRow,
  LhBidNoticeRow,
  SrmBidNoticeRow,
} from "./types";
import { chunkIds } from "./utils";

type RawNoticeRow =
  | KhnpBidNoticeRow
  | SrmBidNoticeRow
  | G2bBidNoticeRow
  | KogasBidNoticeRow
  | LhBidNoticeRow
  | ExBidNoticeRow
  | KrBidNoticeRow;

type CrawlMasterRow =
  | G2bBidNoticeRow
  | KogasBidNoticeRow
  | LhBidNoticeRow
  | ExBidNoticeRow
  | KrBidNoticeRow;

const CRAWL_MASTER_MATCHERS: Record<
  CrawlMasterDataset,
  (row: CrawlMasterRow, noticeType: BidNoticeType) => boolean
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

function normalizeCrawlMasterRow(
  dataset: CrawlMasterDataset,
  row: CrawlMasterRow,
): KhnpBidNoticeRow {
  if (dataset === "g2b") {
    return normalizeG2bBidNoticeRow(row as G2bBidNoticeRow);
  }
  if (dataset === "kogas") {
    return normalizeKogasBidNoticeRow(row as KogasBidNoticeRow);
  }
  if (dataset === "lh") {
    return normalizeLhBidNoticeRow(row as LhBidNoticeRow);
  }
  if (dataset === "ex") {
    return normalizeExBidNoticeRow(row as ExBidNoticeRow);
  }
  return normalizeKrBidNoticeRow(row as KrBidNoticeRow);
}

export function normalizeNoticeRow(
  dataset: BidNoticeDataset,
  row: RawNoticeRow,
): KhnpBidNoticeRow {
  if (dataset === "srm") {
    return normalizeSrmBidNoticeRow(row as SrmBidNoticeRow);
  }
  if (isCrawlMasterDataset(dataset)) {
    return normalizeCrawlMasterRow(dataset, row as CrawlMasterRow);
  }
  return { ...(row as KhnpBidNoticeRow), dataset: "khnp" };
}

async function fetchCrawlMasterNoticesForSite(options: {
  siteId: number;
  noticeType: BidNoticeType;
  dataset: CrawlMasterDataset;
}): Promise<{ notices: KhnpBidNoticeRow[]; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from(getNoticeTableName(options.dataset))
    .select(getNoticeSelect(options.dataset))
    .eq("site_id", options.siteId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return { notices: [], error: error.message };
  }

  const matcher = CRAWL_MASTER_MATCHERS[options.dataset];
  const notices = ((data ?? []) as unknown as CrawlMasterRow[])
    .filter((row) => matcher(row, options.noticeType))
    .map((row) => normalizeCrawlMasterRow(options.dataset, row));

  return { notices, error: null };
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

  if (isCrawlMasterDataset(dataset)) {
    return fetchCrawlMasterNoticesForSite({
      siteId: options.siteId,
      noticeType: options.noticeType,
      dataset,
    });
  }

  const supabase = createServerClient();
  const noticeTypeValues = getNoticeTypeDbValues(dataset, options.noticeType);
  let query = supabase
    .from(getNoticeTableName(dataset))
    .select(getNoticeSelect(dataset))
    .eq("site_id", options.siteId)
    .eq("is_deleted", false);

  query =
    noticeTypeValues.length === 1
      ? query.eq("notice_type", noticeTypeValues[0]!)
      : query.in("notice_type", noticeTypeValues);

  const { data, error } = await query.order(getNoticeListOrderColumn(dataset), {
    ascending: false,
    nullsFirst: false,
  });

  if (error) {
    return { notices: [], error: error.message };
  }

  const notices = ((data ?? []) as unknown as RawNoticeRow[]).map((row) =>
    normalizeNoticeRow(dataset, row),
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
  const table = getNoticeTableName(dataset);
  const select = getNoticeSelect(dataset);
  const notices: KhnpBidNoticeRow[] = [];

  if (isCrawlMasterDataset(dataset)) {
    const matcher = CRAWL_MASTER_MATCHERS[dataset];
    for (const idChunk of chunkIds(options.noticeIds)) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in("id", idChunk)
        .eq("site_id", options.siteId)
        .eq("is_deleted", false);

      if (error) {
        return { notices: [], error: error.message };
      }

      for (const row of (data ?? []) as unknown as CrawlMasterRow[]) {
        if (matcher(row, options.noticeType)) {
          notices.push(normalizeCrawlMasterRow(dataset, row));
        }
      }
    }

    return { notices, error: null };
  }

  const noticeTypeValues = getNoticeTypeDbValues(dataset, options.noticeType);
  for (const idChunk of chunkIds(options.noticeIds)) {
    let query = supabase
      .from(table)
      .select(select)
      .in("id", idChunk)
      .eq("site_id", options.siteId)
      .eq("is_deleted", false);

    query =
      noticeTypeValues.length === 1
        ? query.eq("notice_type", noticeTypeValues[0]!)
        : query.in("notice_type", noticeTypeValues);

    const { data, error } = await query;

    if (error) {
      return { notices: [], error: error.message };
    }

    for (const row of (data ?? []) as unknown as RawNoticeRow[]) {
      notices.push(normalizeNoticeRow(dataset, row));
    }
  }

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

    for (const dataset of BID_NOTICE_DATASETS) {
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
          notice: normalizeNoticeRow(dataset, data as unknown as RawNoticeRow),
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

    for (const dataset of BID_NOTICE_DATASETS) {
      const table = getNoticeTableName(dataset);
      const select = getNoticeSelect(dataset);
      for (const idChunk of chunkIds(uniqueIds)) {
        const { data, error } = await supabase
          .from(table)
          .select(select)
          .in("id", idChunk)
          .eq("is_deleted", false);

        if (error) {
          return { notices, error: error.message };
        }

        for (const row of (data ?? []) as unknown as RawNoticeRow[]) {
          const normalized = normalizeNoticeRow(dataset, row);
          notices.set(normalized.id, normalized);
        }
      }
    }

    return { notices, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 조회에 실패했습니다.";
    return { notices, error: message };
  }
}
