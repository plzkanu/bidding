-- 사용자별 입찰공고 선별 상태 (대기 / 미대상 / 대상)
CREATE TABLE user_bid_notice_screening (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'WAITING'
             CHECK (status IN ('WAITING', 'EXCLUDED', 'TARGET')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_bid_notice_screening_user_id ON user_bid_notice_screening(user_id);
CREATE INDEX idx_user_bid_notice_screening_notice_id ON user_bid_notice_screening(notice_id);
