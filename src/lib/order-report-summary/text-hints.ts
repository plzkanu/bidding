/** 첨부 텍스트에서 공고 항목 힌트 추출 (Gemini 보조·후처리) */

import type { OrderReportSummaryData } from "@/lib/order-report-summary/types";
import {
  dedupeOverviewFinancialFields,
  extractNumericWonAmount,
  parseLabelValueLine,
} from "@/lib/order-report-summary/overview-display";

export interface BaseAmountHint {
  label: string;
  amount: string;
  source: string;
}

export interface EstimatedPriceHint {
  label: string;
  amount: string;
  source: string;
}

const BASE_AMOUNT_LABELS = [
  "예비가격기초금액",
  "추정가격기초금액",
  "기초금액",
  "기초금",
] as const;

const ESTIMATED_PRICE_LABELS = ["추정가격", "추정 금액", "추정가"] as const;

const ALL_FINANCIAL_LABELS = [
  ...ESTIMATED_PRICE_LABELS,
  ...BASE_AMOUNT_LABELS,
] as const;

/** 숫자 본문: 414,328,730 / 1234567890 */
const AMOUNT_NUMBER =
  "[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?|[0-9]+(?:\\.[0-9]+)?";

/** HWP 입찰 안내서: ₩376,662,482- (부가가치세 별도) — 통화기호 생략 가능 */
const AMOUNT_CAPTURE = `(?:[₩￦W]\\s*)?(${AMOUNT_NUMBER})\\s*(?:원)?\\s*-?\\s*(\\([^)]+\\))?`;

const BULLET_PREFIX = "[·ㆍ○●◦\\-*•\\s]*";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HWP 추출 텍스트 정규화 (통화·공백·표 TSV) */
export function normalizeCurrencyInText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\uFFE6/g, "₩")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\u2060]/g, "");
}

/** 표 TSV·분리된 줄을 `항목 : 금액` 형태로 보강 */
export function preprocessAttachmentTextForHints(text: string): string {
  const normalized = normalizeCurrencyInText(text);
  const lines = normalized.split("\n");
  const extra: string[] = [];

  for (const line of lines) {
    if (!line.includes("\t")) continue;
    const cols = line.split("\t");
    extra.push(...formatLabelValuePairFromColumns(cols));
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i]?.trim() ?? "";
    const next = lines[i + 1]?.trim() ?? "";
    if (!current || !next) continue;

    const matchedLabel = ALL_FINANCIAL_LABELS.find((label) =>
      current.includes(label),
    );
    if (!matchedLabel) continue;
    if (!/(?:[₩￦W]\s*)?[0-9]/.test(next) && !/^[0-9]/.test(next)) continue;

    const labelPart = current.replace(/^[·ㆍ○●◦\-•*\s]+/, "").trim();
    extra.push(`${labelPart} : ${next}`);
  }

  if (extra.length === 0) return normalized;
  return `${normalized}\n${extra.join("\n")}`;
}

function formatLabelValuePairFromColumns(cols: string[]): string[] {
  const trimmed = cols.map((col) => col.trim()).filter(Boolean);
  if (trimmed.length < 2) return [];

  const label = trimmed[0]
    .replace(/^[·ㆍ○●◦\-•*\s]+/, "")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
  const value = trimmed
    .slice(1)
    .join(" ")
    .replace(/^\s*[:：]\s*/, "")
    .trim();

  if (!label || !value) return [];
  return [`${label} : ${value}`];
}

/** 숫자 문자열을 천 단위 콤마 + 원 단위로 표시 */
export function formatWonAmount(digits: string): string {
  const plain = digits.replace(/,/g, "").trim();
  if (!/^[0-9]+$/.test(plain)) return digits;
  return `${Number(plain).toLocaleString("ko-KR")}원`;
}

/** 금액 문자열 정규화: 414,328,730원 (부가가치세 포함) 형식 */
export function normalizeMonetaryAmount(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const noteMatch = compact.match(/\([^)]+\)/);
  const note = noteMatch ? ` ${noteMatch[0]}` : "";
  const withoutNote = compact.replace(/\([^)]+\)/g, "").trim();
  const digits = withoutNote
    .replace(/^[₩￦W]\s*/i, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\s*원\s*$/i, "")
    .replace(/,/g, "")
    .trim();

  if (/^[0-9]+$/.test(digits)) {
    return `${formatWonAmount(digits)}${note}`.trim();
  }

  return compact;
}

function extractPlainDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** 페이지·조·개월 등 오인 방지: 콤마·통화·원 단위 없으면 6자리(10만원) 미만은 제외 */
export function isPlausibleFinancialAmount(
  raw: string,
  hadCurrencySymbol = false,
): boolean {
  const digits = extractPlainDigits(raw);
  if (!digits || digits === "0") return false;
  if (/,/.test(raw) || hadCurrencySymbol || /원/.test(raw)) return true;
  return digits.length >= 6;
}

