-- 사용자 사용량 집계: 최종 접속, 세션(사용시간), 화면별 방문 횟수

ALTER TABLE bid_users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bid_users_last_login_at
  ON bid_users (last_login_at DESC NULLS LAST);

-- 접속 세션 (활성 시간 누적)
CREATE TABLE user_usage_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES bid_users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  active_seconds integer NOT NULL DEFAULT 0
    CHECK (active_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_usage_sessions_user_id
  ON user_usage_sessions (user_id);

CREATE INDEX idx_user_usage_sessions_started_at
  ON user_usage_sessions (started_at DESC);

CREATE INDEX idx_user_usage_sessions_user_started
  ON user_usage_sessions (user_id, started_at DESC);

-- 화면별 방문 횟수 (계정×화면 집계)
CREATE TABLE user_page_visit_stats (
  user_id text NOT NULL REFERENCES bid_users(id) ON DELETE CASCADE,
  screen_key text NOT NULL,
  visit_count integer NOT NULL DEFAULT 0
    CHECK (visit_count >= 0),
  last_visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, screen_key)
);

CREATE INDEX idx_user_page_visit_stats_last_visited
  ON user_page_visit_stats (last_visited_at DESC);

ALTER TABLE user_usage_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_page_visit_stats DISABLE ROW LEVEL SECURITY;
