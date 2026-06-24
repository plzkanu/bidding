export type SummaryAttachmentProgressStatus =
  | "pending"
  | "loading"
  | "processing"
  | "done"
  | "skipped"
  | "failed";

export type SummaryGenerationProgressPhase =
  | "attachments"
  | "extract"
  | "llm"
  | "docx"
  | "completed"
  | "failed";

export interface SummaryAttachmentProgressItem {
  fileName: string;
  status: SummaryAttachmentProgressStatus;
  detail: string | null;
}

export interface SummaryGenerationProgress {
  phase: SummaryGenerationProgressPhase;
  attachments: SummaryAttachmentProgressItem[];
  updatedAt: string;
}

const progressByJob = new Map<string, SummaryGenerationProgress>();

function jobKey(userId: string, noticeId: string): string {
  return `${userId}:${noticeId}`;
}

export function initSummaryAttachmentProgress(
  userId: string,
  noticeId: string,
  fileNames: string[],
): void {
  progressByJob.set(jobKey(userId, noticeId), {
    phase: "attachments",
    attachments: fileNames.map((fileName) => ({
      fileName,
      status: "pending",
      detail: null,
    })),
    updatedAt: new Date().toISOString(),
  });
}

export function setSummaryProgressPhase(
  userId: string,
  noticeId: string,
  phase: SummaryGenerationProgressPhase,
): void {
  const key = jobKey(userId, noticeId);
  const current = progressByJob.get(key);
  if (!current) return;
  progressByJob.set(key, {
    ...current,
    phase,
    updatedAt: new Date().toISOString(),
  });
}

export function setSummaryAttachmentStatus(
  userId: string,
  noticeId: string,
  fileName: string,
  status: SummaryAttachmentProgressStatus,
  detail?: string | null,
): void {
  const key = jobKey(userId, noticeId);
  const current = progressByJob.get(key);
  if (!current) return;

  const attachments = current.attachments.map((item) =>
    item.fileName === fileName
      ? { ...item, status, detail: detail ?? null }
      : item,
  );

  progressByJob.set(key, {
    ...current,
    attachments,
    updatedAt: new Date().toISOString(),
  });
}

export function getSummaryAttachmentProgress(
  userId: string,
  noticeId: string,
): SummaryGenerationProgress | null {
  return progressByJob.get(jobKey(userId, noticeId)) ?? null;
}

export function clearSummaryAttachmentProgress(
  userId: string,
  noticeId: string,
): void {
  progressByJob.delete(jobKey(userId, noticeId));
}

export function finalizeSummaryAttachmentProgress(
  userId: string,
  noticeId: string,
  phase: "completed" | "failed",
): void {
  const key = jobKey(userId, noticeId);
  const current = progressByJob.get(key);
  if (!current) return;

  const attachments = current.attachments.map((item) => {
    if (item.status === "done" || item.status === "skipped" || item.status === "failed") {
      return item;
    }
    return {
      ...item,
      status: phase === "completed" ? ("done" as const) : ("failed" as const),
      detail: item.detail,
    };
  });

  progressByJob.set(key, {
    ...current,
    phase,
    attachments,
    updatedAt: new Date().toISOString(),
  });
}