function tryMatchLabeledAmount(
  text: string,
  label: string,
): { label: string; amount: string } | null {
  const escaped = escapeRegExp(label);

  const patterns = [
    // · 추정가격 : ₩376,662,482- (부가가치세 별도)
    new RegExp(
      `${BULLET_PREFIX}${escaped}\\s*[:：]?\\s*${AMOUNT_CAPTURE}`,
      "gi",
    ),
    // 표(TSV): 추정가격\t₩376,662,482- ...
    new RegExp(`${escaped}\\t\\s*[:：]?\\s*${AMOUNT_CAPTURE}`, "gi"),
    // 다음 줄
    new RegExp(`${escaped}\\s*\\n\\s*[:：]?\\s*${AMOUNT_CAPTURE}`, "gi"),
    // 금액 (항목명)
    new RegExp(`${AMOUNT_CAPTURE}\\s*\\(?\\s*${escaped}\\s*\\)?`, "gi"),
    // 인접(120자 이내) — 표에서 셀 분리·통화기호 누락
    new RegExp(
      `${BULLET_PREFIX}${escaped}[\\s\\S]{0,120}?${AMOUNT_CAPTURE}`,
      "gi",
    ),
  ];

  let best: { label: string; amount: string; numeric: number } | null = null;

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (!match[1]) continue;

      const rawAmount = [match[1], match[2] ?? ""].filter(Boolean).join(" ");
      const hadCurrency = /[₩￦W]/.test(match[0]);
      if (!isPlausibleFinancialAmount(rawAmount, hadCurrency)) continue;

      const amount = normalizeMonetaryAmount(rawAmount);
      const numeric = extractPlainDigits(amount);
      if (!amount || amount === "0" || amount === "0원" || !numeric) continue;

      const value = Number(numeric);
      if (!Number.isFinite(value) || value <= 0) continue;

      if (!best || value > best.numeric) {
        best = { label, amount, numeric: value };
      }
    }
  }

  return best ? { label: best.label, amount: best.amount } : null;
}

function extractFromProcessedText(
  text: string,
  source: string,
): { base: BaseAmountHint | null; estimated: EstimatedPriceHint | null } {
  const processed = preprocessAttachmentTextForHints(text);

  let base: BaseAmountHint | null = null;
  for (const label of BASE_AMOUNT_LABELS) {
    const found = tryMatchLabeledAmount(processed, label);
    if (found) {
      base = { ...found, source };
      break;
    }
  }

  let estimated: EstimatedPriceHint | null = null;
  for (const label of ESTIMATED_PRICE_LABELS) {
    const found = tryMatchLabeledAmount(processed, label);
    if (found) {
      estimated = { label: found.label, amount: found.amount, source };
      break;
    }
  }

  return { base, estimated };
}

export function extractBaseAmountHint(
  text: string,
  source = "첨부",
): BaseAmountHint | null {
  if (!text.trim()) return null;
  return extractFromProcessedText(text, source).base;
}

export function extractEstimatedPriceHint(
  text: string,
  source = "첨부",
): EstimatedPriceHint | null {
  if (!text.trim()) return null;
  return extractFromProcessedText(text, source).estimated;
}

export function extractBaseAmountHintsFromTexts(
  sources: Array<{ fileName: string; text: string }>,
): BaseAmountHint[] {
  const hints: BaseAmountHint[] = [];

  for (const { fileName, text } of sources) {
    const hint = extractBaseAmountHint(text, fileName);
    if (hint) {
      hints.push(hint);
    }
  }

  return hints;
}

export function extractEstimatedPriceHintsFromTexts(
  sources: Array<{ fileName: string; text: string }>,
): EstimatedPriceHint[] {
  const hints: EstimatedPriceHint[] = [];

  for (const { fileName, text } of sources) {
    const hint = extractEstimatedPriceHint(text, fileName);
    if (hint) {
      hints.push(hint);
    }
  }

  return hints;
}

export function buildFinancialHintPromptBlock(
  baseHints: BaseAmountHint[],
  estimatedHints: EstimatedPriceHint[],
): string {
  const lines: string[] = [];

  for (const h of estimatedHints) {
    lines.push(`- ${h.label}: ${h.amount} (출처: ${h.source})`);
  }
  for (const h of baseHints) {
    lines.push(`- ${h.label}: ${h.amount} (출처: ${h.source})`);
  }

  if (lines.length === 0) return "";

  return [
    "=== 첨부 텍스트 자동 추출 힌트 (표·본문 정규식) ===",
    "아래는 원문에서 찾은 금액입니다. **원문 항목명: 금액** 형식으로 공사개요에 반영하세요.",
    "- 대표 금액 1건 → 공사개요[].기초금액",
    "- 그 외 금액 → 공사개요[].비고 (줄마다 원문항목명: 금액)",
    "- 힌트에 없는 금액 항목은 문서에 없는 것으로 간주 (임의 생성 금지)",
    "[금융 정보]",
    ...lines.map((line) => `  * ${line.replace(/^- /, "")}`),
  ].join("\n");
}

