-- 우리 회사 투찰금액·투찰율
ALTER TABLE bid_opening_results
  ADD COLUMN our_bid_amount NUMERIC(18, 0),
  ADD COLUMN our_bid_rate NUMERIC(10, 4);
