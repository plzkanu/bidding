import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getNoticeAttachmentFile,
  listNoticeAttachments,
} from "@/lib/bid-notices/attachments";
import { isNoticeOrderReported } from "@/lib/bid-notices/order-reports";
import { getKhnpBidNoticeById } from "@/lib/bid-notices/khnp";
import type { OrderReportSummaryEngine } from "@/lib/order-report-summary/engines";
import {
  categorizeSummaryAttachments,
  SUMMARY_ATTACHMENT_FILTER_HINT,
} from "@/lib/order-report-summary/attachment-filter";
import {
  getEngineConfigError,
  summarizeOrderReport,
  summarizePqOrderReport,
} from "@/lib/order-report-summary/summarize";
import {
  buildOrderReportSummaryDocx,
  buildOrderReportSummaryDocxFileName,
} from "@/lib/order-report-summary/docx";
import {
  SUMMARY_CANCELLED_MESSAGE,
  type OrderReportSummaryStatus,
} from "@/lib/order-report-summary/sections";
import {
  extractPqFromSummary,
  resolvePqListMeta,
  type OrderReportPqListMeta,
} from "@/lib/order-report-summary/pq-status";
import {
  clearSummaryCancellation,
  isSummaryCancellationRequested,
  requestSummaryCancellation,
} from "@/lib/order-report-summary/cancellation";
import {
  finalizeSummaryAttachmentProgress,
  initSummaryAttachmentProgress,
  setSummaryAttachmentStatus,
  setSummaryProgressPhase,
} from "@/lib/order-report-summary/summary-progress";
import {
  buildOrderReportSummaryBundle,
  parseOrderReportSummaryBundle,
  type OrderReportPqAutoSummary,
  type OrderReportSummaryData,
  type OrderReportSummaryRecord,
} from "@/lib/order-report-summary/types";

export const SUMMARIES_BUCKET = "order-report-summaries";

export const SUMMARIES_TABLE_SETUP_MESSAGE =
  "발주요약을 사용할 수 없습니다. Supabase에 user_order_report_summaries 테이블이 필요합니다. supabase/migrations/009_user_order_report_summaries.sql을 적용해 주세요.";

export const SUMMARIES_STORAGE_SETUP_MESSAGE =
  "발주요약 Storage 버킷(order-report-summaries)이 없습니다. supabase/migrations/009_user_order_report_summaries.sql을 적용해 주세요.";

function isMissingSummariesTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_order_report_summaries") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

function isMissingSummariesBucketError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("order-report-summaries") ||
    message.includes("Bucket not found")
  );
}

export function normalizeSummariesError(message: string | undefined): string {
  if (isMissingSummariesTableError(message)) {
    return SUMMARIES_TABLE_SETUP_MESSAGE;
  }
  if (isMissingSummariesBucketError(message)) {
    return SUMMARIES_STORAGE_SETUP_MESSAGE;
  }
  const trimmed = message?.trim();
  if (trimmed?.includes("100 PDF pages")) {
    return "첨부 PDF 페이지가 Claude API 한도(요청당 100페이지)를 초과했습니다. 첨부파일 수를 줄이거나 핵심 문서만 남겨 다시 시도해 주세요.";
  }
  return trimmed || "발주요약 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 발주요약을 사용할 수 없습니다.";
  }
  return null;
}

export function buildSummaryDownloadPath(noticeId: string): string {
  return `/api/order-report-summaries/${encodeURIComponent(noticeId)}/download`;
}

function buildStoragePath(userId: string, noticeId: string): string {
  return `${userId}/${noticeId}/summary.docx`;
}

function mapDbStatus(status: string | null | undefined): OrderReportSummaryStatus {
  switch (status) {
    case "PROCESSING":
      return "PROCESSING";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    default:
      return "NOT_STARTED";
  }
}

