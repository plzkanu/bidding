-- 확정예가: 금액 → 비율(%) 저장
ALTER TABLE bid_opening_results
  ALTER COLUMN confirmed_estimated_price TYPE NUMERIC(10, 4)
  USING CASE
    WHEN confirmed_estimated_price IS NULL THEN NULL
    WHEN confirmed_estimated_price > 1000 THEN NULL
    ELSE confirmed_estimated_price
  END;
