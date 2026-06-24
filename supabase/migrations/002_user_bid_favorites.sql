-- 사용자별 관심 입찰공고
CREATE TABLE user_bid_favorites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_bid_favorites_user_id ON user_bid_favorites(user_id);
CREATE INDEX idx_user_bid_favorites_notice_id ON user_bid_favorites(notice_id);
