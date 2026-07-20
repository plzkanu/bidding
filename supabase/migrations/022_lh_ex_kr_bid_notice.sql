-- 한국토지주택공사(LH) / 한국도로공사(EX) / 국가철도공단(KR) 입찰공고

CREATE TABLE IF NOT EXISTS lh_bid_notice (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       INT NOT NULL REFERENCES crawl_sites(id),
  notice_type   TEXT NOT NULL,
  notice_no     TEXT NOT NULL,
  title         TEXT NOT NULL,
  notice_div    TEXT,
  notice_status TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'crawl',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lh_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text]))
);

CREATE TABLE IF NOT EXISTS lh_bid_open (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id        UUID NOT NULL UNIQUE REFERENCES lh_bid_notice(id) ON DELETE CASCADE,
  notice_no        TEXT,
  work_type        TEXT,
  classification   TEXT,
  title            TEXT,
  contract_method  TEXT,
  bid_close_dt     TIMESTAMPTZ,
  regional_office  TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ex_bid_notice (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       INT NOT NULL REFERENCES crawl_sites(id),
  notice_type   TEXT NOT NULL,
  notice_no     TEXT NOT NULL,
  title         TEXT NOT NULL,
  notice_div    TEXT,
  notice_status TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'crawl',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ex_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text]))
);

CREATE TABLE IF NOT EXISTS ex_bid_open (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id        UUID NOT NULL UNIQUE REFERENCES ex_bid_notice(id) ON DELETE CASCADE,
  notice_no        TEXT,
  region_name      TEXT,
  title            TEXT,
  bid_license      TEXT,
  design_amount    NUMERIC,
  contract_method  TEXT,
  notice_date      TIMESTAMPTZ,
  status           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kr_bid_notice (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       INT NOT NULL REFERENCES crawl_sites(id),
  notice_type   TEXT NOT NULL,
  notice_no     TEXT NOT NULL,
  title         TEXT NOT NULL,
  notice_div    TEXT,
  notice_status TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'crawl',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kr_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text]))
);

CREATE TABLE IF NOT EXISTS kr_bid_open (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id      UUID NOT NULL UNIQUE REFERENCES kr_bid_notice(id) ON DELETE CASCADE,
  notice_div     TEXT,
  notice_no      TEXT,
  title          TEXT,
  design_amount  NUMERIC,
  notice_date    TIMESTAMPTZ,
  opening_date   TIMESTAMPTZ,
  status         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lh_bid_notice_site_id ON lh_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_lh_bid_notice_notice_type ON lh_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_lh_bid_notice_is_deleted ON lh_bid_notice(is_deleted);
CREATE INDEX IF NOT EXISTS idx_ex_bid_notice_site_id ON ex_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_ex_bid_notice_notice_type ON ex_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_ex_bid_notice_is_deleted ON ex_bid_notice(is_deleted);
CREATE INDEX IF NOT EXISTS idx_kr_bid_notice_site_id ON kr_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_kr_bid_notice_notice_type ON kr_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_kr_bid_notice_is_deleted ON kr_bid_notice(is_deleted);

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

ALTER TABLE lh_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE lh_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE ex_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE ex_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE kr_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE kr_bid_open DISABLE ROW LEVEL SECURITY;
