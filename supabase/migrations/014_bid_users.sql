-- SOOSAN 입찰 · 견적 시스템: 앱 사용자 (커스텀 인증, Supabase Auth 미사용)

CREATE TABLE bid_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  department text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bid_users_role ON bid_users (role);
CREATE INDEX idx_bid_users_active ON bid_users (active);

-- 서버 전용 테이블: Next.js API(Service Role)에서만 접근
ALTER TABLE bid_users DISABLE ROW LEVEL SECURITY;

-- 초기 관리자 (비밀번호: admin123)
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
