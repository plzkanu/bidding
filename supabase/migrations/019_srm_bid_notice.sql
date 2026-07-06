-- 한국전력공사(SRM) 입찰공고 — KHNP(khnp_*)와 동일한 마스터·상세 구조

CREATE TABLE IF NOT EXISTS srm_bid_notice (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id             INT REFERENCES crawl_sites(id),
  notice_type         TEXT NOT NULL,
  notice_no           TEXT NOT NULL,
  origin_notice_no    TEXT,
  notice_div          TEXT NOT NULL DEFAULT '',
  notice_status       TEXT NOT NULL DEFAULT '',
  title               TEXT NOT NULL,
  company_name        TEXT,
  dept_name           TEXT,
  notice_date         TIMESTAMPTZ,
  notice_period_start DATE,
  notice_period_end   DATE,
  is_deleted          BOOLEAN DEFAULT FALSE,
  source              TEXT NOT NULL DEFAULT 'crawl',
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, notice_type, notice_no, notice_div, notice_status),
  CONSTRAINT srm_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text]))
);

CREATE TABLE IF NOT EXISTS srm_bid_open (
  id                       UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id                UUID UNIQUE REFERENCES srm_bid_notice(id) ON DELETE CASCADE,
  status                   TEXT,
  notice_kind              TEXT,
  bid_div                  TEXT,
  company_name             TEXT,
  notice_no                TEXT,
  title                    TEXT,
  dept_name                TEXT,
  notice_date              TIMESTAMPTZ,
  contract_method          TEXT,
  award_method             TEXT,
  participation_deadline_dt TIMESTAMPTZ,
  bid_start_dt             TIMESTAMPTZ,
  bid_close_dt             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srm_bid_spec_review (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id     UUID UNIQUE REFERENCES srm_bid_notice(id) ON DELETE CASCADE,
  receipt_no    TEXT,
  company_name  TEXT,
  item_name     TEXT,
  review_div    TEXT,
  opinion       TEXT,
  dept_name     TEXT,
  status        TEXT,
  registered_by TEXT,
  registered_at TIMESTAMPTZ,
  view_count    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_bid_notice_site_id ON srm_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_srm_bid_notice_notice_type ON srm_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_srm_bid_notice_is_deleted ON srm_bid_notice(is_deleted);
CREATE INDEX IF NOT EXISTS idx_srm_bid_notice_source ON srm_bid_notice(source);

-- SRM 공고 ID도 사용자 기능(관심·선별 등)에 쓸 수 있도록 khnp 전용 FK 제거
ALTER TABLE user_bid_favorites
  DROP CONSTRAINT IF EXISTS user_bid_favorites_notice_id_fkey;
ALTER TABLE user_bid_notice_memos
  DROP CONSTRAINT IF EXISTS user_bid_notice_memos_notice_id_fkey;
ALTER TABLE user_bid_submissions
  DROP CONSTRAINT IF EXISTS user_bid_submissions_notice_id_fkey;
ALTER TABLE user_estimate_submissions
  DROP CONSTRAINT IF EXISTS user_estimate_submissions_notice_id_fkey;
ALTER TABLE user_order_reports
  DROP CONSTRAINT IF EXISTS user_order_reports_notice_id_fkey;
ALTER TABLE bid_notice_attachments
  DROP CONSTRAINT IF EXISTS bid_notice_attachments_notice_id_fkey;
ALTER TABLE user_bid_notice_screening
  DROP CONSTRAINT IF EXISTS user_bid_notice_screening_notice_id_fkey;
ALTER TABLE user_order_report_summaries
  DROP CONSTRAINT IF EXISTS user_order_report_summaries_notice_id_fkey;
ALTER TABLE bid_notice_assignments
  DROP CONSTRAINT IF EXISTS bid_notice_assignments_notice_id_fkey;

ALTER TABLE srm_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE srm_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE srm_bid_spec_review DISABLE ROW LEVEL SECURITY;
