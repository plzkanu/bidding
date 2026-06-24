-- 관리자 등록 담당부서
CREATE TABLE departments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_departments_name_lower ON departments (LOWER(name));

CREATE INDEX idx_departments_is_active ON departments (is_active);

-- 입찰공고별 담당부서·담당자 지정 (조직 공통)
CREATE TABLE bid_notice_assignments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id        UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  department_id    UUID NOT NULL REFERENCES departments(id),
  assignee_user_id TEXT,
  assigned_by      TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (notice_id)
);

CREATE INDEX idx_bid_notice_assignments_department_id
  ON bid_notice_assignments (department_id);

CREATE INDEX idx_bid_notice_assignments_assignee_user_id
  ON bid_notice_assignments (assignee_user_id);
