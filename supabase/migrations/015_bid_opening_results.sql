-- 개찰결과 조회: 구분(카테고리) 마스터
CREATE TABLE bid_opening_categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bid_opening_categories_name_lower
  ON bid_opening_categories (LOWER(name));

CREATE INDEX idx_bid_opening_categories_is_active
  ON bid_opening_categories (is_active);

-- 경쟁사 마스터
CREATE TABLE bid_competitors (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bid_competitors_name_lower
  ON bid_competitors (LOWER(name));

CREATE INDEX idx_bid_competitors_is_active
  ON bid_competitors (is_active);

-- 개찰결과 (공고 단위)
CREATE TABLE bid_opening_results (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id               UUID NOT NULL REFERENCES bid_opening_categories(id),
  notice_no                 TEXT NOT NULL,
  bid_name                  TEXT NOT NULL,
  bid_date                  DATE,
  base_amount               NUMERIC(18, 0),
  estimated_price           NUMERIC(18, 0),
  award_rate                NUMERIC(10, 4),
  confirmed_estimated_price NUMERIC(18, 0),
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bid_opening_results_category_id
  ON bid_opening_results (category_id);

CREATE INDEX idx_bid_opening_results_bid_date
  ON bid_opening_results (bid_date DESC);

CREATE INDEX idx_bid_opening_results_notice_no
  ON bid_opening_results (notice_no);

-- 공고별 경쟁사 투찰 (공고마다 참여 업체가 다름)
CREATE TABLE bid_opening_result_bids (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id      UUID NOT NULL REFERENCES bid_opening_results(id) ON DELETE CASCADE,
  competitor_id  UUID NOT NULL REFERENCES bid_competitors(id),
  bid_amount     NUMERIC(18, 0),
  bid_rate       NUMERIC(10, 4),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (result_id, competitor_id)
);

CREATE INDEX idx_bid_opening_result_bids_result_id
  ON bid_opening_result_bids (result_id);

CREATE INDEX idx_bid_opening_result_bids_competitor_id
  ON bid_opening_result_bids (competitor_id);
