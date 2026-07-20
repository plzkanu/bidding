export type BidNoticeType = "BID" | "PRIVATE" | "PLAN_SPEC" | "SPEC_REVIEW" | "PRE_SPEC";

export type BidNoticeSource = "crawl" | "manual";

export type BidNoticeDatasetTag =
  | "khnp"
  | "srm"
  | "g2b"
  | "kogas"
  | "lh"
  | "ex"
  | "kr";

export const BID_NOTICE_TYPE_LABELS: Record<BidNoticeType, string> = {
  BID: "입찰공고",
  PRIVATE: "수의계약 사전공고",
  PLAN_SPEC: "발주계획·규격 사전공고",
  SPEC_REVIEW: "규격검토",
  PRE_SPEC: "사전규격",
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

export interface SrmBidOpen {
  id: string;
  notice_id: string;
  status: string | null;
  notice_kind: string | null;
  bid_div: string | null;
  company_name: string | null;
  notice_no: string | null;
  title: string | null;
  dept_name: string | null;
  notice_date: string | null;
  contract_method: string | null;
  award_method: string | null;
  participation_deadline_dt: string | null;
  bid_start_dt: string | null;
  bid_close_dt: string | null;
  created_at?: string | null;
}

export interface SrmBidSpecReview {
  id: string;
  notice_id: string;
  receipt_no: string | null;
  company_name: string | null;
  item_name: string | null;
  review_div: string | null;
  opinion: string | null;
  dept_name: string | null;
  status: string | null;
  registered_by: string | null;
  registered_at: string | null;
  view_count: number | null;
  created_at?: string | null;
}

export interface SrmBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: BidNoticeType;
  notice_no: string;
  origin_notice_no: string | null;
  notice_div: string | null;
  notice_status: string | null;
  title: string;
  company_name: string | null;
  dept_name: string | null;
  notice_date: string | null;
  notice_period_start: string | null;
  notice_period_end: string | null;
  is_deleted: boolean | null;
  source?: BidNoticeSource;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  srm_bid_open: SrmBidOpen | SrmBidOpen[] | null;
  srm_bid_spec_review: SrmBidSpecReview | SrmBidSpecReview[] | null;
}

export interface G2bBidOpen {
  id: string;
  notice_id: string;
  work_div: string | null;
  work_status: string | null;
  bid_div: string | null;
  bid_notice_no: string | null;
  title: string | null;
  agency_name: string | null;
  demand_agency_name: string | null;
  posted_at: string | null;
  bid_close_dt: string | null;
  created_at?: string | null;
}

export interface G2bBidPreSpec {
  id: string;
  notice_id: string;
  work_div: string | null;
  work_status: string | null;
  project_name: string | null;
  agency_name: string | null;
  progress_date: string | null;
  created_at?: string | null;
}

export interface G2bBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: BidNoticeType;
  notice_no: string;
  title: string;
  agency_name: string;
  notice_div: string;
  notice_status: string;
  is_deleted: boolean;
  source?: BidNoticeSource;
  created_at: string;
  updated_at: string;
  g2b_bid_open: G2bBidOpen | G2bBidOpen[] | null;
  g2b_bid_pre_spec: G2bBidPreSpec | G2bBidPreSpec[] | null;
}

export interface KogasBidOpen {
  id: string;
  notice_id: string;
  bid_no: string | null;
  bid_title: string | null;
  bid_div: string | null;
  work_div: string | null;
  contract_method: string | null;
  bid_apply_close_dt: string | null;
  open_dt: string | null;
  created_at?: string | null;
}

export interface KogasBidPreSpec {
  id: string;
  notice_id: string;
  pre_spec_no: string | null;
  spec_div: string | null;
  spec_title: string | null;
  item_category_no: string | null;
  close_dt: string | null;
  created_at?: string | null;
}

export interface KogasBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: string;
  notice_no: string;
  title: string;
  notice_div: string | null;
  is_deleted: boolean;
  source?: BidNoticeSource;
  created_at: string;
  updated_at: string;
  kogas_bid_open: KogasBidOpen | KogasBidOpen[] | null;
  kogas_bid_pre_spec: KogasBidPreSpec | KogasBidPreSpec[] | null;
}

export interface LhBidOpen {
  id: string;
  notice_id: string;
  notice_no: string | null;
  work_type: string | null;
  classification: string | null;
  title: string | null;
  contract_method: string | null;
  bid_close_dt: string | null;
  regional_office: string | null;
  status: string | null;
  created_at?: string | null;
}

export interface LhBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: string;
  notice_no: string;
  title: string;
  notice_div: string | null;
  notice_status: string | null;
  is_deleted: boolean;
  source?: BidNoticeSource;
  created_at: string;
  updated_at: string;
  lh_bid_open: LhBidOpen | LhBidOpen[] | null;
}

export interface ExBidOpen {
  id: string;
  notice_id: string;
  notice_no: string | null;
  region_name: string | null;
  title: string | null;
  bid_license: string | null;
  design_amount: number | null;
  contract_method: string | null;
  notice_date: string | null;
  status: string | null;
  created_at?: string | null;
}

export interface ExBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: string;
  notice_no: string;
  title: string;
  notice_div: string | null;
  notice_status: string | null;
  is_deleted: boolean;
  source?: BidNoticeSource;
  created_at: string;
  updated_at: string;
  ex_bid_open: ExBidOpen | ExBidOpen[] | null;
}

export interface KrBidOpen {
  id: string;
  notice_id: string;
  notice_div: string | null;
  notice_no: string | null;
  title: string | null;
  design_amount: number | null;
  notice_date: string | null;
  opening_date: string | null;
  status: string | null;
  created_at?: string | null;
}

export interface KrBidNoticeRow {
  id: string;
  site_id: number;
  notice_type: string;
  notice_no: string;
  title: string;
  notice_div: string | null;
  notice_status: string | null;
  is_deleted: boolean;
  source?: BidNoticeSource;
  created_at: string;
  updated_at: string;
  kr_bid_open: KrBidOpen | KrBidOpen[] | null;
}

export interface KhnpBidNoticeRow extends KhnpBidNotice {
  khnp_bid_open: KhnpBidOpen | KhnpBidOpen[] | null;
  khnp_bid_private: KhnpBidPrivate | KhnpBidPrivate[] | null;
  khnp_bid_plan_spec: KhnpBidPlanSpec | KhnpBidPlanSpec[] | null;
  /** SRM 원본 상세 (정규화 후에도 상세 모달 등에서 참조 가능) */
  srm_bid_open?: SrmBidOpen | SrmBidOpen[] | null;
  srm_bid_spec_review?: SrmBidSpecReview | SrmBidSpecReview[] | null;
  /** G2B 원본 상세 */
  g2b_bid_open?: G2bBidOpen | G2bBidOpen[] | null;
  g2b_bid_pre_spec?: G2bBidPreSpec | G2bBidPreSpec[] | null;
  /** KOGAS 원본 상세 */
  kogas_bid_open?: KogasBidOpen | KogasBidOpen[] | null;
  kogas_bid_pre_spec?: KogasBidPreSpec | KogasBidPreSpec[] | null;
  /** LH 원본 상세 */
  lh_bid_open?: LhBidOpen | LhBidOpen[] | null;
  /** EX 원본 상세 */
  ex_bid_open?: ExBidOpen | ExBidOpen[] | null;
  /** KR 원본 상세 */
  kr_bid_open?: KrBidOpen | KrBidOpen[] | null;
  dataset?: BidNoticeDatasetTag;
}

export interface BidNoticeListResult {
  notices: KhnpBidNoticeRow[];
  total: number;
  error: string | null;
}
