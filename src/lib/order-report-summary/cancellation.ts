const cancelledJobs = new Set<string>();

export function summaryJobKey(userId: string, noticeId: string): string {
  return `${userId}:${noticeId}`;
}

export function requestSummaryCancellation(userId: string, noticeId: string): void {
  cancelledJobs.add(summaryJobKey(userId, noticeId));
}

export function clearSummaryCancellation(userId: string, noticeId: string): void {
  cancelledJobs.delete(summaryJobKey(userId, noticeId));
}

export function isSummaryCancellationRequested(
  userId: string,
  noticeId: string,
): boolean {
  return cancelledJobs.has(summaryJobKey(userId, noticeId));
}
