import type {
  KhnpBidNoticeRow,
  KhnpBidOpen,
  KhnpBidPlanSpec,
  SrmBidNoticeRow,
  SrmBidOpen,
  SrmBidSpecReview,
} from "./types";
import { pickOne } from "./utils";

function mapSrmOpenToKhnpOpen(open: SrmBidOpen): KhnpBidOpen {
  return {
    id: open.id,
    notice_id: open.notice_id,
    status: open.status,
    bid_method: open.contract_method ?? open.notice_kind,
    domestic_flag: null,
    purchase_type: open.bid_div,
    bid_start_dt: open.bid_start_dt,
    bid_close_dt: open.bid_close_dt ?? open.participation_deadline_dt,
    award_method: open.award_method,
  };
}

function mapSrmSpecReviewToPlanSpec(
  spec: SrmBidSpecReview,
): KhnpBidPlanSpec {
  return {
    id: spec.id,
    notice_id: spec.notice_id,
  };
}

export function normalizeSrmBidNoticeRow(row: SrmBidNoticeRow): KhnpBidNoticeRow {
  const open = pickOne(row.srm_bid_open);
  const spec = pickOne(row.srm_bid_spec_review);

  return {
    id: row.id,
    site_id: row.site_id,
    notice_type: row.notice_type,
    notice_no: row.notice_no,
    origin_notice_no: row.origin_notice_no,
    notice_div: row.notice_div || null,
    title: row.title,
    dept_name: row.dept_name ?? row.company_name,
    notice_date: row.notice_date,
    notice_period_start: row.notice_period_start,
    notice_period_end: row.notice_period_end,
    is_deleted: row.is_deleted ?? false,
    source: row.source,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    khnp_bid_open: open ? mapSrmOpenToKhnpOpen(open) : null,
    khnp_bid_private: null,
    khnp_bid_plan_spec: spec ? mapSrmSpecReviewToPlanSpec(spec) : null,
    srm_bid_open: row.srm_bid_open,
    srm_bid_spec_review: row.srm_bid_spec_review,
    dataset: "srm",
  };
}
