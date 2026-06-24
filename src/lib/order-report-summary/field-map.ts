import type {
  OrderReportSummaryData,
  OrderReportSummaryOverviewRow,
  OrderReportSummarySubTable,
} from "@/lib/order-report-summary/types";
import { getEffectiveScheduleSteps } from "@/lib/order-report-summary/schedule-flow";
import type { OrderReportSummaryScheduleStep } from "@/lib/order-report-summary/types";
import { ORDER_REPORT_SUMMARY_SECTIONS } from "@/lib/order-report-summary/sections";
import {
  deduplicateOverviewDisplayRows,
  formatOverviewBaseAmountForDocx,
  hasDisplayableSummaryValue,
  toOverviewRemarkRows,
} from "@/lib/order-report-summary/overview-display";

export interface SummaryPreviewRow {
  label: string;
  value: string;
}

export interface SummaryPreviewSubTable {
  title: string;
  headers: string[];
  rows: string[][];
  note?: string;
}

export interface SummaryPreviewSection {
  id: string;
  title: string;
  description: string;
  rows: SummaryPreviewRow[];
  subTables?: SummaryPreviewSubTable[];
  projectName?: string;
  footnotes?: string;
  scheduleSteps?: OrderReportSummaryScheduleStep[];
}

const hasSummaryValue = hasDisplayableSummaryValue;

function resolveOrderer(
  row: OrderReportSummaryOverviewRow,
  fallback: string,
): string {
  if (hasSummaryValue(row.발주자)) return row.발주자;
  if (hasSummaryValue(fallback)) return fallback;
  return "";
}

function toSubTablePreview(
  table: OrderReportSummarySubTable,
): SummaryPreviewSubTable | null {
  if (
    !hasSummaryValue(table.제목) &&
    table.헤더.length === 0 &&
    table.행.length === 0
  ) {
    return null;
  }

  return {
    title: table.제목,
    headers: table.헤더,
    rows: table.행,
    ...(table.비고 && hasSummaryValue(table.비고)
      ? { note: table.비고 }
      : {}),
  };
}

function buildProjectName(summary: OrderReportSummaryData): string {
  const first = summary.공사개요[0];
  if (first && hasSummaryValue(first.공사명)) {
    return first.공사명;
  }
  if (hasSummaryValue(summary.공고명)) {
    return summary.공고명;
  }
  return "";
}

function buildOverviewSection(
  summary: OrderReportSummaryData,
): SummaryPreviewSection {
  const sectionMeta = ORDER_REPORT_SUMMARY_SECTIONS.find(
    (section) => section.id === "overview",
  )!;
  const rows: SummaryPreviewRow[] = [];
  const subTables: SummaryPreviewSubTable[] = [];
  const footnoteLines: string[] = [];
  const multiRow = summary.공사개요.length > 1;

  for (const row of summary.공사개요) {
    const prefix = multiRow && hasSummaryValue(row.공사명) ? `${row.공사명} · ` : "";
    const orderer = resolveOrderer(row, summary.발주기관);
    if (orderer) {
      rows.push({ label: `${prefix}발주자`, value: orderer });
    }

    const amount = formatOverviewBaseAmountForDocx(row.기초금액);
    if (amount) {
      rows.push({ label: `${prefix}기초금액`, value: amount });
    }
    if (hasSummaryValue(row.공사기간)) {
      rows.push({ label: `${prefix}공사기간`, value: row.공사기간 });
    }
    if (hasSummaryValue(row.공사내용)) {
      rows.push({ label: `${prefix}공사내용`, value: row.공사내용 });
    }

    for (const table of row.표) {
      const preview = toSubTablePreview(table);
      if (preview) subTables.push(preview);
    }

    if (hasSummaryValue(row.비고)) {
      const trimmed = row.비고.trim();
      if (
        trimmed.startsWith("※") ||
        row.표.length > 0 ||
        hasSummaryValue(row.공사내용)
      ) {
        footnoteLines.push(row.비고);
      } else {
        rows.push(...toOverviewRemarkRows(row.비고, prefix));
      }
    }
  }

  return {
    id: "overview",
    title: sectionMeta.title,
    description: sectionMeta.description,
    rows: deduplicateOverviewDisplayRows(rows),
    subTables,
    footnotes: footnoteLines.join("\n") || undefined,
  };
}

function buildQualificationRows(
  summary: OrderReportSummaryData,
): SummaryPreviewRow[] {
  return summary.신청자격
    .filter((row) => hasSummaryValue(row.기준))
    .map((row) => ({
      label: hasSummaryValue(row.구분) ? row.구분 : "자격요건",
      value: row.기준,
    }));
}

/** 요약 JSON에서 미리보기 섹션 구성 (I~IV 양식) */
export function buildSummaryPreviewSections(
  summary: OrderReportSummaryData | null,
  options?: { keepAllSections?: boolean },
): SummaryPreviewSection[] {
  if (!summary) {
    return ORDER_REPORT_SUMMARY_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      rows: [],
    }));
  }

  const projectName = buildProjectName(summary);
  const overview = buildOverviewSection(summary);
  const scheduleMeta = ORDER_REPORT_SUMMARY_SECTIONS.find(
    (section) => section.id === "schedule",
  )!;
  const qualificationMeta = ORDER_REPORT_SUMMARY_SECTIONS.find(
    (section) => section.id === "qualification",
  )!;
  const projectMeta = ORDER_REPORT_SUMMARY_SECTIONS.find(
    (section) => section.id === "project_name",
  )!;

  const sections: SummaryPreviewSection[] = [
    {
      id: "project_name",
      title: projectMeta.title,
      description: projectMeta.description,
      rows: [],
      projectName,
    },
    overview,
    {
      id: "schedule",
      title: scheduleMeta.title,
      description: scheduleMeta.description,
      rows: [],
      scheduleSteps: getEffectiveScheduleSteps(summary.주요일정),
    },
    {
      id: "qualification",
      title: qualificationMeta.title,
      description: qualificationMeta.description,
      rows: buildQualificationRows(summary),
    },
  ];

  if (options?.keepAllSections) {
    return sections;
  }

  return sections.filter((section) => {
    if (section.id === "schedule") return true;
    if (section.id === "project_name") {
      return hasSummaryValue(section.projectName ?? "");
    }
    if (section.id === "overview") {
      return (
        section.rows.length > 0 ||
        (section.subTables?.length ?? 0) > 0 ||
        hasSummaryValue(section.footnotes ?? "")
      );
    }
    return section.rows.length > 0;
  });
}
