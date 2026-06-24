import type { OrderReportSummaryStatus } from "@/lib/order-report-summary/sections";
import {
  normalizeScheduleFlowSteps,
  type ScheduleFlowStepLabel,
} from "@/lib/order-report-summary/schedule-flow";
import {
  EMPTY_SUMMARY_VALUE,
  type OrderReportSummaryData,
} from "@/lib/order-report-summary/types";

const PQ_STEP_LABEL: ScheduleFlowStepLabel = "PQ서류 제출";

export const PQ_LIST_LABEL_PENDING = "PQ 분석 전";
export const PQ_LIST_LABEL_NONE = "PQ 없음";

export interface PqAnalysisResult {
  hasPq: boolean;
  submissionDate: string | null;
}

function hasValidScheduleDate(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== EMPTY_SUMMARY_VALUE && trimmed !== "—";
}

/** 발주요약 주요일정에서 PQ·실적증명서 제출 일정 추출 */
export function extractPqFromSummary(
  summary: OrderReportSummaryData,
): PqAnalysisResult {
  const pqPatterns = ["pq", "실적증명서", "사전심사"];

  for (const step of summary.주요일정) {
    const stepName = step.단계.trim().toLowerCase();
    const date = step.날짜?.trim() ?? "";
    if (
      pqPatterns.some((pattern) => stepName.includes(pattern)) &&
      hasValidScheduleDate(date)
    ) {
      return { hasPq: true, submissionDate: date };
    }
  }

  const steps = normalizeScheduleFlowSteps(summary.주요일정);
  const pqStep = steps.find((step) => step.단계 === PQ_STEP_LABEL);
  const date = pqStep?.날짜?.trim() ?? "";

  if (!hasValidScheduleDate(date)) {
    return { hasPq: false, submissionDate: null };
  }

  return { hasPq: true, submissionDate: date };
}

export interface OrderReportPqListMeta {
  summaryStatus: OrderReportSummaryStatus;
  pqLabel: string;
  pqHasPq: boolean | null;
  pqSubmissionDate: string | null;
}

export function resolvePqListMeta(options: {
  summaryStatus: OrderReportSummaryStatus;
  pqHasPq?: boolean | null;
  pqSubmissionDate?: string | null;
  summary?: OrderReportSummaryData | null;
}): OrderReportPqListMeta {
  const { summaryStatus } = options;

  if (summaryStatus !== "COMPLETED") {
    return {
      summaryStatus,
      pqLabel: PQ_LIST_LABEL_PENDING,
      pqHasPq: null,
      pqSubmissionDate: null,
    };
  }

  let hasPq = options.pqHasPq ?? null;
  let submissionDate = options.pqSubmissionDate ?? null;

  if ((hasPq == null || submissionDate == null) && options.summary) {
    const extracted = extractPqFromSummary(options.summary);
    hasPq = extracted.hasPq;
    submissionDate = extracted.submissionDate;
  }

  if (hasPq && submissionDate) {
    return {
      summaryStatus,
      pqLabel: submissionDate,
      pqHasPq: true,
      pqSubmissionDate: submissionDate,
    };
  }

  return {
    summaryStatus,
    pqLabel: PQ_LIST_LABEL_NONE,
    pqHasPq: false,
    pqSubmissionDate: null,
  };
}

export function pqListLabelClassName(pqLabel: string): string {
  if (pqLabel === PQ_LIST_LABEL_PENDING) {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }
  if (pqLabel === PQ_LIST_LABEL_NONE) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-[#009ada]/30 bg-[#009ada]/5 text-[#004b87]";
}
