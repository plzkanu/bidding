"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrderReportSummaryGuard } from "@/hooks/use-order-report-summary-guard";
import { BidNoticeAttachmentsPanel } from "@/components/bid-notice-attachments-panel";
import {
  OrderReportSummaryProgress,
  type OrderReportSummaryGenerationPhase,
} from "@/components/order-report-summary-progress";
import type { CrawlSite } from "@/lib/crawl-sites";
import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";
import { BID_NOTICE_TYPE_LABELS } from "@/lib/bid-notices/types";
import {
  ORDER_REPORT_SUMMARY_SECTIONS,
  ORDER_REPORT_SUMMARY_STATUS_LABELS,
  SUMMARY_CANCELLED_MESSAGE,
  type OrderReportSummaryStatus,
} from "@/lib/order-report-summary/sections";
import {
  ORDER_REPORT_SUMMARY_ENGINE_LABELS,
  type OrderReportSummaryEngine,
} from "@/lib/order-report-summary/engines";
import { OrderReportQualificationTable } from "@/components/order-report-qualification-table";
import { OrderReportOverviewSection } from "@/components/order-report-overview-section";
import { OrderReportScheduleFlow } from "@/components/order-report-schedule-flow";
import {
  buildSummaryPreviewSections,
  type SummaryPreviewSection,
} from "@/lib/order-report-summary/field-map";
import {
  EMPTY_SUMMARY_VALUE,
  type OrderReportSummaryRecord,
} from "@/lib/order-report-summary/types";
import { SUMMARY_ATTACHMENT_FILTER_HINT } from "@/lib/order-report-summary/attachment-filter";
import type { SummaryAttachmentProgressItem } from "@/lib/order-report-summary/summary-progress";
import {
  pqListLabelClassName,
  resolvePqListMeta,
} from "@/lib/order-report-summary/pq-status";
import {
  formatDateTime,
  formatDeptNameForList,
} from "@/lib/bid-notices/utils";

interface OrderReportSummaryViewProps {
  noticeId: string;
}

type SummaryPreviewTab = "bid_notice" | "pq";

function statusBadgeClass(status: OrderReportSummaryStatus) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "PROCESSING":
      return "border-[#009ada]/30 bg-[#009ada]/10 text-[#004b87]";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    case "PENDING":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

