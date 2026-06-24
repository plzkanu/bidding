-- 공고별 첨부파일 메타데이터 (실제 파일은 Storage 버킷에 저장)
CREATE TABLE bid_notice_attachments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    UUID NOT NULL REFERENCES khnp_bid_notice(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size    BIGINT NOT NULL DEFAULT 0,
  mime_type    TEXT,
  uploaded_by  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bid_notice_attachments_notice_id ON bid_notice_attachments(notice_id);

-- 비공개 Storage 버킷 (서버 service role로 업·다운로드)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bid-notice-attachments', 'bid-notice-attachments', false, 52428800)
ON CONFLICT (id) DO NOTHING;
