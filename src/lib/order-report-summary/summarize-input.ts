import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";

export interface SummarizeAttachmentInput {
  fileName: string;
  buffer: Buffer;
  mimeType: string | null;
}

export interface SummaryProgressContext {
  userId: string;
  noticeId: string;
}

export interface SummarizeOrderReportInput {
  notice: KhnpBidNoticeRow;
  attachments: SummarizeAttachmentInput[];
  progress?: SummaryProgressContext;
}