function mapSummaryRow(
  noticeId: string,
  row: {
    status: string;
    summary_json: unknown;
    docx_file_name: string | null;
    error_message: string | null;
    model_version: string | null;
    generated_at: string | null;
    updated_at: string | null;
    pq_has_pq?: boolean | null;
    pq_submission_date?: string | null;
  } | null,
): OrderReportSummaryRecord {
  if (!row) {
    return {
      noticeId,
      status: "NOT_STARTED",
      summary: null,
      pqSummary: null,
      excludedFiles: [],
      bidNoticeSourceFiles: [],
      pqSourceFiles: [],
      docxFileName: null,
      downloadUrl: null,
      errorMessage: null,
      modelVersion: null,
      generatedAt: null,
      updatedAt: null,
      pqHasPq: null,
      pqSubmissionDate: null,
    };
  }

  const status = mapDbStatus(row.status);
  const completed = status === "COMPLETED";
  const bundle = row.summary_json
    ? parseOrderReportSummaryBundle(row.summary_json)
    : null;

  return {
    noticeId,
    status,
    summary: bundle?.입찰공고문 ?? null,
    pqSummary: bundle?.pq적격심사 ?? null,
    excludedFiles: bundle?.분석제외 ?? [],
    bidNoticeSourceFiles: bundle?.입찰공고문분석파일 ?? [],
    pqSourceFiles: bundle?.pq분석파일 ?? [],
    docxFileName: row.docx_file_name,
    downloadUrl: completed ? buildSummaryDownloadPath(noticeId) : null,
    errorMessage: row.error_message,
    modelVersion: row.model_version,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    pqHasPq: (row.pq_has_pq as boolean | null | undefined) ?? null,
    pqSubmissionDate: (row.pq_submission_date as string | null | undefined) ?? null,
  };
}

export async function getOrderReportSummary(
  userId: string,
  noticeId: string,
): Promise<{ summary: OrderReportSummaryRecord; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return {
      summary: mapSummaryRow(noticeId, null),
      error: configError,
    };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_order_report_summaries")
      .select(
        "status, summary_json, docx_file_name, error_message, model_version, generated_at, updated_at, pq_has_pq, pq_submission_date",
      )
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return {
        summary: mapSummaryRow(noticeId, null),
        error: normalizeSummariesError(error.message),
      };
    }

    return { summary: mapSummaryRow(noticeId, data), error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발주요약 조회에 실패했습니다.";
    return {
      summary: mapSummaryRow(noticeId, null),
      error: normalizeSummariesError(message),
    };
  }
}

function assertSummaryNotCancelled(userId: string, noticeId: string): void {
  if (isSummaryCancellationRequested(userId, noticeId)) {
    throw new Error(SUMMARY_CANCELLED_MESSAGE);
  }
}

export async function cancelOrderReportSummary(
  userId: string,
  noticeId: string,
): Promise<{ summary: OrderReportSummaryRecord; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { summary: mapSummaryRow(noticeId, null), error: configError };
  }

  requestSummaryCancellation(userId, noticeId);

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("user_order_report_summaries").upsert(
      {
        user_id: userId,
        notice_id: noticeId,
        status: "FAILED",
        error_message: SUMMARY_CANCELLED_MESSAGE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notice_id" },
    );

    if (error) {
      return {
        summary: mapSummaryRow(noticeId, null),
        error: normalizeSummariesError(error.message),
      };
    }

    const { summary } = await getOrderReportSummary(userId, noticeId);
    return { summary, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요약 취소 처리에 실패했습니다.";
    return {
      summary: mapSummaryRow(noticeId, null),
      error: normalizeSummariesError(message),
    };
  }
}

