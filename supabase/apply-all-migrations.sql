-- SOOSAN 입찰 · 견적 시스템 — 전체 마이그레이션 (Supabase SQL Editor에서 1회 실행)
-- 이미 테이블이 있으면 CREATE IF NOT EXISTS / ON CONFLICT 구문 덕분에 대부분 안전하게 재실행됩니다.

-- crawl_sites (001 이전 사전 테이블 — 크롤링 사이트 관리)
CREATE TABLE IF NOT EXISTS crawl_sites (
  id            SERIAL PRIMARY KEY,
  site_code     TEXT NOT NULL UNIQUE,
  site_name     TEXT NOT NULL,
  site_url      TEXT NOT NULL,
  site_category TEXT,
  org_type      TEXT,
  region        TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_sites_is_active ON crawl_sites (is_active);

-- 001 khnp_bid_notice (이미 KPOS 테이블이 있으면 해당 CREATE는 건너뜀)
CREATE TABLE IF NOT EXISTS khnp_bid_notice (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id          INT REFERENCES crawl_sites(id),
  notice_type      TEXT NOT NULL,
  notice_no        TEXT NOT NULL,
  origin_notice_no TEXT,
  notice_div       TEXT,
  title            TEXT NOT NULL,
  dept_name        TEXT,
  notice_date      TIMESTAMPTZ,
  notice_period_start DATE,
  notice_period_end   DATE,
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, notice_type, notice_no)
);

CREATE TABLE IF NOT EXISTS khnp_bid_open (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id     UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status        TEXT,
  bid_method    TEXT,
  domestic_flag TEXT,
  purchase_type TEXT,
  bid_start_dt  TIMESTAMPTZ,
  bid_close_dt  TIMESTAMPTZ,
  award_method  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS khnp_bid_private (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  main_content TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS khnp_bid_plan_spec (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id  UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 002 user_bid_favorites
CREATE TABLE IF NOT EXISTS user_bid_favorites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bid_favorites_user_id ON user_bid_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_favorites_notice_id ON user_bid_favorites(notice_id);

-- 003 user_bid_notice_memos
CREATE TABLE IF NOT EXISTS user_bid_notice_memos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  memo       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bid_notice_memos_user_id ON user_bid_notice_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_notice_memos_notice_id ON user_bid_notice_memos(notice_id);

-- 004 user_bid_submissions
CREATE TABLE IF NOT EXISTS user_bid_submissions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bid_submissions_user_id ON user_bid_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_submissions_notice_id ON user_bid_submissions(notice_id);

-- 005 user_estimate_submissions
CREATE TABLE IF NOT EXISTS user_estimate_submissions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_estimate_submissions_user_id ON user_estimate_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_estimate_submissions_notice_id ON user_estimate_submissions(notice_id);

-- 006 user_order_reports
CREATE TABLE IF NOT EXISTS user_order_reports (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_order_reports_user_id ON user_order_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_order_reports_notice_id ON user_order_reports(notice_id);

-- 007 bid_notice_attachments + Storage
CREATE TABLE IF NOT EXISTS bid_notice_attachments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size    BIGINT NOT NULL DEFAULT 0,
  mime_type    TEXT,
  uploaded_by  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bid_notice_attachments_notice_id ON bid_notice_attachments(notice_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bid-notice-attachments', 'bid-notice-attachments', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 008 user_bid_notice_screening
CREATE TABLE IF NOT EXISTS user_bid_notice_screening (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'WAITING'
             CHECK (status IN ('WAITING', 'EXCLUDED', 'TARGET')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bid_notice_screening_user_id ON user_bid_notice_screening(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_notice_screening_notice_id ON user_bid_notice_screening(notice_id);

-- 009 user_order_report_summaries + Storage
CREATE TABLE IF NOT EXISTS user_order_report_summaries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL,
  notice_id     UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'PROCESSING'
                CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  summary_json  JSONB,
  storage_path  TEXT,
  docx_file_name TEXT,
  error_message TEXT,
  model_version TEXT,
  generated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_order_report_summaries_user_id
  ON user_order_report_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_order_report_summaries_notice_id
  ON user_order_report_summaries(notice_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-report-summaries', 'order-report-summaries', false, 20971520)
ON CONFLICT (id) DO NOTHING;

-- 010 manual bid notice columns
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

-- 011 order report PQ status
ALTER TABLE user_order_report_summaries
  ADD COLUMN IF NOT EXISTS pq_has_pq BOOLEAN,
  ADD COLUMN IF NOT EXISTS pq_submission_date TEXT;

CREATE INDEX IF NOT EXISTS idx_user_order_report_summaries_pq_has_pq
  ON user_order_report_summaries(pq_has_pq);

-- 012 bid_notice_screening_keywords
CREATE TABLE IF NOT EXISTS bid_notice_screening_keywords (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword    TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_notice_screening_keywords_keyword_lower
  ON bid_notice_screening_keywords (LOWER(keyword));

CREATE INDEX IF NOT EXISTS idx_bid_notice_screening_keywords_is_active
  ON bid_notice_screening_keywords (is_active);

-- 013 departments + bid_notice_assignments
CREATE TABLE IF NOT EXISTS departments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_name_lower ON departments (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments (is_active);

CREATE TABLE IF NOT EXISTS bid_notice_assignments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id        UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  department_id    UUID NOT NULL REFERENCES departments(id),
  assignee_user_id TEXT,
  assigned_by      TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (notice_id)
);

CREATE INDEX IF NOT EXISTS idx_bid_notice_assignments_department_id
  ON bid_notice_assignments (department_id);

CREATE INDEX IF NOT EXISTS idx_bid_notice_assignments_assignee_user_id
  ON bid_notice_assignments (assignee_user_id);

-- 014 bid_users (앱 사용자 계정)
CREATE TABLE IF NOT EXISTS bid_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  department text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_users_role ON bid_users (role);
CREATE INDEX IF NOT EXISTS idx_bid_users_active ON bid_users (active);

INSERT INTO bid_users (id, name, password_hash, role, department, active) VALUES
  (
    'admin',
    '시스템 관리자',
    '$2b$10$m6fqr16mquxvwCMKbwAaJOT.aqijUPO6YikbQNpn8U0tV2zLE6OY.',
    'admin',
    '',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- RLS: Next.js Service Role API 전용 — PostgREST 사용 시 정책 없이 ENABLE 하면 CRUD 차단됨
ALTER TABLE crawl_sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE khnp_bid_notice DISABLE ROW LEVEL SECURITY;
ALTER TABLE khnp_bid_open DISABLE ROW LEVEL SECURITY;
ALTER TABLE khnp_bid_private DISABLE ROW LEVEL SECURITY;
ALTER TABLE khnp_bid_plan_spec DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_bid_favorites DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_bid_notice_memos DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_bid_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_estimate_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_order_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE bid_notice_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_bid_notice_screening DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_order_report_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE bid_notice_screening_keywords DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE bid_notice_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE bid_users DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
