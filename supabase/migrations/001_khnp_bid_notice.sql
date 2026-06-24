-- 한수원 KPOS 입찰공고 (참고용 — Supabase에 이미 적용된 경우 생략 가능)

CREATE TABLE khnp_bid_notice (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id          INT REFERENCES crawl_sites(id),
  notice_type      TEXT NOT NULL,
  notice_no        TEXT NOT NULL,
  origin_notice_no TEXT,
  notice_div       TEXT,
  title            TEXT NOT NULL,
  dept_name        TEXT,
  notice_date      TIMESTAMPTZ,
  notice_period_start DATE,
  notice_period_end   DATE,
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, notice_type, notice_no)
);

CREATE TABLE khnp_bid_open (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id     UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  status        TEXT,
  bid_method    TEXT,
  domestic_flag TEXT,
  purchase_type TEXT,
  bid_start_dt  TIMESTAMPTZ,
  bid_close_dt  TIMESTAMPTZ,
  award_method  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE khnp_bid_private (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  main_content TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE khnp_bid_plan_spec (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id  UUID REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
