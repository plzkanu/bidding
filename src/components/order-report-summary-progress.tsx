"use client";

import { useEffect, useState } from "react";
import type { SummaryAttachmentProgressItem } from "@/lib/order-report-summary/summary-progress";

const GENERATION_STEPS = [
  { id: "attachments", label: "첨부파일 불러오기", from: 0, to: 18 },
  { id: "extract", label: "문서 변환 및 텍스트 추출", from: 18, to: 38 },
  { id: "llm", label: "AI 요약 분석", from: 38, to: 82 },
  { id: "docx", label: "DOCX 생성 및 저장", from: 82, to: 96 },
] as const;

export type OrderReportSummaryGenerationPhase =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}초`;
  return `${mins}분 ${secs}초`;
}

function getActiveStepIndex(progress: number): number {
  for (let i = GENERATION_STEPS.length - 1; i >= 0; i -= 1) {
    if (progress >= GENERATION_STEPS[i].from) return i;
  }
  return 0;
}

const ATTACHMENT_STATUS_LABELS: Record<
  SummaryAttachmentProgressItem["status"],
  string
> = {
  pending: "대기",
  loading: "불러오는 중",
  processing: "분석 중",
  done: "완료",
  skipped: "제외",
  failed: "실패",
};

function attachmentStatusClass(
  status: SummaryAttachmentProgressItem["status"],
): string {
  switch (status) {
    case "done":
      return "text-emerald-700";
    case "loading":
    case "processing":
      return "text-[#004b87] font-medium";
    case "skipped":
      return "text-amber-700";
    case "failed":
      return "text-red-700";
    default:
      return "text-slate-400";
  }
}

function attachmentStatusIcon(
  status: SummaryAttachmentProgressItem["status"],
): string {
  switch (status) {
    case "done":
      return "✓";
    case "loading":
    case "processing":
      return "…";
    case "skipped":
      return "–";
    case "failed":
      return "!";
    default:
      return "○";
  }
}

interface OrderReportSummaryProgressProps {
  phase: OrderReportSummaryGenerationPhase | null;
  attachmentProgress?: SummaryAttachmentProgressItem[] | null;
  onCancel?: () => void;
  isCancelling?: boolean;
}

export function OrderReportSummaryProgress({
  phase,
  attachmentProgress,
  onCancel,
  isCancelling = false,
}: OrderReportSummaryProgressProps) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const isRunning = phase === "running";
  const isCompleted = phase === "completed";
  const isFailed = phase === "failed";
  const isCancelled = phase === "cancelled";

  useEffect(() => {
    if (!isRunning) {
      if (isCompleted) {
        setProgress(100);
      }
      return;
    }

    const startedAt = Date.now();
    setProgress(4);
    setElapsed(0);

    const tick = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);

      setProgress((prev) => {
        if (prev >= 96) return prev;
        let delta = 1.2;
        if (prev >= 38 && prev < 82) delta = 0.45;
        else if (prev >= 82) delta = 0.8;
        else if (prev >= 18) delta = 0.9;
        return Math.min(96, prev + delta);
      });
    }, 400);

    return () => {
      window.clearInterval(tick);
    };
  }, [isRunning, isCompleted]);

  if (!phase) {
    return null;
  }

  const displayProgress = isCompleted ? 100 : progress;
  const activeStepIndex = isCompleted
    ? GENERATION_STEPS.length
    : getActiveStepIndex(displayProgress);
  const activeStep =
    GENERATION_STEPS[
      Math.min(activeStepIndex, GENERATION_STEPS.length - 1)
    ];

  const panelClass = isCancelled
    ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-50/50"
    : isFailed
      ? "border-red-200/80 bg-gradient-to-br from-red-50 via-white to-red-50/50"
      : isCompleted
        ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50"
        : "border-[#009ada]/30 bg-gradient-to-br from-[#004b87]/5 via-white to-[#009ada]/5";

  const title = isCompleted
    ? "작업 완료"
    : isCancelled
      ? "생성 취소됨"
      : isFailed
        ? "작업 실패"
        : "발주요약 생성 중입니다";

  const description = isCompleted
    ? "발주요약 생성이 완료되었습니다. 아래 미리보기와 DOCX 다운로드를 확인하세요."
    : isCancelled
      ? "요약 생성을 중단했습니다. 필요하면 다시 요약 생성을 눌러 주세요."
      : isFailed
        ? "요약 생성 중 오류가 발생했습니다. 오류 메시지를 확인한 뒤 다시 시도해 주세요."
        : "첨부파일 분석과 AI 요약에 1~3분 정도 걸릴 수 있습니다. 완료 전에는 다른 화면으로 이동할 수 없습니다.";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isRunning}
      data-summary-guard-allow
      className={`rounded-xl border p-5 shadow-sm ${panelClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-semibold ${
              isCancelled
                ? "text-amber-800"
                : isFailed
                  ? "text-red-700"
                  : isCompleted
                    ? "text-emerald-800"
                    : "text-[#004b87]"
            }`}
          >
            {title}
          </p>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p
            className={`font-medium ${
              isCancelled
                ? "text-amber-800"
                : isFailed
                  ? "text-red-700"
                  : isCompleted
                    ? "text-emerald-800"
                    : "text-[#004b87]"
            }`}
          >
            {formatElapsed(elapsed)}
          </p>
          <p>
            {isCompleted || isFailed || isCancelled ? "소요 시간" : "경과 시간"}
          </p>
        </div>
      </div>

      {isRunning && onCancel ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {isCancelling ? "중단 중…" : "요약 생성 중단"}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">
            {isCompleted
              ? "모든 단계 완료"
              : isCancelled || isFailed
                ? "생성 중단"
                : activeStep.label}
          </span>
          <span className="tabular-nums text-slate-500">
            {Math.round(displayProgress)}%
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              isCancelled
                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                : isFailed
                  ? "bg-gradient-to-r from-red-400 to-red-500"
                  : isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                    : "bg-gradient-to-r from-[#004b87] via-[#009ada] to-[#a4ce39]"
            } ${isRunning ? "summary-progress-bar-fill" : ""}`}
            style={{ width: `${displayProgress}%` }}
          />
          {isRunning ? (
            <div className="summary-progress-bar-shimmer pointer-events-none absolute inset-0" />
          ) : null}
        </div>
      </div>

      {attachmentProgress && attachmentProgress.length > 1 ? (
        <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/70 p-3">
          <p className="mb-2 text-xs font-medium text-slate-700">
            첨부파일 처리 현황 ({attachmentProgress.length}개)
          </p>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {attachmentProgress.map((item) => {
              const isActive =
                item.status === "loading" || item.status === "processing";
              return (
                <li
                  key={item.fileName}
                  className="flex items-start gap-2 text-xs"
                  title={item.detail ?? undefined}
                >
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      item.status === "done"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : item.status === "failed"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : item.status === "skipped"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : isActive
                              ? "border-[#009ada] bg-[#009ada]/10 text-[#004b87] summary-progress-step-pulse"
                              : "border-slate-200 bg-white text-slate-400"
                    }`}
                    aria-hidden
                  >
                    {attachmentStatusIcon(item.status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-700">{item.fileName}</p>
                    <p className={attachmentStatusClass(item.status)}>
                      {ATTACHMENT_STATUS_LABELS[item.status]}
                      {item.detail ? ` · ${item.detail}` : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ol className="mt-4 space-y-2">
        {GENERATION_STEPS.map((step, index) => {
          const isDone = isCompleted || index < activeStepIndex;
          const isCurrent = isRunning && index === activeStepIndex;
          const isStepFailed =
            (isFailed || isCancelled) && index === activeStepIndex;

          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 text-xs transition-colors ${
                isStepFailed
                  ? "font-medium text-red-700"
                  : isCurrent
                    ? "font-medium text-[#004b87]"
                    : isDone
                      ? "text-emerald-700"
                      : "text-slate-400"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  isStepFailed
                    ? "border-red-300 bg-red-50"
                    : isCurrent
                      ? "border-[#009ada] bg-[#009ada]/10 summary-progress-step-pulse"
                      : isDone
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                }`}
                aria-hidden
              >
                {isDone ? "✓" : isStepFailed ? "!" : isCurrent ? "…" : index + 1}
              </span>
              <span>{step.label}</span>
              {isCurrent ? (
                <span className="summary-progress-dots text-[#009ada]" aria-hidden>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
