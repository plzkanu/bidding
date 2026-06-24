import type { SummarizeAttachmentInput } from "@/lib/order-report-summary/summarize-input";

export type SummaryAttachmentCategory = "bid_notice" | "pq" | "excluded";

export interface CategorizedSummaryAttachments {
  /** 파일명에 「입찰공고문」 또는 「입찰안내서」 포함 → 1~4번 분석 */
  bidNotice: SummarizeAttachmentInput[];
  /** 파일명에 「PQ」 또는 「적격심사」 포함 → PQ 탭 분석 */
  pq: SummarizeAttachmentInput[];
  /** 위 조건에 해당하지 않음 */
  excluded: SummarizeAttachmentInput[];
  bidNoticeNames: string[];
  pqNames: string[];
  excludedNames: string[];
}

function normalizeAttachmentFileName(fileName: string): string {
  return fileName.replace(/[/\\]/g, "").trim();
}

const BID_NOTICE_ATTACHMENT_KEYWORDS = ["입찰공고문", "입찰안내서"] as const;

/** 1~4번: 파일명에 「입찰공고문」 또는 「입찰안내서」 포함 */
export function isBidNoticeSummaryAttachment(fileName: string): boolean {
  const base = normalizeAttachmentFileName(fileName);
  return BID_NOTICE_ATTACHMENT_KEYWORDS.some((keyword) =>
    base.includes(keyword),
  );
}

/** PQ 탭: 파일명에 「적격심사」 또는 「PQ」 포함 */
export function isPqSummaryAttachment(fileName: string): boolean {
  const base = normalizeAttachmentFileName(fileName);
  if (base.includes("적격심사")) {
    return true;
  }
  return /PQ/i.test(base);
}

export function classifySummaryAttachment(
  fileName: string,
): SummaryAttachmentCategory {
  const isBid = isBidNoticeSummaryAttachment(fileName);
  const isPq = isPqSummaryAttachment(fileName);

  if (isBid) {
    return "bid_notice";
  }
  if (isPq) {
    return "pq";
  }
  return "excluded";
}

export function categorizeSummaryAttachments(
  attachments: SummarizeAttachmentInput[],
): CategorizedSummaryAttachments {
  const bidNotice: SummarizeAttachmentInput[] = [];
  const pq: SummarizeAttachmentInput[] = [];
  const excluded: SummarizeAttachmentInput[] = [];

  for (const attachment of attachments) {
    const category = classifySummaryAttachment(attachment.fileName);
    if (category === "bid_notice") {
      bidNotice.push(attachment);
    } else if (category === "pq") {
      pq.push(attachment);
    } else {
      excluded.push(attachment);
    }
  }

  return {
    bidNotice,
    pq,
    excluded,
    bidNoticeNames: bidNotice.map((item) => item.fileName),
    pqNames: pq.map((item) => item.fileName),
    excludedNames: excluded.map((item) => item.fileName),
  };
}

export const SUMMARY_ATTACHMENT_FILTER_HINT =
  '파일명에 "입찰공고문" 또는 "입찰안내서"가 포함된 파일만 1~4번(입찰공고문)으로, "PQ" 또는 "적격심사"가 포함된 파일만 PQ 탭으로 분석합니다. 그 외 첨부는 요약하지 않습니다.';
