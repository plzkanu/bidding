import { extractProjectCategoryFromTitle } from "@/lib/order-report-summary/project-category";
import {
  EMPTY_SUMMARY_VALUE,
  emptyOrderReportSummaryData,
  type OrderReportKeyFieldsConfirmation,
  type OrderReportSummaryData,
  type OrderReportSummaryOverviewRow,
  type OrderReportSummaryScheduleStep,
} from "@/lib/order-report-summary/types";
import {
  hasDisplayableSummaryValue,
  parseLabelValueLine,
  partitionOverviewRemarks,
  toOverviewBaseAmountRow,
} from "@/lib/order-report-summary/overview-display";

export interface OrderReportKeyFieldsInput {
  분류: string;
  추정가격: string;
  예비가격기초금액: string;
  입찰일정: OrderReportSummaryScheduleStep[];
}

function compactLabel(label: string): string {
  return label.replace(/\s+/g, "");
}

function isEstimatedPriceLabel(label: string): boolean {
  const compact = compactLabel(label);
  if (compact.includes("기초")) return false;
  return (
    compact === "추정가격" || compact === "추정가" || compact === "추정금액"
  );
}

function isReserveBaseAmountLabel(label: string): boolean {
  const compact = compactLabel(label);
  return compact.includes("예비가격기초금액");
}

function isGenericBaseAmountLabel(label: string): boolean {
  const compact = compactLabel(label);
  return compact === "기초금액" || compact === "기초금";
}

function displayOrEmpty(value: string): string {
  return hasDisplayableSummaryValue(value) ? value.trim() : "";
}

function storedOrEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === EMPTY_SUMMARY_VALUE || trimmed === "—") {
    return EMPTY_SUMMARY_VALUE;
  }
  return trimmed;
}

function extractCategoryFromSummary(
  summary: OrderReportSummaryData,
  noticeTitle?: string,
): string {
  if (hasDisplayableSummaryValue(summary.분류)) {
    return summary.분류.trim();
  }
  return extractProjectCategoryFromTitle(
    ...summary.공사개요.map((row) => row.공사명),
    summary.공고명,
    noticeTitle,
  );
}

export function extractKeyFieldsFromSummary(
  summary: OrderReportSummaryData,
  noticeTitle?: string,
): OrderReportKeyFieldsInput {
  let estimatedPrice = "";
  let baseAmount = "";

  for (const row of summary.공사개요) {
    if (!estimatedPrice) {
      const fromRemarks = partitionOverviewRemarks(row.비고).rows.find((item) =>
        isEstimatedPriceLabel(item.label),
      );
      if (fromRemarks) {
        estimatedPrice = fromRemarks.value;
      }
    }

    if (!estimatedPrice) {
      const fromBase = toOverviewBaseAmountRow(row.기초금액);
      if (fromBase && isEstimatedPriceLabel(fromBase.label)) {
        estimatedPrice = fromBase.value;
      }
    }

    if (!baseAmount) {
      const fromBase = toOverviewBaseAmountRow(row.기초금액);
      if (
        fromBase &&
        (isReserveBaseAmountLabel(fromBase.label) ||
          isGenericBaseAmountLabel(fromBase.label) ||
          fromBase.label === "기초금액")
      ) {
        baseAmount = fromBase.value;
      }
    }

    if (!baseAmount) {
      const fromRemarks = partitionOverviewRemarks(row.비고).rows.find((item) =>
        isReserveBaseAmountLabel(item.label),
      );
      if (fromRemarks) {
        baseAmount = fromRemarks.value;
      }
    }
  }

  if (!baseAmount) {
    const first = summary.공사개요[0];
    const fromBase = first ? toOverviewBaseAmountRow(first.기초금액) : null;
    if (fromBase && !isEstimatedPriceLabel(fromBase.label)) {
      baseAmount = fromBase.value;
    }
  }

  const schedule = summary.주요일정.filter(
    (step) =>
      hasDisplayableSummaryValue(step.단계) ||
      hasDisplayableSummaryValue(step.날짜),
  );

  return {
    분류: extractCategoryFromSummary(summary, noticeTitle),
    추정가격: displayOrEmpty(estimatedPrice),
    예비가격기초금액: displayOrEmpty(baseAmount),
    입찰일정: schedule,
  };
}

export function resolveKeyFieldsFormValues(
  summary: OrderReportSummaryData,
  confirmation: OrderReportKeyFieldsConfirmation | null | undefined,
  noticeTitle?: string,
): OrderReportKeyFieldsInput {
  if (confirmation) {
    return {
      분류:
        confirmation.분류 === EMPTY_SUMMARY_VALUE
          ? ""
          : displayOrEmpty(confirmation.분류) ||
            extractCategoryFromSummary(summary, noticeTitle),
      추정가격: displayOrEmpty(confirmation.추정가격),
      예비가격기초금액: displayOrEmpty(confirmation.예비가격기초금액),
      입찰일정: confirmation.입찰일정.filter(
        (step) =>
          hasDisplayableSummaryValue(step.단계) ||
          hasDisplayableSummaryValue(step.날짜),
      ),
    };
  }
  return extractKeyFieldsFromSummary(summary, noticeTitle);
}