export function OrderReportSummaryView({ noticeId }: OrderReportSummaryViewProps) {
  const [notice, setNotice] = useState<KhnpBidNoticeRow | null>(null);
  const [siteName, setSiteName] = useState<string | undefined>();
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [summaryRecord, setSummaryRecord] =
    useState<OrderReportSummaryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] =
    useState<OrderReportSummaryGenerationPhase | null>(null);
  const [selectedEngine, setSelectedEngine] =
    useState<OrderReportSummaryEngine>("claude");
  const [availableEngines, setAvailableEngines] = useState<
    Array<{ id: OrderReportSummaryEngine; label: string; configured: boolean }>
  >([]);
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState<
    SummaryAttachmentProgressItem[] | null
  >(null);
  const [activeTab, setActiveTab] = useState<SummaryPreviewTab>("bid_notice");
  const generateAbortRef = useRef<AbortController | null>(null);
  const cancelledByUserRef = useRef(false);

  useOrderReportSummaryGuard(isGenerating);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [noticeRes, sitesRes, reportsRes, summaryRes, enginesRes] =
        await Promise.all([
          fetch(`/api/bid-notices/${encodeURIComponent(noticeId)}`),
          fetch("/api/crawl-sites"),
          fetch("/api/order-reports"),
          fetch(`/api/order-report-summaries/${encodeURIComponent(noticeId)}`),
          fetch("/api/order-report-summaries/engines"),
        ]);

      const noticeData = (await noticeRes.json()) as {
        notice?: KhnpBidNoticeRow;
        isOrderReported?: boolean;
        error?: string;
      };
      const sitesData = (await sitesRes.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      const reportsData = (await reportsRes.json()) as {
        reports?: Array<{ noticeId: string; submittedAt: string }>;
        error?: string;
      };
      const summaryData = (await summaryRes.json()) as {
        summary?: OrderReportSummaryRecord;
        error?: string;
      };
      const enginesData = (await enginesRes.json()) as {
        engines?: Array<{
          id: OrderReportSummaryEngine;
          label: string;
          configured: boolean;
        }>;
      };

      if (!noticeRes.ok) {
        throw new Error(noticeData.error ?? "공고 정보를 불러오지 못했습니다.");
      }
      if (!noticeData.notice) {
        throw new Error("공고를 찾을 수 없습니다.");
      }
      if (!noticeData.isOrderReported) {
        throw new Error("발주보고가 등록되지 않은 공고입니다.");
      }

      const report = (reportsData.reports ?? []).find(
        (item) => item.noticeId === noticeId,
      );
      const sites = (sitesData.sites ?? []).filter((s) => s.is_active !== false);
      const site = sites.find((s) => s.id === noticeData.notice!.site_id);

      setNotice(noticeData.notice);
      setSiteName(site?.site_name);
      setSubmittedAt(report?.submittedAt ?? null);
      setSummaryRecord(summaryData.summary ?? null);

      const engines = enginesData.engines ?? [];
      setAvailableEngines(engines);
      const defaultEngine =
        engines.find((engine) => engine.configured)?.id ?? "claude";
      setSelectedEngine(defaultEngine);

      if (!summaryRes.ok && summaryData.error) {
        setError(summaryData.error);
      }
    } catch (err) {
      setNotice(null);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    let cancelled = false;

    const pollProgress = async () => {
      try {
        const response = await fetch(
          `/api/order-report-summaries/${encodeURIComponent(noticeId)}/progress`,
        );
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as {
          progress?: { attachments: SummaryAttachmentProgressItem[] } | null;
        };
        if (data.progress?.attachments?.length) {
          setAttachmentProgress(data.progress.attachments);
        }
      } catch {
        // 폴링 실패는 무시
      }
    };

    void pollProgress();
    const intervalId = window.setInterval(pollProgress, 800);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isGenerating, noticeId]);

  async function handleCancel() {
    if (!isGenerating || isCancelling) return;

    setIsCancelling(true);
    cancelledByUserRef.current = true;
    generateAbortRef.current?.abort();

    try {
      const response = await fetch(
        `/api/order-report-summaries/${encodeURIComponent(noticeId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        summary?: OrderReportSummaryRecord;
        error?: string;
      };

      if (data.summary) {
        setSummaryRecord(data.summary);
      }

      setGenerationPhase("cancelled");
      setError(data.summary?.errorMessage ?? SUMMARY_CANCELLED_MESSAGE);
    } catch (err) {
      setGenerationPhase("cancelled");
      setError(
        err instanceof Error ? err.message : SUMMARY_CANCELLED_MESSAGE,
      );
    } finally {
      setIsGenerating(false);
      setIsCancelling(false);
      generateAbortRef.current = null;
    }
  }

  async function handleGenerate() {
    cancelledByUserRef.current = false;
    generateAbortRef.current = new AbortController();
    setIsGenerating(true);
    setGenerationPhase("running");
    setError("");

    try {
      const attachmentsRes = await fetch(
        `/api/bid-notices/${encodeURIComponent(noticeId)}/attachments`,
      );
      if (attachmentsRes.ok) {
        const attachmentsData = (await attachmentsRes.json()) as {
          attachments?: Array<{ fileName: string }>;
        };
        const names = attachmentsData.attachments ?? [];
        if (names.length > 1) {
          setAttachmentProgress(
            names.map((item) => ({
              fileName: item.fileName,
              status: "pending",
              detail: null,
            })),
          );
        } else {
          setAttachmentProgress(null);
        }
      }
    } catch {
      setAttachmentProgress(null);
    }
    setSummaryRecord((prev) =>
      prev
        ? { ...prev, status: "PROCESSING" as const }
        : {
            noticeId,
            status: "PROCESSING",
            summary: null,
            docxFileName: null,
            downloadUrl: null,
            errorMessage: null,
            modelVersion: null,
            generatedAt: null,
            updatedAt: null,
            pqHasPq: null,
            pqSubmissionDate: null,
            pqSummary: null,
            excludedFiles: [],
            bidNoticeSourceFiles: [],
            pqSourceFiles: [],
          },
    );
    let responseData: {
      summary?: OrderReportSummaryRecord;
      error?: string;
    } | null = null;

    try {
      const response = await fetch(
        `/api/order-report-summaries/${encodeURIComponent(noticeId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engine: selectedEngine }),
          signal: generateAbortRef.current.signal,
        },
      );
      responseData = (await response.json()) as {
        summary?: OrderReportSummaryRecord;
        error?: string;
      };

      if (cancelledByUserRef.current) {
        return;
      }

      if (responseData.summary) {
        setSummaryRecord(responseData.summary);
      }

      if (!response.ok) {
        const message =
          responseData.summary?.errorMessage ??
          responseData.error ??
          "발주요약 생성에 실패했습니다.";
        if (message === SUMMARY_CANCELLED_MESSAGE) {
          setGenerationPhase("cancelled");
        } else {
          setGenerationPhase("failed");
        }
        setError(message);
        return;
      }

      setError("");
      setGenerationPhase("completed");
      try {
        const progressRes = await fetch(
          `/api/order-report-summaries/${encodeURIComponent(noticeId)}/progress`,
        );
        if (progressRes.ok) {
          const progressData = (await progressRes.json()) as {
            progress?: { attachments: SummaryAttachmentProgressItem[] } | null;
          };
          if (progressData.progress?.attachments?.length) {
            setAttachmentProgress(progressData.progress.attachments);
          }
        }
      } catch {
        // 최종 현황 조회 실패는 무시
      }
    } catch (err) {
      if (cancelledByUserRef.current) {
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        setGenerationPhase("cancelled");
        setError(SUMMARY_CANCELLED_MESSAGE);
        return;
      }
      setGenerationPhase("failed");
      setError(
        err instanceof Error ? err.message : "발주요약 생성에 실패했습니다.",
      );
    } finally {
      if (!cancelledByUserRef.current) {
        setIsGenerating(false);
        generateAbortRef.current = null;
      }
    }
  }

  if (isLoading) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>
    );
  }

  if (error && !notice) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link
          href="/dashboard/order-report"
          className="mt-4 inline-block text-sm font-medium text-[#004b87] underline-offset-2 hover:underline"
        >
          발주보고 목록으로
        </Link>
      </div>
    );
  }

  if (!notice) {
    return null;
  }

  const status = summaryRecord?.status ?? "NOT_STARTED";
  const statusLabel = ORDER_REPORT_SUMMARY_STATUS_LABELS[status];
  const canDownload = status === "COMPLETED" && summaryRecord?.downloadUrl;
  const isBusy = isGenerating || status === "PROCESSING";
  const failureMessage = summaryRecord?.errorMessage ?? error;
  const previewSections = buildSummaryPreviewSections(summaryRecord?.summary ?? null, {
    keepAllSections: true,
  });
  const hasBidNoticeSummary =
    summaryRecord?.status === "COMPLETED" && summaryRecord.summary != null;
  const hasPqSummary = Boolean(summaryRecord?.pqSummary);
  const hasSummary = hasBidNoticeSummary || hasPqSummary;
  const showBidNoticePlaceholders = !hasBidNoticeSummary;
  const showPqPlaceholders = !hasPqSummary;
  const pqMeta = resolvePqListMeta({
    summaryStatus: status,
    pqHasPq: summaryRecord?.pqHasPq ?? null,
    pqSubmissionDate: summaryRecord?.pqSubmissionDate ?? null,
    summary: summaryRecord?.summary ?? null,
  });

  return (
    <div className="relative space-y-6">
      {isGenerating ? (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/25 backdrop-blur-[1px]"
          aria-hidden
        />
      ) : null}

      <div className={`relative space-y-6 ${isGenerating ? "z-[101]" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        {isGenerating ? (
          <span className="text-sm text-slate-400">← 발주보고 목록</span>
        ) : (
          <Link
            href="/dashboard/order-report"
            className="text-sm text-slate-500 hover:text-[#004b87]"
          >
            ← 발주보고 목록
          </Link>
        )}
      </div>

      {failureMessage ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {failureMessage}
        </p>
      ) : null}

      <OrderReportSummaryProgress
        phase={generationPhase}
        attachmentProgress={attachmentProgress}
        onCancel={handleCancel}
        isCancelling={isCancelling}
      />

      <section
        className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${
          isGenerating ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              발주요약
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#004b87]">{notice.title}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-slate-500">공고번호</dt>
                <dd className="font-medium text-slate-800">{notice.notice_no}</dd>
              </div>
              <div>
                <dt className="text-slate-500">공고유형</dt>
                <dd className="text-slate-800">
                  {BID_NOTICE_TYPE_LABELS[notice.notice_type]}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">부서</dt>
                <dd className="text-slate-800">
                  {formatDeptNameForList(notice.dept_name)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">사이트</dt>
                <dd className="text-slate-800">{siteName ?? "-"}</dd>
              </div>
              {submittedAt ? (
                <div>
                  <dt className="text-slate-500">발주 등록일</dt>
                  <dd className="text-slate-800">{formatDateTime(submittedAt)}</dd>
                </div>
              ) : null}
              {summaryRecord?.generatedAt ? (
                <div>
                  <dt className="text-slate-500">요약 생성일</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(summaryRecord.generatedAt)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">PQ유무</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${pqListLabelClassName(pqMeta.pqLabel)}`}
                  >
                    {pqMeta.pqLabel}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
          >
            {isGenerating ? "생성 중…" : statusLabel}
          </span>
        </div>

        <div
          data-summary-guard-allow
          className="mt-6 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-6"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">요약 엔진</span>
            <select
              value={selectedEngine}
              onChange={(event) =>
                setSelectedEngine(event.target.value as OrderReportSummaryEngine)
              }
              disabled={isBusy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-40"
            >
              {(availableEngines.length > 0
                ? availableEngines
                : (
                    Object.entries(ORDER_REPORT_SUMMARY_ENGINE_LABELS) as Array<
                      [OrderReportSummaryEngine, string]
                    >
                  ).map(([id, label]) => ({ id, label, configured: true }))
              ).map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.label}
                  {!engine.configured ? " (미설정)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              isBusy ||
              (availableEngines.length > 0 &&
                !availableEngines.find((engine) => engine.id === selectedEngine)
                  ?.configured)
            }
            className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-medium text-white hover:bg-[#003a66] disabled:opacity-40"
          >
            {isBusy
              ? "요약 생성 중…"
              : status === "COMPLETED"
                ? "재생성"
                : "요약 생성"}
          </button>
          {canDownload ? (
            <a
              href={summaryRecord.downloadUrl!}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              DOCX 다운로드
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400"
            >
              DOCX 다운로드
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {SUMMARY_ATTACHMENT_FILTER_HINT}
          {summaryRecord?.modelVersion
            ? ` (모델: ${summaryRecord.modelVersion})`
            : null}
        </p>
      </section>

      <section
        className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${
          isGenerating ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <h3 className="text-sm font-semibold text-slate-800">첨부파일</h3>
        <p className="mt-1 text-xs text-slate-500">
          {SUMMARY_ATTACHMENT_FILTER_HINT}
        </p>
        {(summaryRecord?.bidNoticeSourceFiles?.length ?? 0) > 0 ? (
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">입찰공고문·입찰안내서:</span>{" "}
            {summaryRecord!.bidNoticeSourceFiles.join(", ")}
          </p>
        ) : null}
        {(summaryRecord?.pqSourceFiles?.length ?? 0) > 0 ? (
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-medium text-slate-700">PQ·적격심사:</span>{" "}
            {summaryRecord!.pqSourceFiles.join(", ")}
          </p>
        ) : null}
        {(summaryRecord?.excludedFiles?.length ?? 0) > 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            <span className="font-medium">분석 제외:</span>{" "}
            {summaryRecord!.excludedFiles.join(", ")}
          </p>
        ) : null}
        <div className="mt-4">
          <BidNoticeAttachmentsPanel noticeId={noticeId} />
        </div>
      </section>

      <section
        className={`space-y-4 transition-opacity ${
          isGenerating ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-800">요약 미리보기</h3>
          <p className="mt-1 text-xs text-slate-500">
            {hasSummary
              ? "탭별로 추출·요약된 내용을 표시합니다."
              : "요약 생성 후 탭별 내용이 표시됩니다."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("bid_notice")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "bid_notice"
                  ? "bg-[#004b87] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              입찰공고문
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pq")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "pq"
                  ? "bg-[#004b87] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              PQ 또는 적격심사
            </button>
          </div>
        </div>

        {activeTab === "pq" ? (
          hasPqSummary && summaryRecord?.pqSummary ? (
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <header>
                <h4 className="font-semibold text-[#004b87]">PQ 또는 적격심사 요약</h4>
                {summaryRecord.pqSummary.분석파일.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    분석 파일: {summaryRecord.pqSummary.분석파일.join(", ")}
                  </p>
                ) : null}
              </header>
              {summaryRecord.pqSummary.요약 !== EMPTY_SUMMARY_VALUE ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {summaryRecord.pqSummary.요약}
                </p>
              ) : null}
              {summaryRecord.pqSummary.항목.length > 0 ? (
                <div className="mt-6 space-y-5">
                  {summaryRecord.pqSummary.항목.map((section, index) => (
                    <div key={`${section.제목}-${index}`}>
                      <h5 className="text-sm font-semibold text-[#004b87]">
                        {section.제목}
                      </h5>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                        {section.내용}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-400">
              {showPqPlaceholders
                ? "요약 생성 후 PQ·적격심사 내용이 표시됩니다"
                : "PQ·적격심사 분석 대상 파일이 없거나 추출된 내용이 없습니다."}
            </p>
          )
        ) : (
          <>
            {(summaryRecord?.bidNoticeSourceFiles?.length ?? 0) > 0 ? (
              <p className="text-xs text-slate-500">
                분석 파일: {summaryRecord!.bidNoticeSourceFiles.join(", ")}
              </p>
            ) : null}
          <div className="space-y-6">
            {(showBidNoticePlaceholders
              ? ORDER_REPORT_SUMMARY_SECTIONS.map(
                  (section): SummaryPreviewSection => ({
                    id: section.id,
                    title: section.title,
                    description: section.description,
                    rows: [],
                  }),
                )
              : previewSections
            ).map((section) => (
              <article
                key={section.id}
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  hasBidNoticeSummary ? "border-slate-200" : "border-dashed border-slate-200"
                }`}
              >
                <header>
                  <h4 className="font-semibold text-[#2E74B5]">{section.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                </header>
                {section.id === "project_name" ? (
                  <p className="mt-4 text-lg font-bold text-slate-900">
                    {section.projectName ||
                      (showBidNoticePlaceholders
                        ? "요약 생성 후 표시됩니다"
                        : "미기재")}
                  </p>
                ) : section.id === "overview" ? (
                  section.rows.length > 0 ||
                  (section.subTables?.length ?? 0) > 0 ||
                  section.footnotes ? (
                    <OrderReportOverviewSection
                      rows={section.rows}
                      subTables={section.subTables}
                      footnotes={section.footnotes}
                    />
                  ) : (
                    <p className="mt-4 text-sm text-slate-300">
                      {showBidNoticePlaceholders
                        ? "요약 생성 후 표시됩니다"
                        : hasBidNoticeSummary
                          ? "미기재"
                          : "파일명에 「입찰공고문」 또는 「입찰안내서」가 포함된 첨부가 없어 분석되지 않았습니다."}
                    </p>
                  )
                ) : section.id === "schedule" ? (
                  <OrderReportScheduleFlow
                    steps={
                      section.scheduleSteps ?? summaryRecord?.summary?.주요일정
                    }
                    placeholder={showBidNoticePlaceholders}
                  />
                ) : section.id === "qualification" && section.rows.length > 0 ? (
                  <OrderReportQualificationTable rows={section.rows} />
                ) : section.rows.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {section.rows.map((row, index) => (
                      <li
                        key={`${section.id}-${row.label}-${index}`}
                        className="flex gap-3 border-b border-slate-50 pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <span className="w-28 shrink-0 text-slate-500">
                          {row.label}
                        </span>
                        <span className="whitespace-pre-wrap text-slate-800">
                          {row.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-300">
                    {showBidNoticePlaceholders
                      ? "요약 생성 후 표시됩니다"
                      : hasBidNoticeSummary
                        ? "미기재"
                        : "파일명에 「입찰공고문」 또는 「입찰안내서」가 포함된 첨부가 없어 분석되지 않았습니다."}
                  </p>
                )}
              </article>
            ))}
          </div>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
