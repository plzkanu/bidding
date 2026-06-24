import { EMPTY_SUMMARY_VALUE } from "@/lib/order-report-summary/types";

export function hasDisplayableSummaryValue(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== EMPTY_SUMMARY_VALUE && trimmed !== "—";
}

export function parseLabelValueLine(
  text: string,
): { label: string; value: string } | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^([^:：]+)[:：]\s*(.+)$/u);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

export interface OverviewDisplayRow {
  label: string;
  value: string;
}

/** 금액 문자열에서 숫자(원) 추출 — 비교·중복 제거용 */
export function extractNumericWonAmount(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

/** 같은 항목명이 여러 번 나오면 더 큰 금액(또는 먼저 나온 비금액 행)만 유지 */
export function deduplicateOverviewDisplayRows(
  rows: OverviewDisplayRow[],
): OverviewDisplayRow[] {
  const bestByLabel = new Map<string, OverviewDisplayRow>();

  for (const row of rows) {
    const existing = bestByLabel.get(row.label);
    if (!existing) {
      bestByLabel.set(row.label, row);
      continue;
    }

    const existingAmount = extractNumericWonAmount(existing.value);
    const newAmount = extractNumericWonAmount(row.value);

    if (newAmount != null && (existingAmount == null || newAmount > existingAmount)) {
      bestByLabel.set(row.label, row);
    }
  }

  const seen = new Set<string>();
  const result: OverviewDisplayRow[] = [];

  for (const row of rows) {
    if (seen.has(row.label)) continue;
    seen.add(row.label);
    result.push(bestByLabel.get(row.label) ?? row);
  }

  return result;
}

/** 기초금액과 비고에 같은 항목명이 있으면 비고 쪽 줄 제거 */
export function dedupeOverviewFinancialFields<
  T extends { 기초금액: string; 비고: string },
>(row: T): T {
  const baseParsed = parseLabelValueLine(row.기초금액);
  if (!baseParsed) return row;

  const labelPattern = new RegExp(
    `^\\s*${baseParsed.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:[^\\n]*\\n?`,
    "mu",
  );
  const cleaned = row.비고.replace(labelPattern, "").trim();
  if (cleaned === row.비고) return row;

  return {
    ...row,
    비고: cleaned || "미기재",
  };
}

/** 공사개요.기초금액 필드 → 미리보기 행 (라벨 "기초금액" 고정 사용 안 함) */
export function toOverviewBaseAmountRow(
  raw: string,
  labelPrefix = "",
): OverviewDisplayRow | null {
  if (!hasDisplayableSummaryValue(raw)) return null;

  const parsed = parseLabelValueLine(raw);
  if (parsed) {
    if (!hasDisplayableSummaryValue(parsed.value)) return null;
    return {
      label: `${labelPrefix}${parsed.label}`,
      value: parsed.value,
    };
  }

  return { label: `${labelPrefix}금액`, value: raw };
}

/** 공사개요.비고 → 금액·특이사항 행 (값 없는 기초금액·추정가격 줄 제외) */
export function toOverviewRemarkRows(
  remarks: string,
  labelPrefix = "",
): OverviewDisplayRow[] {
  if (!hasDisplayableSummaryValue(remarks)) return [];

  const rows: OverviewDisplayRow[] = [];
  const plainLines: string[] = [];

  for (const line of remarks.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseLabelValueLine(trimmed);
    if (parsed) {
      if (!hasDisplayableSummaryValue(parsed.value)) continue;
      rows.push({
        label: `${labelPrefix}${parsed.label}`,
        value: parsed.value,
      });
      continue;
    }

    if (hasDisplayableSummaryValue(trimmed)) {
      plainLines.push(trimmed);
    }
  }

  if (plainLines.length > 0) {
    rows.push({
      label: `${labelPrefix}비고`,
      value: plainLines.join("\n"),
    });
  }

  return rows;
}

/** DOCX 기초금액 셀 — 금액만 또는 원문 항목명: 금액 */
export function formatOverviewBaseAmountForDocx(raw: string): string {
  if (!hasDisplayableSummaryValue(raw)) return "";

  const parsed = parseLabelValueLine(raw);
  if (parsed && hasDisplayableSummaryValue(parsed.value)) {
    return parsed.value;
  }

  return raw.trim();
}

/** DOCX 비고 셀 — 표시 가능한 줄만 */
export function formatOverviewRemarksForDocx(remarks: string): string {
  const rows = toOverviewRemarkRows(remarks);
  if (rows.length === 0) return "";

  return rows
    .map((row) =>
      row.label === "비고" ? row.value : `${row.label}: ${row.value}`,
    )
    .join("\n");
}

export function hasOverviewBaseAmountContent(raw: string): boolean {
  return formatOverviewBaseAmountForDocx(raw) !== "";
}
