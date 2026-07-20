import type {
  BidNoticeType,
  G2bBidNoticeRow,
  G2bBidOpen,
  G2bBidPreSpec,
  KhnpBidNoticeRow,
  KhnpBidOpen,
  KhnpBidPlanSpec,
} from "./types";
import { pickOne } from "./utils";

function normalizeG2bNoticeType(
  value: string,
  row?: Pick<G2bBidNoticeRow, "g2b_bid_open" | "g2b_bid_pre_spec">,
): BidNoticeType {
  const trimmed = value?.trim() ?? "";
  if (trimmed) {
    const normalized = trimmed.toUpperCase().replace(/-/g, "_");
    if (normalized === "BID" || trimmed.includes("입찰")) return "BID";
    if (
      normalized === "PRE_SPEC" ||
      trimmed.includes("사전규격") ||
      trimmed.includes("사전")
    ) {
      return "PRE_SPEC";
    }
  }

  if (row) {
    if (pickOne(row.g2b_bid_open)) return "BID";
    if (pickOne(row.g2b_bid_pre_spec)) return "PRE_SPEC";
  }

  return trimmed ? (trimmed as BidNoticeType) : "BID";
}

export function matchesG2bListNoticeType(
  row: G2bBidNoticeRow,
  noticeType: BidNoticeType,
): boolean {
  const open = pickOne(row.g2b_bid_open);
  const preSpec = pickOne(row.g2b_bid_pre_spec);
  const normalized = normalizeG2bNoticeType(row.notice_type, row);

  if (noticeType === "BID") {
    if (open) return true;
    if (preSpec) return false;
    if (normalized === "PRE_SPEC") return false;
    if (normalized === "BID") return true;
    // 상세 없이 마스터만 적재된 경우 입찰공고 탭에 표시
    return true;
  }

  if (noticeType === "PRE_SPEC") {
    if (preSpec) return true;
    if (open) return false;
    return normalized === "PRE_SPEC";
  }

  return normalized === noticeType;
}

function mapG2bOpenToKhnpOpen(open: G2bBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.work_status,
    bid_method: open.work_div,
    domestic_flag: null,
    purchase_type: open.bid_div,
    bid_start_dt: open.posted_at,
    bid_close_dt: open.bid_close_dt,
    award_method: null,
  };
}

function mapG2bPreSpecToPlanSpec(spec: G2bBidPreSpec): KhnpBidPlanSpec {
  return {
    id: spec.id,
    notice_id: spec.notice_id,
  };
}

export function normalizeG2bBidNoticeRow(row: G2bBidNoticeRow): KhnpBidNoticeRow {
  const open = pickOne(row.g2b_bid_open);
  const preSpec = pickOne(row.g2b_bid_pre_spec);
  const noticeDate = open?.posted_at ?? preSpec?.progress_date ?? null;

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: normalizeG2bNoticeType(row.notice_type, row),
    notice_no: row.notice_no,
    origin_notice_no: null,
    notice_div: row.notice_div || null,
    title: row.title,
    dept_name: row.agency_name ?? open?.agency_name ?? preSpec?.agency_name ?? null,
    notice_date: noticeDate,
    notice_period_start: null,
    notice_period_end: null,
    is_deleted: row.is_deleted,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    khnp_bid_open: open ? mapG2bOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: preSpec ? mapG2bPreSpecToPlanSpec(preSpec) : null,
    g2b_bid_open: row.g2b_bid_open,
    g2b_bid_pre_spec: row.g2b_bid_pre_spec,
    dataset: "g2b",
  };
}
