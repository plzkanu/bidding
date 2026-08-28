-- 시스템 설정 (키-값)

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 미사용 타임아웃(분). 0이면 비활성. 기본 30분
INSERT INTO app_settings (key, value) VALUES
  ('idle_timeout_minutes', '30')
ON CONFLICT (key) DO NOTHING;
