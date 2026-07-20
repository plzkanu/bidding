import type {
  BidNoticeType,
  KhnpBidNoticeRow,
  KhnpBidOpen,
  LhBidNoticeRow,
  LhBidOpen,
} from "./types";
import { pickOne } from "./utils";

function normalizeLhNoticeType(value: string): BidNoticeType {
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

export function matchesLhListNoticeType(
  row: LhBidNoticeRow,
  noticeType: BidNoticeType,
): boolean {
  if (noticeType !== "BID") return false;
  const open = pickOne(row.lh_bid_open);
  if (open) return true;
  return normalizeLhNoticeType(row.notice_type) === "BID";
}

function mapLhOpenToKhnpOpen(open: LhBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.status,
    bid_method: open.contract_method ?? open.work_type,
    domestic_flag: null,
    purchase_type: open.classification ?? open.work_type,
    bid_start_dt: null,
    bid_close_dt: open.bid_close_dt,
    award_method: null,
  };
}

export function normalizeLhBidNoticeRow(row: LhBidNoticeRow): KhnpBidNoticeRow {
  const open = pickOne(row.lh_bid_open);
  const noticeDate = open?.bid_close_dt ?? null;

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: normalizeLhNoticeType(row.notice_type),
    notice_no: row.notice_no,
    origin_notice_no: null,
    notice_div: row.notice_div,
    title: row.title,
    dept_name: open?.regional_office ?? row.notice_div,
    notice_date: noticeDate,
    notice_period_start: null,
    notice_period_end: null,
    is_deleted: row.is_deleted,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    khnp_bid_open: open ? mapLhOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: null,
    lh_bid_open: row.lh_bid_open,
    dataset: "lh",
  };
}
