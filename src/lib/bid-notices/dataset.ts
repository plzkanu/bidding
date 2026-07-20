import { getCrawlSiteById } from "@/lib/crawl-sites";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { BidNoticeType } from "./types";

export type BidNoticeDataset =
  | "khnp"
  | "srm"
  | "g2b"
  | "kogas"
  | "lh"
  | "ex"
  | "kr";

export const BID_NOTICE_DATASETS: BidNoticeDataset[] = [
  "khnp",
  "srm",
  "g2b",
  "kogas",
  "lh",
  "ex",
  "kr",
];

export const CRAWL_MASTER_DATASETS = [
  "g2b",
  "kogas",
  "lh",
  "ex",
  "kr",
] as const;
export type CrawlMasterDataset = (typeof CRAWL_MASTER_DATASETS)[number];

const OPEN_ONLY_CRAWL_DATASETS = ["lh", "ex", "kr"] as const;

const KHNP_SITE_PATTERN = /KHNP|KPOS|한수원/i;
const SRM_SITE_PATTERN = /SRM|KEPCO|한국전력|전력공사/i;
const G2B_SITE_PATTERN = /G2B|나라장터|조달/i;
const KOGAS_SITE_PATTERN = /KOGAS|한국가스|가스공사/i;
const LH_SITE_PATTERN = /\bLH\b|한국토지주택|토지주택/i;
const EX_SITE_PATTERN = /\bEX\b|한국도로|도로공사/i;
const KR_SITE_PATTERN = /\bKR\b|국가철도|철도공단/i;

const CRAWL_MASTER_NOTICE_TYPE_DB_VALUES: Partial<
  Record<BidNoticeType, string[]>
> = {
  BID: ["BID", "bid", "OPEN", "open", "입찰공고", "입찰"],
  PRE_SPEC: ["PRE_SPEC", "pre_spec", "PRE-SPEC", "사전규격"],
};

export function isCrawlMasterDataset(
  dataset: BidNoticeDataset,
): dataset is CrawlMasterDataset {
  return CRAWL_MASTER_DATASETS.includes(dataset as CrawlMasterDataset);
}

export function isOpenOnlyCrawlDataset(dataset: BidNoticeDataset): boolean {
  return (OPEN_ONLY_CRAWL_DATASETS as readonly string[]).includes(dataset);
}

export function resolveBidNoticeDatasetFromSite(
  site: Pick<CrawlSite, "site_code" | "site_name">,
): BidNoticeDataset {
  const key = `${site.site_code} ${site.site_name}`;
  if (G2B_SITE_PATTERN.test(key)) return "g2b";
  if (KOGAS_SITE_PATTERN.test(key)) return "kogas";
  if (LH_SITE_PATTERN.test(key)) return "lh";
  if (EX_SITE_PATTERN.test(key)) return "ex";
  if (KR_SITE_PATTERN.test(key)) return "kr";
  if (SRM_SITE_PATTERN.test(key)) return "srm";
  if (KHNP_SITE_PATTERN.test(key)) return "khnp";
  return "khnp";
}

export function resolveDatasetFromNoticeTableName(
  table: string,
): BidNoticeDataset {
  if (table === "g2b_bid_notice") return "g2b";
  if (table === "kogas_bid_notice") return "kogas";
  if (table === "lh_bid_notice") return "lh";
  if (table === "ex_bid_notice") return "ex";
  if (table === "kr_bid_notice") return "kr";
  if (table === "srm_bid_notice") return "srm";
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
  if (dataset === "srm") return "srm_bid_notice";
  if (dataset === "g2b") return "g2b_bid_notice";
  if (dataset === "kogas") return "kogas_bid_notice";
  if (dataset === "lh") return "lh_bid_notice";
  if (dataset === "ex") return "ex_bid_notice";
  if (dataset === "kr") return "kr_bid_notice";
  return "khnp_bid_notice";
}

export function getAllNoticeTableNames(): string[] {
  return BID_NOTICE_DATASETS.map(getNoticeTableName);
}

export function getNoticeSelect(dataset: BidNoticeDataset): string {
  if (dataset === "srm") {
    return `
      *,
      srm_bid_open (*),
      srm_bid_spec_review (*)
    `;
  }
  if (dataset === "g2b") {
    return `
      *,
      g2b_bid_open (*),
      g2b_bid_pre_spec (*)
    `;
  }
  if (dataset === "kogas") {
    return `
      *,
      kogas_bid_open (*),
      kogas_bid_pre_spec (*)
    `;
  }
  if (dataset === "lh") {
    return `
      *,
      lh_bid_open (*)
    `;
  }
  if (dataset === "ex") {
    return `
      *,
      ex_bid_open (*)
    `;
  }
  if (dataset === "kr") {
    return `
      *,
      kr_bid_open (*)
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
  if (isOpenOnlyCrawlDataset(dataset)) {
    return ["BID"];
  }
  if (isCrawlMasterDataset(dataset)) {
    return ["BID", "PRE_SPEC"];
  }
  return ["BID", "PRIVATE", "PLAN_SPEC"];
}

export function isNoticeTypeValidForDataset(
  dataset: BidNoticeDataset,
  noticeType: BidNoticeType,
): boolean {
  return getNoticeTypesForDataset(dataset).includes(noticeType);
}

export function getNoticeTypeValidationMessage(dataset: BidNoticeDataset): string {
  return `noticeType은 ${getNoticeTypesForDataset(dataset).join(", ")} 중 하나여야 합니다.`;
}

export function getNoticeListOrderColumn(
  dataset: BidNoticeDataset,
): "notice_date" | "created_at" {
  return isCrawlMasterDataset(dataset) ? "created_at" : "notice_date";
}

export function hasNoticeDateColumn(dataset: BidNoticeDataset): boolean {
  return !isCrawlMasterDataset(dataset);
}

export function getNoticeSearchOrFilter(
  dataset: BidNoticeDataset,
  pattern: string,
): string {
  const base = `title.ilike.${pattern},notice_no.ilike.${pattern}`;
  if (dataset === "g2b") {
    return `${base},agency_name.ilike.${pattern}`;
  }
  if (
    dataset === "kogas" ||
    dataset === "lh" ||
    dataset === "ex" ||
    dataset === "kr"
  ) {
    return `${base},notice_div.ilike.${pattern}`;
  }
  if (dataset === "srm") {
    return `${base},dept_name.ilike.${pattern},company_name.ilike.${pattern}`;
  }
  return `${base},dept_name.ilike.${pattern}`;
}

export function supportsManualBidNoticeEntry(dataset: BidNoticeDataset): boolean {
  return dataset === "khnp";
}

export function getNoticeTypeDbValues(
  dataset: BidNoticeDataset,
  noticeType: BidNoticeType,
): string[] {
  if (isCrawlMasterDataset(dataset)) {
    return CRAWL_MASTER_NOTICE_TYPE_DB_VALUES[noticeType] ?? [noticeType];
  }
  return [noticeType];
}

/**
 * 입찰공고 조회 기본 목록에서 마감 여부로 제외할지.
 * 크롤 마스터(G2B·KOGAS·LH·EX·KR)는 마감된 공고도 기본 목록에 표시한다.
 */
export function excludesExpiredNoticesInDefaultList(
  dataset: BidNoticeDataset,
): boolean {
  return !isCrawlMasterDataset(dataset);
}

export const ALL_BID_NOTICE_TYPES: BidNoticeType[] = [
  "BID",
  "PRIVATE",
  "PLAN_SPEC",
  "SPEC_REVIEW",
  "PRE_SPEC",
];
