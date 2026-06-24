-- 발주요약 분석 결과: PQ 유무 및 PQ 제출일
ALTER TABLE user_order_report_summaries
  ADD COLUMN IF NOT EXISTS pq_has_pq BOOLEAN,
  ADD COLUMN IF NOT EXISTS pq_submission_date TEXT;

CREATE INDEX IF NOT EXISTS idx_user_order_report_summaries_pq_has_pq
  ON user_order_report_summaries(pq_has_pq);