export async function generateOrderReportSummary(
  userId: string,
  noticeId: string,
  engine: OrderReportSummaryEngine = "claude",
): Promise<{
  summary: OrderReportSummaryRecord;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { summary: mapSummaryRow(noticeId, null), error: configError };
  }

  const engineError = getEngineConfigError(engine);
  if (engineError) {
    return { summary: mapSummaryRow(noticeId, null), error: engineError };
  }

  const { isOrderReported, error: reportError } = await isNoticeOrderReported(
    userId,
    noticeId,
  );
  if (reportError) {
    return { summary: mapSummaryRow(noticeId, null), error: reportError };
  }
  if (!isOrderReported) {
    return {
      summary: mapSummaryRow(noticeId, null),
      error: "발주보고가 등록되지 않은 공고입니다.",
    };
  }

  const { notice, error: noticeError } = await getKhnpBidNoticeById(noticeId);
  if (noticeError) {
    return { summary: mapSummaryRow(noticeId, null), error: noticeError };
  }
  if (!notice) {
    return {
      summary: mapSummaryRow(noticeId, null),
      error: "공고를 찾을 수 없습니다.",
    };
  }

  const supabase = createServerClient();
  const storagePath = buildStoragePath(userId, noticeId);
  const now = new Date().toISOString();

  const markProcessing = async () => {
    const { error } = await supabase.from("user_order_report_summaries").upsert(
      {
        user_id: userId,
        notice_id: noticeId,
        status: "PROCESSING",
        error_message: null,
        updated_at: now,
      },
      { onConflict: "user_id,notice_id" },
    );
    if (error) {
      throw new Error(normalizeSummariesError(error.message));
    }
  };

  const markFailed = async (message: string) => {
    await supabase.from("user_order_report_summaries").upsert(
      {
        user_id: userId,
        notice_id: noticeId,
        status: "FAILED",
        error_message: message,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notice_id" },
    );
  };

  clearSummaryCancellation(userId, noticeId);

  try {
    await markProcessing();
    assertSummaryNotCancelled(userId, noticeId);

    const { attachments, error: attachmentsError } =
      await listNoticeAttachments(noticeId);
    if (attachmentsError) {
      throw new Error(attachmentsError);
    }
    if (attachments.length === 0) {
      throw new Error("첨부파일이 없습니다. 공고 상세에서 첨부파일을 등록해 주세요.");
    }

    initSummaryAttachmentProgress(
      userId,
      noticeId,
      attachments.map((item) => item.fileName),
    );
    setSummaryProgressPhase(userId, noticeId, "attachments");

    const attachmentInputs = [];
    for (const attachment of attachments) {
      setSummaryAttachmentStatus(
        userId,
        noticeId,
        attachment.fileName,
        "loading",
      );
      const { file, buffer, error } = await getNoticeAttachmentFile(
        noticeId,
        attachment.id,
      );
      if (error || !file || !buffer) {
        const failMessage =
          error ?? `${attachment.fileName} 다운로드에 실패했습니다.`;
        setSummaryAttachmentStatus(
          userId,
          noticeId,
          attachment.fileName,
          "failed",
          failMessage,
        );
        throw new Error(failMessage);
      }
      attachmentInputs.push({
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      });
    }

    const categorized = categorizeSummaryAttachments(attachmentInputs);

    for (const excluded of categorized.excluded) {
      setSummaryAttachmentStatus(
        userId,
        noticeId,
        excluded.fileName,
        "skipped",
        "분석 대상 아님",
      );
    }

    if (categorized.bidNotice.length === 0 && categorized.pq.length === 0) {
      throw new Error(
        `분석 대상 첨부파일이 없습니다. ${SUMMARY_ATTACHMENT_FILTER_HINT}`,
      );
    }

    for (const item of categorized.bidNotice) {
      setSummaryAttachmentStatus(
        userId,
        noticeId,
        item.fileName,
        "processing",
        "입찰공고문·입찰안내서 분석",
      );
    }

    for (const item of categorized.pq) {
      setSummaryAttachmentStatus(
        userId,
        noticeId,
        item.fileName,
        "processing",
        "PQ·적격심사 분석",
      );
    }

    assertSummaryNotCancelled(userId, noticeId);

    const models: string[] = [];
    let bidNoticeSummary: OrderReportSummaryData | null = null;
    let pqSummary: OrderReportPqAutoSummary | null = null;

    if (categorized.bidNotice.length > 0) {
      const { summary, model } = await summarizeOrderReport(engine, {
        notice,
        attachments: categorized.bidNotice,
        progress: { userId, noticeId },
      });
      bidNoticeSummary = summary;
      models.push(model);
      assertSummaryNotCancelled(userId, noticeId);
    }

    if (categorized.pq.length > 0) {
      const { summary, model } = await summarizePqOrderReport(engine, {
        notice,
        attachments: categorized.pq,
        progress: { userId, noticeId },
      });
      pqSummary = summary;
      models.push(model);
      assertSummaryNotCancelled(userId, noticeId);
    }

    const summaryBundle = buildOrderReportSummaryBundle({
      bidNotice: bidNoticeSummary,
      pq: pqSummary,
      excluded: categorized.excludedNames,
      bidNoticeSourceFiles: categorized.bidNoticeNames,
      pqSourceFiles: categorized.pqNames,
    });

    setSummaryProgressPhase(userId, noticeId, "docx");

    const generatedAt = new Date();
    const docxFileName = buildOrderReportSummaryDocxFileName(notice);
    const docxBuffer = await buildOrderReportSummaryDocx(
      notice,
      bidNoticeSummary,
      generatedAt,
      {
        pqSummary,
        bidNoticeSourceFiles: categorized.bidNoticeNames,
        pqSourceFiles: categorized.pqNames,
      },
    );

    const { error: uploadError } = await supabase.storage
      .from(SUMMARIES_BUCKET)
      .upload(storagePath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(normalizeSummariesError(uploadError.message));
    }

    const generatedAtIso = generatedAt.toISOString();
    const pqResult = bidNoticeSummary
      ? extractPqFromSummary(bidNoticeSummary)
      : { hasPq: pqSummary != null, submissionDate: null };
    const { error: saveError } = await supabase
      .from("user_order_report_summaries")
      .upsert(
        {
          user_id: userId,
          notice_id: noticeId,
          status: "COMPLETED",
          summary_json: summaryBundle,
          storage_path: storagePath,
          docx_file_name: docxFileName,
          error_message: null,
          model_version: models.join(", "),
          generated_at: generatedAtIso,
          updated_at: generatedAtIso,
          pq_has_pq: pqResult.hasPq,
          pq_submission_date: pqResult.submissionDate,
        },
        { onConflict: "user_id,notice_id" },
      );

    if (saveError) {
      throw new Error(normalizeSummariesError(saveError.message));
    }

    finalizeSummaryAttachmentProgress(userId, noticeId, "completed");
    clearSummaryCancellation(userId, noticeId);
    const { summary: record } = await getOrderReportSummary(userId, noticeId);
    return { summary: record, error: null };
  } catch (err) {
    const rawMessage =
      err instanceof Error ? err.message : "발주요약 생성에 실패했습니다.";
    const message = normalizeSummariesError(rawMessage);
    if (
      rawMessage === SUMMARY_CANCELLED_MESSAGE ||
      isSummaryCancellationRequested(userId, noticeId)
    ) {
      await markFailed(SUMMARY_CANCELLED_MESSAGE);
    } else {
      await markFailed(message);
    }
    finalizeSummaryAttachmentProgress(userId, noticeId, "failed");
    clearSummaryCancellation(userId, noticeId);
    const { summary: record } = await getOrderReportSummary(userId, noticeId);
    return { summary: record, error: message };
  }
}

