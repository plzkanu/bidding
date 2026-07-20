-- 나라장터(G2B) 입찰공고 — KHNP/SRM과 동일한 마스터·상세 구조

CREATE TABLE IF NOT EXISTS g2b_bid_notice (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       INT NOT NULL REFERENCES crawl_sites(id),
  notice_type   TEXT NOT NULL,
  notice_no     TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  agency_name   TEXT NOT NULL,
  notice_div    TEXT NOT NULL DEFAULT '',
  notice_status TEXT NOT NULL DEFAULT '',
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'crawl',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT g2b_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_g2b_bid_notice_common
  ON g2b_bid_notice (
    site_id,
    notice_type,
    notice_no,
    title,
    agency_name,
    notice_div,
    notice_status
  );

CREATE TABLE IF NOT EXISTS g2b_bid_open (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id          UUID NOT NULL UNIQUE REFERENCES g2b_bid_notice(id) ON DELETE CASCADE,
  work_div           TEXT,
  work_status        TEXT,
  bid_div            TEXT,
  bid_notice_no      TEXT,
  title              TEXT,
  agency_name        TEXT,
  demand_agency_name TEXT,
  posted_at          TIMESTAMPTZ,
  bid_close_dt       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS g2b_bid_pre_spec (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id     UUID NOT NULL UNIQUE REFERENCES g2b_bid_notice(id) ON DELETE CASCADE,
  work_div      TEXT,
  work_status   TEXT,
  project_name  TEXT,
  agency_name   TEXT,
  progress_date TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_g2b_bid_notice_site_id ON g2b_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_g2b_bid_notice_notice_type ON g2b_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_g2b_bid_notice_is_deleted ON g2b_bid_notice(is_deleted);
CREATE INDEX IF NOT EXISTS idx_g2b_bid_notice_source ON g2b_bid_notice(source);

-- G2B 공고 ID도 사용자 기능에 쓸 수 있도록 khnp 전용 FK 제거 (019와 동일, idempotent)
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

ALTER TABLE g2b_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE g2b_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE g2b_bid_pre_spec DISABLE ROW LEVEL SECURITY;
