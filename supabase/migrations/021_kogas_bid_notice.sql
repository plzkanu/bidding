-- 한국가스공사(KOGAS) 입찰공고 — G2B/SRM과 동일한 마스터·상세 구조

CREATE TABLE IF NOT EXISTS kogas_bid_notice (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     INT NOT NULL REFERENCES crawl_sites(id),
  notice_type TEXT NOT NULL,
  notice_no   TEXT NOT NULL,
  title       TEXT NOT NULL,
  notice_div  TEXT,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  source      TEXT NOT NULL DEFAULT 'crawl',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kogas_bid_notice_source_check
    CHECK (source = ANY (ARRAY['crawl'::text, 'manual'::text])),
  UNIQUE (site_id, notice_type, notice_no, title, notice_div)
);

CREATE TABLE IF NOT EXISTS kogas_bid_open (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id           UUID NOT NULL UNIQUE REFERENCES kogas_bid_notice(id) ON DELETE CASCADE,
  bid_no              TEXT,
  bid_title           TEXT,
  bid_div             TEXT,
  work_div            TEXT,
  contract_method     TEXT,
  bid_apply_close_dt  TIMESTAMPTZ,
  open_dt             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kogas_bid_pre_spec (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id        UUID NOT NULL UNIQUE REFERENCES kogas_bid_notice(id) ON DELETE CASCADE,
  pre_spec_no      TEXT,
  spec_div         TEXT,
  spec_title       TEXT,
  item_category_no TEXT,
  close_dt         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kogas_bid_notice_site_id ON kogas_bid_notice(site_id);
CREATE INDEX IF NOT EXISTS idx_kogas_bid_notice_notice_type ON kogas_bid_notice(notice_type);
CREATE INDEX IF NOT EXISTS idx_kogas_bid_notice_is_deleted ON kogas_bid_notice(is_deleted);
CREATE INDEX IF NOT EXISTS idx_kogas_bid_notice_source ON kogas_bid_notice(source);

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

ALTER TABLE kogas_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE kogas_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE kogas_bid_pre_spec DISABLE ROW LEVEL SECURITY;
