-- 개찰결과: 낙찰자 (우리 / 경쟁사)
ALTER TABLE bid_opening_results
  ADD COLUMN award_winner_type TEXT,
  ADD COLUMN award_winner_competitor_id UUID REFERENCES bid_competitors(id);

ALTER TABLE bid_opening_results
  ADD CONSTRAINT bid_opening_results_award_winner_type_check
  CHECK (award_winner_type IS NULL OR award_winner_type IN ('ours', 'competitor'));

ALTER TABLE bid_opening_results
  ADD CONSTRAINT bid_opening_results_award_winner_consistency_check
  CHECK (
    (award_winner_type IS NULL AND award_winner_competitor_id IS NULL)
    OR (award_winner_type = 'ours' AND award_winner_competitor_id IS NULL)
    OR (award_winner_type = 'competitor' AND award_winner_competitor_id IS NOT NULL)
  );

CREATE INDEX idx_bid_opening_results_award_winner_competitor_id
  ON bid_opening_results (award_winner_competitor_id);
