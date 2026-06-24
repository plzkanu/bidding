-- 직접 등록한 입찰공고 구분 (크롤링 vs 수동 입력)
ALTER TABLE khnp_bid_notice
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'crawl';

ALTER TABLE khnp_bid_notice
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE khnp_bid_notice
  DROP CONSTRAINT IF EXISTS khnp_bid_notice_source_check;

ALTER TABLE khnp_bid_notice
  ADD CONSTRAINT khnp_bid_notice_source_check
  CHECK (source IN ('crawl', 'manual'));

CREATE INDEX IF NOT EXISTS idx_khnp_bid_notice_source ON khnp_bid_notice(source);
CREATE INDEX IF NOT EXISTS idx_khnp_bid_notice_created_by ON khnp_bid_notice(created_by);
