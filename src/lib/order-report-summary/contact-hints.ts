/** 첨부 텍스트에서 계약·기술 담당자 추출 (LLM 보조·후처리) */

import { preprocessAttachmentTextForHints } from "@/lib/order-report-summary/text-hints";
import type {
  OrderReportSummaryContact,
  OrderReportSummaryData,
} from "@/lib/order-report-summary/types";
import { EMPTY_SUMMARY_VALUE } from "@/lib/order-report-summary/types";

export interface ContactHint extends OrderReportSummaryContact {
  source: string;
}

function hasContactValue(contact: OrderReportSummaryContact): boolean {
  return [contact.부서, contact.이름, contact.연락처].some(
    (value) => value.trim() && value !== EMPTY_SUMMARY_VALUE,
  );
}

function normalizeRole(role: string): string {
  const trimmed = role.trim();
  if (/기술/.test(trimmed)) return "기술담당";
  if (/계약/.test(trimmed)) return "계약담당";
  return trimmed || "담당자";
}

function pushHint(
  hints: ContactHint[],
  seen: Set<string>,
  hint: Omit<ContactHint, "source"> & { source: string },
): void {
  const key = `${hint.구분}::${hint.이름}::${hint.연락처}`;
  if (!hasContactValue(hint) || seen.has(key)) return;
  seen.add(key);
  hints.push(hint);
}

function extractInquiryContacts(text: string, source: string): ContactHint[] {
  const hints: ContactHint[] = [];
  const seen = new Set<string>();

  const inquiryPattern =
    /(계약|기술)\s*(?:관련)?\s*문의\s*[:：]?\s*([가-힣]{2,5})\s*[\(（]?\s*([0-9][0-9\-]{6,})[\)）]?/gu;
  for (const match of text.matchAll(inquiryPattern)) {
    const role = match[1] ?? "";
    const name = match[2]?.trim() ?? "";
    const phone = match[3]?.trim() ?? "";
    if (!name) continue;
    pushHint(hints, seen, {
      구분: normalizeRole(role),
      부서: EMPTY_SUMMARY_VALUE,
      이름: name,
      연락처: phone || EMPTY_SUMMARY_VALUE,
      source,
    });
  }

  return hints;
}

