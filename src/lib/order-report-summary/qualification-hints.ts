/** 첨부 텍스트에서 신청자격·참가제한 조항 추출 (LLM 보조·후처리) */

import { preprocessAttachmentTextForHints } from "@/lib/order-report-summary/text-hints";
import { sanitizeMultilineSummaryText } from "@/lib/order-report-summary/text-sanitize";
import type {
  OrderReportSummaryData,
  OrderReportSummaryQualificationRow,
} from "@/lib/order-report-summary/types";
import { EMPTY_SUMMARY_VALUE } from "@/lib/order-report-summary/types";

export interface QualificationHint {
  category: string;
  line: string;
  source: string;
}

const CATEGORY_RULES: ReadonlyArray<{
  category: string;
  patterns: RegExp[];
}> = [
  {
    category: "면허·등록",
    patterns: [
      /면허/,
      /등록.*사업/,
      /사업자(?:로)?\s*등록/,
      /정보통신공사/,
      /소프트웨어\s*사업자/,
      /전기공사/,
      /건설업/,
    ],
  },
  {
    category: "실적",
    patterns: [/실적/, /준공/, /용역\s*이행/, /유사\s*용역/, /공사\s*실적/],
  },
  {
    category: "지역제한",
    patterns: [/지역\s*제한/, /관내/, /관할/, /해당\s*지역/],
  },
  {
    category: "PQ·서류",
    patterns: [/PQ/, /서류\s*심사/, /제안서\s*평가/, /기술\s*평가/],
  },
  {
    category: "신인도",
    patterns: [/신인도/, /지급실적/, /이행평가/, /평가\s*등급/],
  },
  {
    category: "기업규모",
    patterns: [
      /대기업/,
      /중소기업/,
      /중견기업/,
      /매출액/,
      /사업금액의\s*하한/,
      /참여(?:할\s*수\s*있는)?\s*사업/,
    ],
  },
  {
    category: "공동·하도급",
    patterns: [/공동\s*계약/, /공동\s*수급/, /하도급/, /분담\s*이행/],
  },
  {
    category: "참가제한",
    patterns: [
      /참여(?:할\s*수\s*)?없/,
      /참가(?:할\s*수\s*)?없/,
      /제한된\s*자/,
      /부정당업자/,
      /조세포탈/,
      /상호출자/,
      /결격/,
      /퇴출/,
      /제재/,
    ],
  },
];

const SECTION_HEADING =
  /(?:입찰\s*참가\s*자격|신청\s*자격|참가\s*자격|자격\s*요건|입찰\s*참가\s*신청\s*자격)/u;

const NEXT_MAJOR_SECTION =
  /^\s*(?:[0-9]+\s*[\.\)]\s*)?(?:공동\s*계약|하도급|입찰\s*보증|입찰\s*보증금|제출\s*서류|계약\s*방법|개찰|낙찰|입찰\s*방법|입찰에\s*부치는\s*사항)/u;

const ITEM_LINE_START =
  /^(?:[●○◦·ㆍ\-\*•※]|\((?:가|나|다|라|마|바|사|아|자|차|카|타|파|하)\)|(?:가|나|다|라|마|바|사|아|자|차|카|타|파|하)\.|\d+\.\d+)/u;

const LAW_REFERENCE = /「[^」]+」/u;

function classifyQualificationLine(line: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(line))) {
      return rule.category;
    }
  }
  return "기타";
}

function cleanQualificationLine(line: string): string {
  return line
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[·ㆍ○●◦\-•*\s]+/, "")
    .trim();
}

function isQualificationSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return SECTION_HEADING.test(trimmed);
}

const EXCLUDE_LINE_PATTERNS = [
  /용역\s*대상/,
  /업무\s*내용/,
  /대상설비\s*:/,
  /용역\s*기간/,
  /용역\s*범위/,
  /사업\s*개요/,
  /추진\s*배경/,
  /^\d+\.\d+\s+[^「「]+:/u,
  /^※\s*[A-Z]/,
  /발전소\s*:/,
  /ICT\s*설비/,
  /제어시스템\s*정보보안\s*업무/,
  /제안서/,
  /견적서/,
  /산출내역서/,
  /제출파일/,
  /기타서류/,
];

const SECTION_END_KEYWORDS = [
  /제안서\s*제출/,
  /입찰서\s*제출/,
  /제출\s*서류/,
  /제출\s*방법/,
  /평가\s*방법/,
];

