-- 발주요약 (Gemini + DOCX) 메타데이터
CREATE TABLE user_order_report_summaries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL,
  notice_id     UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'PROCESSING'
                CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  summary_json  JSONB,
  storage_path  TEXT,
  docx_file_name TEXT,
  error_message TEXT,
  model_version TEXT,
  generated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notice_id)
);

CREATE INDEX idx_user_order_report_summaries_user_id
  ON user_order_report_summaries(user_id);
CREATE INDEX idx_user_order_report_summaries_notice_id
  ON user_order_report_summaries(notice_id);

-- 생성 DOCX Storage (서버 service role 전용)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-report-summaries', 'order-report-summaries', false, 20971520)
ON CONFLICT (id) DO NOTHING;