export async function getOrderReportSummaryDocx(
  userId: string,
  noticeId: string,
): Promise<{
  fileName: string | null;
  buffer: Buffer | null;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { fileName: null, buffer: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_order_report_summaries")
      .select("status, storage_path, docx_file_name")
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return {
        fileName: null,
        buffer: null,
        error: normalizeSummariesError(error.message),
      };
    }

    if (!data || data.status !== "COMPLETED" || !data.storage_path) {
      return {
        fileName: null,
        buffer: null,
        error: "다운로드할 발주요약 DOCX가 없습니다. 먼저 요약을 생성해 주세요.",
      };
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(SUMMARIES_BUCKET)
      .download(data.storage_path as string);

    if (downloadError || !blob) {
      return {
        fileName: null,
        buffer: null,
        error: normalizeSummariesError(downloadError?.message),
      };
    }

    return {
      fileName: (data.docx_file_name as string) || "발주요약.docx",
      buffer: Buffer.from(await blob.arrayBuffer()),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "DOCX 다운로드에 실패했습니다.";
    return { fileName: null, buffer: null, error: normalizeSummariesError(message) };
  }
}

export async function getSummaryStatusByNoticeIds(
  userId: string,
  noticeIds: string[],
): Promise<{ statuses: Record<string, OrderReportSummaryStatus>; error: string | null }> {
  const { meta, error } = await getOrderReportListMetaByNoticeIds(userId, noticeIds);
  if (error) {
    return { statuses: {}, error };
  }

  const statuses: Record<string, OrderReportSummaryStatus> = {};
  for (const [noticeId, item] of Object.entries(meta)) {
    statuses[noticeId] = item.summaryStatus;
  }
  return { statuses, error: null };
}

export async function getOrderReportListMetaByNoticeIds(
  userId: string,
  noticeIds: string[],
): Promise<{
  meta: Record<string, OrderReportPqListMeta>;
  error: string | null;
}> {
  if (noticeIds.length === 0) {
    return { meta: {}, error: null };
  }

  const configError = supabaseNotReadyError();
  if (configError) {
    return { meta: {}, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_order_report_summaries")
      .select(
        "notice_id, status, summary_json, pq_has_pq, pq_submission_date",
      )
      .eq("user_id", userId)
      .in("notice_id", noticeIds);

    if (error) {
      return { meta: {}, error: normalizeSummariesError(error.message) };
    }

    const rowByNoticeId = new Map(
      (data ?? []).map((row) => [row.notice_id as string, row]),
    );

    const meta: Record<string, OrderReportPqListMeta> = {};
    for (const noticeId of noticeIds) {
      const row = rowByNoticeId.get(noticeId);
      if (!row) {
        meta[noticeId] = resolvePqListMeta({ summaryStatus: "NOT_STARTED" });
        continue;
      }

      const summaryStatus = mapDbStatus(row.status as string);
      const bundle = row.summary_json
        ? parseOrderReportSummaryBundle(row.summary_json)
        : null;

      meta[noticeId] = resolvePqListMeta({
        summaryStatus,
        pqHasPq: (row.pq_has_pq as boolean | null | undefined) ?? null,
        pqSubmissionDate:
          (row.pq_submission_date as string | null | undefined) ?? null,
        summary: bundle?.입찰공고문 ?? null,
      });
    }

    return { meta, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요약 상태 조회에 실패했습니다.";
    return { meta: {}, error: normalizeSummariesError(message) };
  }
}
