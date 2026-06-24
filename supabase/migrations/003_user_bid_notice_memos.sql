-- 사용자별 입찰공고 메모
CREATE TABLE user_bid_notice_memos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  memo       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_bid_notice_memos_user_id ON user_bid_notice_memos(user_id);
CREATE INDEX idx_user_bid_notice_memos_notice_id ON user_bid_notice_memos(notice_id);
