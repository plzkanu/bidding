-- 관리자 등록 자동선별 키워드 (입찰공고 조회 필터용)
CREATE TABLE bid_notice_screening_keywords (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword    TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bid_notice_screening_keywords_keyword_lower
  ON bid_notice_screening_keywords (LOWER(keyword));

CREATE INDEX idx_bid_notice_screening_keywords_is_active
  ON bid_notice_screening_keywords (is_active);
