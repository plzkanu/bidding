import { extractNumericWonAmount, hasDisplayableSummaryValue } from "@/lib/order-report-summary/overview-display";
import { resolveKeyFieldsFormValues } from "@/lib/order-report-summary/key-fields";
import { splitQualificationItems } from "@/lib/order-report-summary/qualification-format";
import {
  buildQualificationRows,
} from "@/lib/order-report-summary/field-map";
import type {
  OrderReportKeyFieldsConfirmation,
  OrderReportPqAutoSummary,
  OrderReportSummaryData,
  OrderReportSummaryScheduleStep,
} from "@/lib/order-report-summary/types";

export interface BidAmountSheetNoticeContext {
  bidMethod?: string | null;
  awardMethod?: string | null;
  bidCloseDt?: string | null;
}

export interface BidAmountPqScoreRow {
  구분: string;
  평가항목: string;
  배점: string;
  득점: string;
  비고: string;
  소계?: boolean;
  총계?: boolean;
}

export interface BidAmountSheetData {
  공사명: string;
  입찰종류: string;
  입찰방법: string;
  낙찰자결정방법: string;
  발주기관: string;
  투찰일자: string;
  입찰참가자격: string;
  추정금액: string;
  추정가격: string;
  예비가격기초금액: string;
  기간라벨: string;
  기간: string;
  적격심사: BidAmountPqScoreRow[];
  baseAmountNumber: number | null;
}

function displayValue(value: string | null | undefined): string {
  return hasDisplayableSummaryValue(value) ? value!.trim() : "";
}

function buildProjectName(
  summary: OrderReportSummaryData,
  noticeTitle?: string,
): string {
  const first = summary.공사개요[0];
  if (first && hasDisplayableSummaryValue(first.공사명)) {
    return first.공사명.trim();
  }
  if (hasDisplayableSummaryValue(summary.공고명)) {
    return summary.공고명.trim();
  }
  return noticeTitle?.trim() ?? "";
}

function buildOrderer(summary: OrderReportSummaryData): string {
  const first = summary.공사개요[0];
  if (first && hasDisplayableSummaryValue(first.발주자)) {
    return first.발주자.trim();
  }
  if (hasDisplayableSummaryValue(summary.발주기관)) {
    return summary.발주기관.trim();
  }
  return "";
}

function buildPeriod(summary: OrderReportSummaryData): string {
  const first = summary.공사개요[0];
  return first && hasDisplayableSummaryValue(first.공사기간)
    ? first.공사기간.trim()
    : "";
}

const BID_KIND_PATTERN = /(제한경쟁|일반경쟁|지명경쟁|수의계약)/;

function splitBidKindAndMethod(
  summaryMethod: string,
  noticeMethod?: string | null,
): { kind: string; method: string } {
  let kind = "";
  const methods: string[] = [];

  for (const source of [summaryMethod, noticeMethod ?? ""]) {
    const text = displayValue(source);
    if (!text) continue;
    const match = text.match(BID_KIND_PATTERN);
    if (match && !kind) kind = match[1];
    const rest = text
      .replace(BID_KIND_PATTERN, "")
      .replace(/^[\s,./]+|[\s,./]+$/g, "")
      .trim();
    if (rest && !methods.includes(rest)) methods.push(rest);
  }

  return { kind, method: methods.join(", ") };
}

function findAwardMethod(
  summary: OrderReportSummaryData,
  noticeAward?: string | null,
): string {
  if (displayValue(noticeAward)) return noticeAward!.trim();

  const sources = [
    summary.공사개요[0]?.입찰방법,
    summary.공사개요[0]?.비고,
  ];
  for (const source of sources) {
    const text = displayValue(source);
    const match = text.match(/적격심사낙찰제|최저가낙찰제|종합심사낙찰제/);
    if (match) return match[0];
  }
  return "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatKoreanDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const yoil = ["일", "월", "화", "수", "목", "금", "토"][iso.getDay()];
    return `${iso.getFullYear()}. ${iso.getMonth() + 1}. ${iso.getDate()}.(${yoil}) ${pad2(iso.getHours())}:${pad2(iso.getMinutes())}`;
  }

  return trimmed.replace(/\s+/g, " ");
}

function compactStep(step: string): string {
  return step.replace(/\s+/g, "");
}

function findScheduleStep(
  steps: OrderReportSummaryScheduleStep[],
  patterns: string[],
): OrderReportSummaryScheduleStep | null {
  return (
    steps.find((step) =>
      patterns.some((pattern) => compactStep(step.단계).includes(pattern)),
    ) ?? null
  );
}

function buildBidDateText(
  steps: OrderReportSummaryScheduleStep[],
  bidCloseDt?: string | null,
): string {
  const bidStep = findScheduleStep(steps, [
    "입찰서제출",
    "투찰",
    "입찰마감",
    "입찰접수",
  ]);
  const openStep = findScheduleStep(steps, ["개찰"]);
  const bidDate = formatKoreanDateTime(
    bidStep?.날짜 || bidCloseDt || "",
  );
  const openDate = formatKoreanDateTime(openStep?.날짜 || "");

  if (bidDate && openDate) {
    return `${bidDate}\n(개찰예정일시 : ${openDate} 이후)`;
  }
  if (bidDate) return bidDate;
  if (openDate) return `(개찰예정일시 : ${openDate} 이후)`;
  return "";
}

function formatWonAmount(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}

function formatWonFromText(value: string): string {
  const amount = extractNumericWonAmount(value);
  if (amount == null) return displayValue(value);
  return formatWonAmount(amount);
}

