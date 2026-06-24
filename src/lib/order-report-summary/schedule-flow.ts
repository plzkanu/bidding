import type { OrderReportSummaryScheduleStep } from "@/lib/order-report-summary/types";
import { EMPTY_SUMMARY_VALUE } from "@/lib/order-report-summary/types";
import { hasDisplayableSummaryValue } from "@/lib/order-report-summary/overview-display";

/** 레거시 4단계 플로우 라벨 (문서 일정이 없을 때 폴백) */
export const SCHEDULE_FLOW_STEP_LABELS = [
  "입찰공고",
  "PQ서류 제출",
  "입찰참가신청",
  "입찰서 제출",
] as const;

export type ScheduleFlowStepLabel = (typeof SCHEDULE_FLOW_STEP_LABELS)[number];

const STEP_MATCH_PATTERNS: Record<ScheduleFlowStepLabel, string[]> = {
  입찰공고: ["입찰공고", "공고일", "공고 게시", "공고"],
  "PQ서류 제출": [
    "pq서류 제출",
    "pq서류",
    "pq 서류",
    "pq",
    "사전심사",
    "pq심사",
    "pq 제출",
    "실적증명서",
  ],
  입찰참가신청: [
    "입찰참가신청",
    "입찰참가",
    "입찰참가 신청",
    "참가신청",
    "참가 신청",
    "입찰 참가",
    "입찰참가",
  ],
  "입찰서 제출": [
    "입찰서 제출",
    "입찰서",
    "입찰서 접수",
    "입찰 접수",
    "서류제출",
    "서류 제출",
    "제출마감",
    "개찰",
  ],
};

function normalizeStepText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasScheduleDate(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== EMPTY_SUMMARY_VALUE && trimmed !== "—";
}

function hasScheduleStep(value: string | null | undefined): boolean {
  return hasDisplayableSummaryValue(value ?? "");
}

function matchScheduleFlowLabel(
  stepName: string,
): ScheduleFlowStepLabel | null {
  const normalized = normalizeStepText(stepName);
  if (!normalized) return null;

  for (const label of SCHEDULE_FLOW_STEP_LABELS) {
    const patterns = STEP_MATCH_PATTERNS[label];
    if (
      patterns.some(
        (pattern) =>
          normalized.includes(pattern) || pattern.includes(normalized),
      )
    ) {
      return label;
    }
  }

  return null;
}

function appendDate(existing: string, next: string): string {
  if (!hasScheduleDate(existing)) return next;
  if (!hasScheduleDate(next)) return existing;
  if (existing.includes(next)) return existing;
  return `${existing}\n${next}`;
}

/** 문서에서 추출한 일정을 그대로 사용 (날짜·단계가 있는 항목만) */
export function getDocumentScheduleSteps(
  steps: OrderReportSummaryScheduleStep[],
): OrderReportSummaryScheduleStep[] {
  return steps.filter(
    (step) => hasScheduleDate(step.날짜) && hasScheduleStep(step.단계),
  );
}

/** 표시용 일정 — 문서 일정 우선, 없으면 4단계 템플릿으로 정규화 */
export function getEffectiveScheduleSteps(
  steps: OrderReportSummaryScheduleStep[],
): OrderReportSummaryScheduleStep[] {
  const documentSteps = getDocumentScheduleSteps(steps);
  if (documentSteps.length > 0) {
    return documentSteps;
  }
  return normalizeScheduleFlowSteps(steps);
}

/** 추출된 주요일정을 4단계 플로우 표 형식으로 정규화 (폴백) */
export function normalizeScheduleFlowSteps(
  steps: OrderReportSummaryScheduleStep[],
): OrderReportSummaryScheduleStep[] {
  const dates: Record<ScheduleFlowStepLabel, string> = {
    입찰공고: "",
    "PQ서류 제출": "",
    입찰참가신청: "",
    "입찰서 제출": "",
  };

  const unmatched: OrderReportSummaryScheduleStep[] = [];

  for (const step of steps) {
    const date = step.날짜?.trim() ?? "";
    if (!hasScheduleDate(date)) continue;

    const label = matchScheduleFlowLabel(step.단계);
    if (label) {
      dates[label] = appendDate(dates[label], date);
      continue;
    }

    unmatched.push(step);
  }

  let unmatchedIndex = 0;
  for (const label of SCHEDULE_FLOW_STEP_LABELS) {
    if (!dates[label] && unmatchedIndex < unmatched.length) {
      dates[label] = unmatched[unmatchedIndex]!.날짜;
      unmatchedIndex += 1;
    }
  }

  return SCHEDULE_FLOW_STEP_LABELS.map((label) => ({
    단계: label,
    날짜: dates[label],
  })).filter((step) => hasScheduleDate(step.날짜));
}

export function emptyScheduleFlowSteps(): OrderReportSummaryScheduleStep[] {
  return SCHEDULE_FLOW_STEP_LABELS.map((label) => ({
    단계: label,
    날짜: "",
  }));
}

export function hasScheduleFlowContent(
  steps: OrderReportSummaryScheduleStep[],
): boolean {
  return getEffectiveScheduleSteps(steps).length > 0;
}
