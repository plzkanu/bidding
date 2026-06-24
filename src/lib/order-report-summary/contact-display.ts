/** 발주자 담당자 표시용 포맷 */

import {
  EMPTY_SUMMARY_VALUE,
  type OrderReportSummaryContact,
} from "@/lib/order-report-summary/types";
import { hasDisplayableSummaryValue } from "@/lib/order-report-summary/overview-display";

export function hasContactDisplayValue(
  contact: OrderReportSummaryContact,
): boolean {
  return [contact.부서, contact.이름, contact.연락처].some(
    hasDisplayableSummaryValue,
  );
}

export function formatContactLabel(contact: OrderReportSummaryContact): string {
  if (hasDisplayableSummaryValue(contact.구분)) return contact.구분;
  return "담당자";
}

export function formatContactValue(contact: OrderReportSummaryContact): string {
  const lines: string[] = [];

  if (hasDisplayableSummaryValue(contact.부서)) {
    lines.push(contact.부서);
  }

  if (hasDisplayableSummaryValue(contact.이름)) {
    if (hasDisplayableSummaryValue(contact.연락처)) {
      lines.push(`${contact.이름} (${contact.연락처})`);
    } else {
      lines.push(contact.이름);
    }
  } else if (hasDisplayableSummaryValue(contact.연락처)) {
    lines.push(contact.연락처);
  }

  return lines.join("\n") || EMPTY_SUMMARY_VALUE;
}
