import type {
  BidNoticeType,
  ExBidNoticeRow,
  ExBidOpen,
  KhnpBidNoticeRow,
  KhnpBidOpen,
} from "./types";
import { pickOne } from "./utils";

function normalizeExNoticeType(value: string): BidNoticeType {
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

export function matchesExListNoticeType(
  row: ExBidNoticeRow,
  noticeType: BidNoticeType,
): boolean {
  if (noticeType !== "BID") return false;
  const open = pickOne(row.ex_bid_open);
  if (open) return true;
  return normalizeExNoticeType(row.notice_type) === "BID";
}

function mapExOpenToKhnpOpen(open: ExBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.status,
    bid_method: open.contract_method,
    domestic_flag: null,
    purchase_type: open.bid_license,
    bid_start_dt: open.notice_date,
    bid_close_dt: null,
    award_method: null,
  };
}

export function normalizeExBidNoticeRow(row: ExBidNoticeRow): KhnpBidNoticeRow {
  const open = pickOne(row.ex_bid_open);
  const noticeDate = open?.notice_date ?? null;

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: normalizeExNoticeType(row.notice_type),
    notice_no: row.notice_no,
    origin_notice_no: null,
    notice_div: row.notice_div,
    title: row.title,
    dept_name: open?.region_name ?? row.notice_div,
    notice_date: noticeDate,
    notice_period_start: null,
    notice_period_end: null,
    is_deleted: row.is_deleted,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    khnp_bid_open: open ? mapExOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: null,
    ex_bid_open: row.ex_bid_open,
    dataset: "ex",
  };
}
