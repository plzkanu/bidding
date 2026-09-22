import type {
  OrderReportSummaryData,
  OrderReportSummaryOverviewRow,
  OrderReportSummarySubTable,
} from "@/lib/order-report-summary/types";
import { getEffectiveScheduleSteps } from "@/lib/order-report-summary/schedule-flow";
import type { OrderReportSummaryScheduleStep } from "@/lib/order-report-summary/types";
import { sortAndRefineQualificationRows } from "@/lib/order-report-summary/qualification-format";
import { ORDER_REPORT_SUMMARY_SECTIONS } from "@/lib/order-report-summary/sections";
import { extractProjectCategoryFromTitle } from "@/lib/order-report-summary/project-category";
import {
  deduplicateOverviewDisplayRows,
  hasDisplayableSummaryValue,
  partitionOverviewRemarks,
  toOverviewBaseAmountRow,
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
  projectCategory?: string;
  footnotes?: string;
  scheduleSteps?: OrderReportSummaryScheduleStep[];
}

const hasSummaryValue = hasDisplayableSummaryValue;

function isEstimatedPriceLabel(label: string): boolean {
  return /추정\s*가격|추정가/.test(label) && !/기초/.test(label);
}

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

function buildProjectCategory(summary: OrderReportSummaryData): string {
  if (hasSummaryValue(summary.분류)) {
    return summary.분류.trim();
  }
  return extractProjectCategoryFromTitle(
    ...summary.공사개요.map((row) => row.공사명),
    summary.공고명,
    buildProjectName(summary),
  );
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
    if (hasSummaryValue(row.입찰방법)) {
      rows.push({ label: `${prefix}입찰방법`, value: row.입찰방법 });
    }

    const remarks = partitionOverviewRemarks(row.비고, prefix);
    const estimatedRows = remarks.rows.filter((item) =>
      isEstimatedPriceLabel(item.label),
    );
    const otherRemarkRows = remarks.rows.filter(
      (item) => !isEstimatedPriceLabel(item.label),
    );

    rows.push(...estimatedRows);

    const amountRow = toOverviewBaseAmountRow(row.기초금액, prefix);
    if (amountRow) {
      rows.push(amountRow);
    }

    rows.push(...otherRemarkRows);

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

    if (hasSummaryValue(remarks.footnotes)) {
      footnoteLines.push(remarks.footnotes);
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

export function buildQualificationRows(
  summary: OrderReportSummaryData,
): SummaryPreviewRow[] {
  return sortAndRefineQualificationRows(summary.신청자격)
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
      projectCategory: buildProjectCategory(summary),
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