/** @deprecated buildFinancialHintPromptBlock 사용 */
export function buildBaseAmountHintPromptBlock(
  hints: BaseAmountHint[],
): string {
  return buildFinancialHintPromptBlock(hints, []);
}

export function pickBestBaseAmountHint(
  hints: BaseAmountHint[],
): BaseAmountHint | null {
  if (hints.length === 0) return null;

  const priority = (label: string) => {
    if (label === "예비가격기초금액") return 0;
    if (label === "추정가격기초금액") return 1;
    if (label === "기초금액") return 2;
    return 3;
  };

  return [...hints].sort(
    (a, b) => priority(a.label) - priority(b.label),
  )[0];
}

export function pickBestEstimatedPriceHint(
  hints: EstimatedPriceHint[],
): EstimatedPriceHint | null {
  if (hints.length === 0) return null;

  return [...hints].sort((a, b) => {
    const aNum = extractNumericWonAmount(a.amount) ?? 0;
    const bNum = extractNumericWonAmount(b.amount) ?? 0;
    return bNum - aNum;
  })[0];
}

function findLabeledAmountInOverview(
  row: OrderReportSummaryData["공사개요"][number],
  label: string,
): { field: "기초금액" | "비고"; amount: string } | null {
  const baseParsed = parseLabelValueLine(row.기초금액);
  if (baseParsed?.label === label) {
    return { field: "기초금액", amount: baseParsed.value };
  }

  for (const line of row.비고.split("\n")) {
    const parsed = parseLabelValueLine(line.trim());
    if (parsed?.label === label) {
      return { field: "비고", amount: parsed.value };
    }
  }

  return null;
}

function removeLabeledAmountFromRemarks(remarks: string, label: string): string {
  const labelPattern = new RegExp(
    `^\\s*${escapeRegExp(label)}\\s*:[^\\n]*\\n?`,
    "mu",
  );
  const cleaned = remarks.replace(labelPattern, "").trim();
  return cleaned || "미기재";
}

function upsertLabeledAmountInRemarks(
  remarks: string,
  label: string,
  amount: string,
): string {
  const line = `${label}: ${amount}`;
  const labelPattern = new RegExp(
    `${escapeRegExp(label)}\\s*:[^\\n]*`,
    "u",
  );
  if (labelPattern.test(remarks)) {
    return remarks.replace(labelPattern, line);
  }
  if (!remarks || remarks === "미기재") return line;
  return `${line}\n${remarks}`;
}

/** 첨부 텍스트 힌트가 있으면 Gemini 결과보다 우선 적용 */
export function applyFinancialHints(
  summary: OrderReportSummaryData,
  baseHints: BaseAmountHint[],
  estimatedHints: EstimatedPriceHint[] = [],
): OrderReportSummaryData {
  const bestBase = pickBestBaseAmountHint(baseHints);
  const bestEstimated = pickBestEstimatedPriceHint(estimatedHints);

  if (!bestBase && !bestEstimated) return summary;

  const 공사개요 = summary.공사개요.map((row, index) => {
    if (index > 0) return row;
    let { 기초금액, 비고 } = row;

    if (bestBase) {
      const existing = findLabeledAmountInOverview(
        { ...row, 기초금액, 비고 },
        bestBase.label,
      );
      const existingNum = existing
        ? extractNumericWonAmount(existing.amount)
        : null;
      const hintNum = extractNumericWonAmount(bestBase.amount);

      if (
        existing == null ||
        hintNum == null ||
        existingNum == null ||
        hintNum >= existingNum
      ) {
        기초금액 = `${bestBase.label}: ${bestBase.amount}`;
        if (existing?.field === "비고") {
          비고 = removeLabeledAmountFromRemarks(비고, bestBase.label);
        }
      }
    }

    if (bestEstimated) {
      const existing = findLabeledAmountInOverview(
        { ...row, 기초금액, 비고 },
        bestEstimated.label,
      );
      const existingNum = existing
        ? extractNumericWonAmount(existing.amount)
        : null;
      const hintNum = extractNumericWonAmount(bestEstimated.amount);

      const shouldApply =
        hintNum != null &&
        (existingNum == null || hintNum >= existingNum) &&
        existing?.field !== "기초금액";

      if (shouldApply) {
        비고 = upsertLabeledAmountInRemarks(
          비고,
          bestEstimated.label,
          bestEstimated.amount,
        );
      }
    }

    return dedupeOverviewFinancialFields({ ...row, 기초금액, 비고 });
  });

  return { ...summary, 공사개요 };
}

/** @deprecated applyFinancialHints 사용 */
export function applyBaseAmountHints(
  summary: OrderReportSummaryData,
  hints: BaseAmountHint[],
): OrderReportSummaryData {
  return applyFinancialHints(summary, hints);
}
