import type { KhnpBidNoticeRow } from "./types";
import { listUserEstimateSubmissions } from "./estimates";
import { listUserOrderReports } from "./order-reports";
import { listUserBidSubmissions } from "./submissions";

export type WorkResultKind = "ORDER_REPORT" | "BID" | "ESTIMATE";

export const WORK_RESULT_KIND_LABELS: Record<WorkResultKind, string> = {
  ORDER_REPORT: "발주",
  BID: "입찰",
  ESTIMATE: "견적",
};

export interface WorkResult {
  id: string;
  kind: WorkResultKind;
  noticeId: string;
  submittedAt: string;
  siteId: number;
  notice: KhnpBidNoticeRow;
}

export async function listWorkResults(
  userId: string,
): Promise<{ results: WorkResult[]; error: string | null }> {
  const [orderReports, bids, estimates] = await Promise.all([
    listUserOrderReports(userId),
    listUserBidSubmissions(userId),
    listUserEstimateSubmissions(userId),
  ]);

  if (orderReports.error) {
    return { results: [], error: orderReports.error };
  }
  if (bids.error) {
    return { results: [], error: bids.error };
  }
  if (estimates.error) {
    return { results: [], error: estimates.error };
  }

  const results: WorkResult[] = [
    ...orderReports.reports.map((report) => ({
      id: report.id,
      kind: "ORDER_REPORT" as const,
      noticeId: report.noticeId,
      submittedAt: report.submittedAt,
      siteId: report.siteId,
      notice: report.notice,
    })),
    ...bids.submissions.map((submission) => ({
      id: submission.id,
      kind: "BID" as const,
      noticeId: submission.noticeId,
      submittedAt: submission.submittedAt,
      siteId: submission.siteId,
      notice: submission.notice,
    })),
    ...estimates.submissions.map((submission) => ({
      id: submission.id,
      kind: "ESTIMATE" as const,
      noticeId: submission.noticeId,
      submittedAt: submission.submittedAt,
      siteId: submission.siteId,
      notice: submission.notice,
    })),
  ].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  return { results, error: null };
}
