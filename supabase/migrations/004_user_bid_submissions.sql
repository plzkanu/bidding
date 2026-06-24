-- 사용자별 입찰 등록 (입찰하기)
CREATE TABLE user_bid_submissions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_bid_submissions_user_id ON user_bid_submissions(user_id);
CREATE INDEX idx_user_bid_submissions_notice_id ON user_bid_submissions(notice_id);
