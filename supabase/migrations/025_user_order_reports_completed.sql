-- 발주보고 완료 여부
ALTER TABLE user_order_reports
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_order_reports_is_completed
  ON user_order_reports(user_id, is_completed);