function extractNamedManagerContacts(text: string, source: string): ContactHint[] {
  const hints: ContactHint[] = [];
  const seen = new Set<string>();

  const managerPattern =
    /(?:본건\s*)?(계약|기술)\s*(?:사항\s*)?담당자(?:는)?\s*([^\n.입니다]{4,80})/gu;
  for (const match of text.matchAll(managerPattern)) {
    const role = normalizeRole(match[1] ?? "");
    const body = (match[2] ?? "").trim();
    if (!body) continue;

    const phoneMatch = body.match(/([0-9]{2,4}[-\s]?[0-9]{3,4}[-\s]?[0-9]{4})/);
    const phone = phoneMatch?.[1]?.replace(/\s+/g, "") ?? EMPTY_SUMMARY_VALUE;
    const nameMatch = body.match(/([가-힣]{2,5})(?:입니다|\(|$)/);
    const name = nameMatch?.[1] ?? EMPTY_SUMMARY_VALUE;

    let dept = body;
    if (name !== EMPTY_SUMMARY_VALUE) {
      dept = dept.replace(name, "").trim();
    }
    if (phone !== EMPTY_SUMMARY_VALUE) {
      dept = dept.replace(phone, "").replace(/[\(（\)）]/g, "").trim();
    }
    dept = dept.replace(/입니다\.?$/, "").trim() || EMPTY_SUMMARY_VALUE;

    pushHint(hints, seen, {
      구분: role,
      부서: dept,
      이름: name,
      연락처: phone,
      source,
    });
  }

  return hints;
}

export function extractContactHintsFromText(
  text: string,
  source = "첨부",
): ContactHint[] {
  if (!text.trim()) return [];

  const processed = preprocessAttachmentTextForHints(text);
  const hints = [
    ...extractInquiryContacts(processed, source),
    ...extractNamedManagerContacts(processed, source),
  ];

  const byRole = new Map<string, ContactHint>();
  for (const hint of hints) {
    const existing = byRole.get(hint.구분);
    if (!existing || hint.연락처 !== EMPTY_SUMMARY_VALUE) {
      byRole.set(hint.구분, hint);
    }
  }

  return [...byRole.values()];
}

export function extractContactHintsFromTexts(
  sources: Array<{ fileName: string; text: string }>,
): ContactHint[] {
  const hints: ContactHint[] = [];
  const seen = new Set<string>();

  for (const { fileName, text } of sources) {
    for (const hint of extractContactHintsFromText(text, fileName)) {
      const key = `${hint.구분}::${hint.이름}::${hint.연락처}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push(hint);
    }
  }

  return hints;
}

export function buildContactHintPromptBlock(hints: ContactHint[]): string {
  if (hints.length === 0) return "";

  return [
    "=== 첨부 텍스트 자동 추출 힌트 (발주자 담당자) ===",
    "문서에 계약담당·기술담당이 **별도로** 있으면 담당자 배열에 각각 기록하세요.",
    "- 구분: 계약담당, 기술담당 (문서 표기를 따름)",
    "- 동일 인물이면 1건만, 역할이 다르면 모두 포함",
    ...hints.map(
      (hint) =>
        `  * [${hint.구분}] 부서: ${hint.부서}, 이름: ${hint.이름}, 연락처: ${hint.연락처} (출처: ${hint.source})`,
    ),
  ].join("\n");
}

function contactScore(contact: OrderReportSummaryContact): number {
  let score = 0;
  if (contact.이름 !== EMPTY_SUMMARY_VALUE) score += 2;
  if (contact.연락처 !== EMPTY_SUMMARY_VALUE) score += 2;
  if (contact.부서 !== EMPTY_SUMMARY_VALUE) score += 1;
  return score;
}

function mergeContact(
  existing: OrderReportSummaryContact,
  hint: ContactHint,
): OrderReportSummaryContact {
  return {
    구분: existing.구분 !== EMPTY_SUMMARY_VALUE ? existing.구분 : hint.구분,
    부서:
      existing.부서 !== EMPTY_SUMMARY_VALUE ? existing.부서 : hint.부서,
    이름:
      existing.이름 !== EMPTY_SUMMARY_VALUE ? existing.이름 : hint.이름,
    연락처:
      existing.연락처 !== EMPTY_SUMMARY_VALUE
        ? existing.연락처
        : hint.연락처,
  };
}

function findMatchingContact(
  contacts: OrderReportSummaryContact[],
  hint: ContactHint,
): OrderReportSummaryContact | undefined {
  return contacts.find((contact) => {
    if (contact.구분 === hint.구분) return true;
    if (
      hint.이름 !== EMPTY_SUMMARY_VALUE &&
      contact.이름 === hint.이름
    ) {
      return true;
    }
    return false;
  });
}

/** 첨부 텍스트 힌트로 누락된 담당자 보완 */
export function applyContactHints(
  summary: OrderReportSummaryData,
  hints: ContactHint[],
): OrderReportSummaryData {
  if (hints.length === 0) return summary;

  const contacts = [...summary.담당자];

  for (const hint of hints) {
    const matched = findMatchingContact(contacts, hint);
    if (matched) {
      const index = contacts.indexOf(matched);
      contacts[index] = mergeContact(matched, hint);
      continue;
    }

    contacts.push({
      구분: hint.구분,
      부서: hint.부서,
      이름: hint.이름,
      연락처: hint.연락처,
    });
  }

  const deduped = new Map<string, OrderReportSummaryContact>();
  for (const contact of contacts) {
    if (!hasContactValue(contact)) continue;
    const key = contact.구분 || contact.이름;
    const existing = deduped.get(key);
    if (!existing || contactScore(contact) > contactScore(existing)) {
      deduped.set(key, contact);
    }
  }

  const 담당자 = [...deduped.values()].sort((a, b) =>
    a.구분.localeCompare(b.구분, "ko"),
  );

  return { ...summary, 담당자 };
}
