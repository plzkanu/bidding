import type {
  BidNoticeType,
  KhnpBidNoticeRow,
  KhnpBidOpen,
  KhnpBidPlanSpec,
  KogasBidNoticeRow,
  KogasBidOpen,
  KogasBidPreSpec,
} from "./types";
import { pickOne } from "./utils";

function normalizeKogasNoticeType(
  value: string,
  row?: Pick<KogasBidNoticeRow, "kogas_bid_open" | "kogas_bid_pre_spec">,
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
    if (pickOne(row.kogas_bid_open)) return "BID";
    if (pickOne(row.kogas_bid_pre_spec)) return "PRE_SPEC";
  }

  return trimmed ? (trimmed as BidNoticeType) : "BID";
}

export function matchesKogasListNoticeType(
  row: KogasBidNoticeRow,
  noticeType: BidNoticeType,
): boolean {
  const open = pickOne(row.kogas_bid_open);
  const preSpec = pickOne(row.kogas_bid_pre_spec);
  const normalized = normalizeKogasNoticeType(row.notice_type, row);

  if (noticeType === "BID") {
    if (open) return true;
    if (preSpec) return false;
    if (normalized === "PRE_SPEC") return false;
    if (normalized === "BID") return true;
    return true;
  }

  if (noticeType === "PRE_SPEC") {
    if (preSpec) return true;
    if (open) return false;
    return normalized === "PRE_SPEC";
  }

  return normalized === noticeType;
}

function mapKogasOpenToKhnpOpen(open: KogasBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.work_div,
    bid_method: open.contract_method ?? open.work_div,
    domestic_flag: null,
    purchase_type: open.bid_div,
    bid_start_dt: open.open_dt,
    bid_close_dt: open.bid_apply_close_dt,
    award_method: null,
  };
}

function mapKogasPreSpecToPlanSpec(spec: KogasBidPreSpec): KhnpBidPlanSpec {
  return {
    id: spec.id,
    notice_id: spec.notice_id,
  };
}

export function normalizeKogasBidNoticeRow(
  row: KogasBidNoticeRow,
): KhnpBidNoticeRow {
  const open = pickOne(row.kogas_bid_open);
  const preSpec = pickOne(row.kogas_bid_pre_spec);
  const noticeDate = open?.open_dt ?? preSpec?.close_dt ?? null;

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: normalizeKogasNoticeType(row.notice_type, row),
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
    khnp_bid_open: open ? mapKogasOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: preSpec ? mapKogasPreSpecToPlanSpec(preSpec) : null,
    kogas_bid_open: row.kogas_bid_open,
    kogas_bid_pre_spec: row.kogas_bid_pre_spec,
    dataset: "kogas",
  };
}
