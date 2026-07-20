import type {
  BidNoticeType,
  KhnpBidNoticeRow,
  KhnpBidOpen,
  KrBidNoticeRow,
  KrBidOpen,
} from "./types";
import { pickOne } from "./utils";

function normalizeKrNoticeType(value: string): BidNoticeType {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "BID";
  const normalized = trimmed.toUpperCase().replace(/-/g, "_");
  if (
    normalized === "BID" ||
    normalized === "OPEN" ||
    trimmed.includes("입찰")
  ) {
    return "BID";
  }
  return trimmed as BidNoticeType;
}

export function matchesKrListNoticeType(
  row: KrBidNoticeRow,
  noticeType: BidNoticeType,
): boolean {
  if (noticeType !== "BID") return false;
  const open = pickOne(row.kr_bid_open);
  if (open) return true;
  return normalizeKrNoticeType(row.notice_type) === "BID";
}

function mapKrOpenToKhnpOpen(open: KrBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.status,
    bid_method: null,
    domestic_flag: null,
    purchase_type: open.notice_div,
    bid_start_dt: open.notice_date,
    // 마감일시가 없어 개찰일을 마감 대용으로 사용
    bid_close_dt: open.opening_date,
    award_method: null,
  };
}

export function normalizeKrBidNoticeRow(row: KrBidNoticeRow): KhnpBidNoticeRow {
  const open = pickOne(row.kr_bid_open);
  const noticeDate = open?.notice_date ?? open?.opening_date ?? null;

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: normalizeKrNoticeType(row.notice_type),
    notice_no: row.notice_no,
    origin_notice_no: null,
    notice_div: row.notice_div,
    title: row.title,
    dept_name: row.notice_div,
    notice_date: noticeDate,
    notice_period_start: null,
    notice_period_end: null,
    is_deleted: row.is_deleted,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    khnp_bid_open: open ? mapKrOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: null,
    kr_bid_open: row.kr_bid_open,
    dataset: "kr",
  };
}
