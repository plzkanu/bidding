export type BidNoticeType = "BID" | "PRIVATE" | "PLAN_SPEC";

export type BidNoticeSource = "crawl" | "manual";

export const BID_NOTICE_TYPE_LABELS: Record<BidNoticeType, string> = {
  BID: "입찰공고",
  PRIVATE: "수의계약 사전공고",
  PLAN_SPEC: "발주계획·규격 사전공고",
};

export interface KhnpBidNotice {
  id: string;
  site_id: number;
  notice_type: BidNoticeType;
  notice_no: string;
  origin_notice_no: string | null;
  notice_div: string | null;
  title: string;
  dept_name: string | null;
  notice_date: string | null;
  notice_period_start: string | null;
  notice_period_end: string | null;
  is_deleted: boolean;
  /** 마이그레이션 010 미적용 DB에서는 조회되지 않을 수 있음 */
  source?: BidNoticeSource;
  /** 마이그레이션 010 미적용 DB에서는 조회되지 않을 수 있음 */
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KhnpBidOpen {
  id: string;
  notice_id: string;
  status: string | null;
  bid_method: string | null;
  domestic_flag: string | null;
  purchase_type: string | null;
  bid_start_dt: string | null;
  bid_close_dt: string | null;
  award_method: string | null;
}

export interface KhnpBidPrivate {
  id: string;
  notice_id: string;
  main_content: string | null;
}

export interface KhnpBidPlanSpec {
  id: string;
  notice_id: string;
}

export interface KhnpBidNoticeRow extends KhnpBidNotice {
  khnp_bid_open: KhnpBidOpen | KhnpBidOpen[] | null;
  khnp_bid_private: KhnpBidPrivate | KhnpBidPrivate[] | null;
  khnp_bid_plan_spec: KhnpBidPlanSpec | KhnpBidPlanSpec[] | null;
}

export interface BidNoticeListResult {
  notices: KhnpBidNoticeRow[];
  total: number;
  error: string | null;
}
