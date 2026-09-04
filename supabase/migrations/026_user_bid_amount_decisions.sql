-- 사용자별 투찰금액 결정
CREATE TABLE IF NOT EXISTS user_bid_amount_decisions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT NOT NULL,
  notice_id    UUID NOT NULL,
  bid_amount   NUMERIC(18, 0),
  base_amount  NUMERIC(18, 0),
  award_rate   NUMERIC(10, 4),
  bid_rate     NUMERIC(10, 4),
  memo         TEXT,
  status       TEXT NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT', 'DECIDED')),
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bid_amount_decisions_user_id
  ON user_bid_amount_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_amount_decisions_notice_id
  ON user_bid_amount_decisions(notice_id);
CREATE INDEX IF NOT EXISTS idx_user_bid_amount_decisions_status
  ON user_bid_amount_decisions(user_id, status);

ALTER TABLE user_bid_amount_decisions DISABLE ROW LEVEL SECURITY;