function replaceOrInsertLabeledLine(
  remarks: string,
  label: string,
  value: string,
): string {
  const lines =
    remarks === EMPTY_SUMMARY_VALUE ? [] : remarks.split("\n");
  const stored = storedOrEmpty(value);
  const newLine = stored === EMPTY_SUMMARY_VALUE ? null : `${label}: ${stored}`;

  let found = false;
  const next: string[] = [];
  for (const line of lines) {
    const parsed = parseLabelValueLine(line.trim());
    if (parsed && isEstimatedPriceLabel(parsed.label)) {
      found = true;
      if (newLine) next.push(newLine);
      continue;
    }
    next.push(line);
  }

  if (!found && newLine) {
    const footnoteIndex = next.findIndex((line) => line.trim().startsWith("※"));
    if (footnoteIndex >= 0) {
      next.splice(footnoteIndex, 0, newLine);
    } else {
      next.unshift(newLine);
    }
  }

  const joined = next
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return joined || EMPTY_SUMMARY_VALUE;
}

function applyReserveBaseAmount(current: string, value: string): string {
  const stored = storedOrEmpty(value);
  if (stored === EMPTY_SUMMARY_VALUE) return EMPTY_SUMMARY_VALUE;

  const parsed = parseLabelValueLine(current);
  const label =
    parsed && isReserveBaseAmountLabel(parsed.label)
      ? parsed.label
      : "예비가격기초금액";
  return `${label}: ${stored}`;
}

function applyScheduleSteps(
  steps: OrderReportSummaryScheduleStep[],
): OrderReportSummaryScheduleStep[] {
  return steps
    .map((step) => ({
      단계: storedOrEmpty(step.단계),
      날짜: storedOrEmpty(step.날짜),
    }))
    .filter(
      (step) =>
        step.단계 !== EMPTY_SUMMARY_VALUE || step.날짜 !== EMPTY_SUMMARY_VALUE,
    )
    .map((step) => ({
      단계: step.단계 === EMPTY_SUMMARY_VALUE ? "" : step.단계,
      날짜: step.날짜 === EMPTY_SUMMARY_VALUE ? "" : step.날짜,
    }))
    .filter((step) => step.단계.trim() !== "" || step.날짜.trim() !== "");
}

export function applyKeyFieldsToSummary(
  summary: OrderReportSummaryData,
  fields: OrderReportKeyFieldsInput,
): OrderReportSummaryData {
  const emptyRow = emptyOrderReportSummaryData().공사개요[0]!;
  const overview: OrderReportSummaryOverviewRow[] =
    summary.공사개요.length > 0
      ? summary.공사개요.map((row) => ({ ...row }))
      : [{ ...emptyRow }];

  const first = overview[0]!;
  overview[0] = {
    ...first,
    기초금액: applyReserveBaseAmount(first.기초금액, fields.예비가격기초금액),
    비고: replaceOrInsertLabeledLine(first.비고, "추정가격", fields.추정가격),
  };

  return {
    ...summary,
    분류: storedOrEmpty(fields.분류),
    공사개요: overview,
    주요일정: applyScheduleSteps(fields.입찰일정),
  };
}

export function toKeyFieldsConfirmation(
  fields: OrderReportKeyFieldsInput,
  confirmedAt: Date,
): OrderReportKeyFieldsConfirmation {
  return {
    분류: storedOrEmpty(fields.분류),
    추정가격: storedOrEmpty(fields.추정가격),
    예비가격기초금액: storedOrEmpty(fields.예비가격기초금액),
    입찰일정: applyScheduleSteps(fields.입찰일정),
    confirmedAt: confirmedAt.toISOString(),
  };
}

export function parseConfirmKeyFieldsBody(body: unknown): {
  fields: OrderReportKeyFieldsInput | null;
  error: string | null;
} {
  if (!body || typeof body !== "object") {
    return { fields: null, error: "요청이 올바르지 않습니다." };
  }

  const data = body as Record<string, unknown>;
  if (typeof data.분류 !== "string") {
    return { fields: null, error: "공사 분류를 확인해 주세요." };
  }
  if (typeof data.추정가격 !== "string") {
    return { fields: null, error: "추정가격을 확인해 주세요." };
  }
  if (typeof data.예비가격기초금액 !== "string") {
    return { fields: null, error: "예비가격기초금액을 확인해 주세요." };
  }
  if (!Array.isArray(data.입찰일정)) {
    return { fields: null, error: "입찰 일정을 확인해 주세요." };
  }

  const schedule: OrderReportSummaryScheduleStep[] = [];
  for (const item of data.입찰일정) {
    if (!item || typeof item !== "object") {
      return { fields: null, error: "입찰 일정이 올바르지 않습니다." };
    }
    const row = item as Record<string, unknown>;
    if (typeof row.단계 !== "string" || typeof row.날짜 !== "string") {
      return { fields: null, error: "입찰 일정의 단계와 날짜를 확인해 주세요." };
    }
    schedule.push({ 단계: row.단계, 날짜: row.날짜 });
  }

  return {
    fields: {
      분류: data.분류,
      추정가격: data.추정가격,
      예비가격기초금액: data.예비가격기초금액,
      입찰일정: schedule,
    },
    error: null,
  };
}