function buildEstimatedAmounts(
  estimatedPriceText: string,
  baseAmountText: string,
): { 추정금액: string; 추정가격: string } {
  const estimated = extractNumericWonAmount(estimatedPriceText);
  const base = extractNumericWonAmount(baseAmountText);

  if (estimated != null && base != null) {
    const vatAdded = Math.round(estimated * 1.1);
    if (Math.abs(vatAdded - base) / base < 0.02) {
      return {
        추정금액: formatWonAmount(base),
        추정가격: formatWonAmount(estimated),
      };
    }
    if (Math.abs(estimated - base) / Math.max(base, 1) < 0.02) {
      return {
        추정금액: formatWonAmount(estimated),
        추정가격: formatWonAmount(Math.round(estimated / 1.1)),
      };
    }
  }

  if (base != null && estimated == null) {
    return {
      추정금액: formatWonAmount(base),
      추정가격: formatWonAmount(Math.round(base / 1.1)),
    };
  }

  if (estimated != null) {
    return {
      추정금액: formatWonAmount(Math.round(estimated * 1.1)),
      추정가격: formatWonAmount(estimated),
    };
  }

  return {
    추정금액: formatWonFromText(baseAmountText),
    추정가격: formatWonFromText(estimatedPriceText),
  };
}

function buildQualificationText(
  summary: OrderReportSummaryData,
  pqSummary?: OrderReportPqAutoSummary | null,
): string {
  const rows = buildQualificationRows(summary);
  if (rows.length > 0) {
    const lines: string[] = [];
    let index = 1;
    for (const row of rows) {
      const items = splitQualificationItems(row.value);
      if (items.length === 0) {
        const value = displayValue(row.value);
        if (value) {
          lines.push(`${index}. ${value}`);
          index += 1;
        }
        continue;
      }
      for (const item of items) {
        lines.push(`${index}. ${item}`);
        index += 1;
      }
    }
    return lines.join("\n");
  }

  if (pqSummary && hasDisplayableSummaryValue(pqSummary.요약)) {
    return pqSummary.요약.trim();
  }
  return "";
}

function formatPqPoints(value: number): string {
  return value.toFixed(4);
}

/** 용역 적격심사 기준 (첨부 샘플: 수행능력 70 / 입찰가격 30 / 합격 92점) */
function buildPqScoreRows(): BidAmountPqScoreRow[] {
  const capabilityMax = 70;
  const capabilityEarned = 66.5;
  const creditEarned = 0.8;
  const bidPriceMax = 30;
  const passScore = 92;
  const minBidRate = 82.7;
  const subtotalEarned = capabilityEarned + creditEarned;
  const bidPriceEarned = passScore - subtotalEarned;

  return [
    {
      구분: "수행능력평가",
      평가항목: "사업수행능력",
      배점: formatPqPoints(capabilityMax),
      득점: formatPqPoints(capabilityEarned),
      비고: "",
    },
    {
      구분: "수행능력평가",
      평가항목: "신인도",
      배점: "+1.0~-5.0",
      득점: formatPqPoints(creditEarned),
      비고: "",
    },
    {
      구분: "수행능력평가",
      평가항목: "소 계",
      배점: formatPqPoints(capabilityMax),
      득점: formatPqPoints(subtotalEarned),
      비고: "",
      소계: true,
    },
    {
      구분: "입찰가격 평가",
      평가항목: "",
      배점: formatPqPoints(bidPriceMax),
      득점: formatPqPoints(bidPriceEarned),
      비고: `낙찰하한율 ${minBidRate.toFixed(3)}%`,
    },
    {
      구분: "총 계",
      평가항목: "",
      배점: formatPqPoints(capabilityMax + bidPriceMax),
      득점: formatPqPoints(passScore),
      비고: `${passScore}점 이상`,
      총계: true,
    },
  ];
}

export function buildBidAmountSheetData(
  summary: OrderReportSummaryData,
  confirmation: OrderReportKeyFieldsConfirmation | null | undefined,
  noticeTitle?: string,
  pqSummary?: OrderReportPqAutoSummary | null,
  notice?: BidAmountSheetNoticeContext,
): BidAmountSheetData {
  const fields = resolveKeyFieldsFormValues(summary, confirmation, noticeTitle);
  const 예비가격기초금액 = displayValue(fields.예비가격기초금액);
  const { kind, method } = splitBidKindAndMethod(
    displayValue(summary.공사개요[0]?.입찰방법),
    notice?.bidMethod,
  );
  const amounts = buildEstimatedAmounts(
    displayValue(fields.추정가격),
    예비가격기초금액,
  );
  const projectName = buildProjectName(summary, noticeTitle);
  const category = displayValue(fields.분류);
  const isService = /용역/.test(`${category}${projectName}`);

  return {
    공사명: projectName,
    입찰종류: kind,
    입찰방법: method,
    낙찰자결정방법: findAwardMethod(summary, notice?.awardMethod),
    발주기관: buildOrderer(summary),
    투찰일자: buildBidDateText(fields.입찰일정, notice?.bidCloseDt),
    입찰참가자격: buildQualificationText(summary, pqSummary),
    추정금액: amounts.추정금액,
    추정가격: amounts.추정가격,
    예비가격기초금액: 예비가격기초금액
      ? formatWonFromText(예비가격기초금액)
      : "",
    기간라벨: isService ? "용 역 기 간" : "공 사 기 간",
    기간: buildPeriod(summary),
    적격심사: buildPqScoreRows(),
    baseAmountNumber: 예비가격기초금액
      ? extractNumericWonAmount(예비가격기초금액)
      : null,
  };
}
