-- 사용자별 발주보고 등록
CREATE TABLE user_order_reports (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL,
  notice_id  UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_order_reports_user_id ON user_order_reports(user_id);
CREATE INDEX idx_user_order_reports_notice_id ON user_order_reports(notice_id);
