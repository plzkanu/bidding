import { getCrawlSiteById } from "@/lib/crawl-sites";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { BidNoticeType } from "./types";

export type BidNoticeDataset = "khnp" | "srm";

const KHNP_SITE_PATTERN = /KHNP|KPOS|한수원/i;
const SRM_SITE_PATTERN = /SRM|KEPCO|한국전력|전력공사/i;

export function resolveBidNoticeDatasetFromSite(site: Pick<CrawlSite, "site_code" | "site_name">): BidNoticeDataset {
  const key = `${site.site_code} ${site.site_name}`;
  if (SRM_SITE_PATTERN.test(key)) return "srm";
  if (KHNP_SITE_PATTERN.test(key)) return "khnp";
  return "khnp";
}

export async function resolveBidNoticeDatasetForSiteId(
  siteId: number,
): Promise<BidNoticeDataset> {
  const site = await getCrawlSiteById(siteId);
  if (!site) return "khnp";
  return resolveBidNoticeDatasetFromSite(site);
}

export function getNoticeTableName(dataset: BidNoticeDataset): string {
  return dataset === "srm" ? "srm_bid_notice" : "khnp_bid_notice";
}

export function getNoticeSelect(dataset: BidNoticeDataset): string {
  if (dataset === "srm") {
    return `
      *,
      srm_bid_open (*),
      srm_bid_spec_review (*)
    `;
  }
  return `
    *,
    khnp_bid_open (*),
    khnp_bid_private (*),
    khnp_bid_plan_spec (*)
  `;
}

export function getNoticeTypesForDataset(dataset: BidNoticeDataset): BidNoticeType[] {
  if (dataset === "srm") {
    return ["BID", "SPEC_REVIEW"];
  }
  return ["BID", "PRIVATE", "PLAN_SPEC"];
}

export function isNoticeTypeValidForDataset(
  dataset: BidNoticeDataset,
  noticeType: BidNoticeType,
): boolean {
  return getNoticeTypesForDataset(dataset).includes(noticeType);
}

export const ALL_BID_NOTICE_TYPES: BidNoticeType[] = [
  "BID",
  "PRIVATE",
  "PLAN_SPEC",
  "SPEC_REVIEW",
];