function isExcludedQualificationLine(line: string): boolean {
  return EXCLUDE_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function isStrongGlobalQualificationLine(line: string): boolean {
  const trimmed = cleanQualificationLine(line);
  if (trimmed.length < 12 || isExcludedQualificationLine(trimmed)) return false;

  return (
    /입찰참가자격|참가자격|자격을\s*충족|사업금액의\s*하한/.test(trimmed) ||
    (/「.+」/.test(trimmed) &&
      /(법|령|시행령|시행규칙|고시|규정|지침)/.test(trimmed) &&
      /(참가|참여|제한|등록|실적|면허|자격)/.test(trimmed))
  );
}
function isQualificationContentLine(line: string): boolean {
  const trimmed = cleanQualificationLine(line);
  if (trimmed.length < 8 || isExcludedQualificationLine(trimmed)) return false;
  if (NEXT_MAJOR_SECTION.test(trimmed)) return false;
  if (SECTION_HEADING.test(trimmed) && trimmed.length < 40) return false;

  return (
    ITEM_LINE_START.test(trimmed) ||
    LAW_REFERENCE.test(trimmed) ||
    /입찰참가자격|참가자격|자격을\s*충족|사업금액의\s*하한/.test(trimmed) ||
    (/「.+」/.test(trimmed) &&
      /(법|령|시행령|시행규칙|고시|규정|지침)/.test(trimmed))
  );
}

function isUsefulQualificationHint(hint: QualificationHint): boolean {
  if (hint.category !== "기타") return true;
  return /(자격|참가|참여|등록|면허|실적|제한|법|령|고시|하한|대기업|중소)/u.test(
    hint.line,
  );
}

function normalizeLineKey(line: string): string {
  return line
    .replace(/\s+/g, "")
    .replace(/[·ㆍ●○◦\-•*]/g, "")
    .toLowerCase();
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const cleaned = cleanQualificationLine(line);
    if (!cleaned) continue;
    const key = normalizeLineKey(cleaned);
    if (key.length < 6 || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function extractEnterpriseScaleTable(lines: string[], source: string): QualificationHint[] {
  const hints: QualificationHint[] = [];
  const start = lines.findIndex((line) => /구\s*분/u.test(line) && /하한/u.test(line));
  if (start < 0) return hints;

  for (let i = start + 1; i < Math.min(lines.length, start + 12); i += 1) {
    const row = lines[i]?.trim() ?? "";
    if (!row || NEXT_MAJOR_SECTION.test(row)) break;

    const cols = row.includes("\t")
      ? row.split("\t").map((col) => col.trim()).filter(Boolean)
      : row.split(/\s{2,}/).map((col) => col.trim()).filter(Boolean);

    if (cols.length >= 2) {
      const label = cols[0];
      const value = cols.slice(1).join(" ");
      if (label && value && /억|원|대기업|중소|중견/.test(`${label}${value}`)) {
        hints.push({
          category: "기업규모",
          line: `${label}: ${value}`,
          source,
        });
      }
    }
  }

  return hints;
}

function extractQualificationLinesFromText(
  text: string,
  source: string,
): QualificationHint[] {
  if (!text.trim()) return [];

  const processed = preprocessAttachmentTextForHints(text);
  const lines = processed.split("\n");
  const captured: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (isQualificationSectionHeading(trimmed)) {
      inSection = true;
      continue;
    }

    if (inSection && SECTION_END_KEYWORDS.some((pattern) => pattern.test(trimmed))) {
      inSection = false;
    }

    if (inSection && NEXT_MAJOR_SECTION.test(trimmed)) {
      inSection = false;
    }

    if (inSection && isQualificationContentLine(trimmed)) {
      captured.push(trimmed);
      continue;
    }

    if (!inSection && isStrongGlobalQualificationLine(trimmed)) {
      captured.push(trimmed);
    }
  }

  const tableHints = extractEnterpriseScaleTable(lines, source);
  const lineHints = dedupeLines(captured)
    .map((line) => ({
      category: classifyQualificationLine(line),
      line,
      source,
    }))
    .filter(isUsefulQualificationHint);

  return dedupeHints([...lineHints, ...tableHints]);
}

function dedupeHints(hints: QualificationHint[]): QualificationHint[] {
  const seen = new Set<string>();
  const result: QualificationHint[] = [];

  for (const hint of hints) {
    const key = `${hint.category}::${normalizeLineKey(hint.line)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(hint);
  }

  return result;
}

export function extractQualificationHintsFromText(
  text: string,
  source = "첨부",
): QualificationHint[] {
  return extractQualificationLinesFromText(text, source);
}

export function extractQualificationHintsFromTexts(
  sources: Array<{ fileName: string; text: string }>,
): QualificationHint[] {
  const hints: QualificationHint[] = [];

  for (const { fileName, text } of sources) {
    hints.push(...extractQualificationHintsFromText(text, fileName));
  }

  return dedupeHints(hints);
}

export function buildQualificationHintPromptBlock(
  hints: QualificationHint[],
): string {
  if (hints.length === 0) return "";

  const byCategory = new Map<string, QualificationHint[]>();
  for (const hint of hints) {
    const list = byCategory.get(hint.category) ?? [];
    list.push(hint);
    byCategory.set(hint.category, list);
  }

  const sections: string[] = [];
  for (const [category, items] of byCategory) {
    sections.push(
      `[${category}]`,
      ...items.map((item) => `  * ${item.line} (출처: ${item.source})`),
    );
  }

  return [
    "=== 첨부 텍스트 자동 추출 힌트 (신청자격·참가제한) ===",
    "아래는 원문에서 찾은 참가자격·제한 조항입니다. **요약·생략 없이** 신청자격 배열에 반영하세요.",
    "- 문서에 있는 조항을 빠짐없이 기록 (면허·등록, 실적, 기업규모, 참가제한, PQ, 지역제한, 신인도, 공동·하도급, 기타)",
    "- 각 조항은 한 줄씩 \\n 으로 구분. 법령명·수치·기한은 원문 유지",
    "- 힌트에 있는 조항을 LLM 결과에서 누락하지 말 것",
    ...sections,
  ].join("\n");
}

function splitCriteriaLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => cleanQualificationLine(line))
    .filter((line) => line && line !== EMPTY_SUMMARY_VALUE);
}

function mergeCriteriaLines(existing: string, additions: string[]): string {
  const merged = new Set<string>();
  for (const line of splitCriteriaLines(existing)) {
    merged.add(normalizeLineKey(line));
  }

  const lines = splitCriteriaLines(existing);
  for (const addition of additions) {
    const key = normalizeLineKey(addition);
    if (!key || merged.has(key)) continue;
    merged.add(key);
    lines.push(addition);
  }

  return lines.join("\n");
}

function hintsToRows(hints: QualificationHint[]): OrderReportSummaryQualificationRow[] {
  const byCategory = new Map<string, string[]>();

  for (const hint of hints) {
    const list = byCategory.get(hint.category) ?? [];
    list.push(hint.line);
    byCategory.set(hint.category, list);
  }

  return [...byCategory.entries()].map(([구분, lines]) => ({
    구분,
    기준: dedupeLines(lines).join("\n"),
  }));
}

/** 첨부 텍스트 힌트로 LLM이 누락한 신청자격 조항 보완 */
export function applyQualificationHints(
  summary: OrderReportSummaryData,
  hints: QualificationHint[],
): OrderReportSummaryData {
  if (hints.length === 0) return summary;

  const hintRows = hintsToRows(hints);
  if (hintRows.length === 0) return summary;

  const existingRows = summary.신청자격.filter(
    (row) => row.기준 !== EMPTY_SUMMARY_VALUE,
  );
  const mergedByCategory = new Map<string, OrderReportSummaryQualificationRow>();

  for (const row of existingRows) {
    mergedByCategory.set(row.구분, {
      구분: row.구분,
      기준: sanitizeMultilineSummaryText(row.기준),
    });
  }

  for (const hintRow of hintRows) {
    const matchedKey =
      [...mergedByCategory.keys()].find(
        (category) =>
          category === hintRow.구분 ||
          category.includes(hintRow.구분) ||
          hintRow.구분.includes(category),
      ) ?? hintRow.구분;

    const current = mergedByCategory.get(matchedKey);
    const additions = splitCriteriaLines(hintRow.기준);

    if (!current) {
      mergedByCategory.set(hintRow.구분, {
        구분: hintRow.구분,
        기준: hintRow.기준,
      });
      continue;
    }

    mergedByCategory.set(matchedKey, {
      구분: current.구분,
      기준: mergeCriteriaLines(current.기준, additions),
    });
  }

  const 신청자격 = [...mergedByCategory.values()].filter(
    (row) => splitCriteriaLines(row.기준).length > 0,
  );

  return {
    ...summary,
    신청자격,
  };
}
