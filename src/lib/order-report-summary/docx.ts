import {

  AlignmentType,

  BorderStyle,

  Document,

  HeadingLevel,

  Packer,

  PageBreak,

  Paragraph,

  ShadingType,

  Table,

  TableCell,

  TableRow,

  TextRun,

  VerticalAlign,

  WidthType,

  type FileChild,

  type IRunOptions,

} from "docx";

import type { KhnpBidNoticeRow } from "@/lib/bid-notices/types";

import type {

  OrderReportPqAutoSummary,
  OrderReportSummaryData,

  OrderReportSummaryOverviewRow,

  OrderReportSummaryQualificationRow,

  OrderReportSummaryScheduleStep,
  OrderReportSummarySubTable,

} from "@/lib/order-report-summary/types";

import {
  dedupeOverviewFinancialFields,
  formatOverviewBaseAmountForDocx,
  hasDisplayableSummaryValue,
} from "@/lib/order-report-summary/overview-display";
import { normalizeScheduleFlowSteps, getEffectiveScheduleSteps } from "@/lib/order-report-summary/schedule-flow";
import { sanitizeMultilineSummaryText } from "@/lib/order-report-summary/text-sanitize";
import { EMPTY_SUMMARY_VALUE } from "@/lib/order-report-summary/types";



const PAGE_WIDTH = 11906;

const PAGE_HEIGHT = 16838;

const PAGE_MARGIN = 1440;

const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;



const FONT = "Malgun Gothic";

const FONT_SIZE_BODY = 20;

const FONT_SIZE_SMALL = 18;

const COLOR_HEADER_BLUE = "2E74B5";

const COLOR_WHITE = "FFFFFF";

const COLOR_ZEBRA_GRAY = "F2F2F2";

const COLOR_LABEL_GRAY = "E7E6E6";

const COLOR_BORDER = "BFBFBF";

const COLOR_TEXT_BLUE = "2E74B5";


const CELL_MARGIN = {

  marginUnitType: WidthType.DXA,

  top: 60,

  bottom: 60,

  left: 100,

  right: 100,

} as const;



const CELL_BORDER = {

  top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },

  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },

  left: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },

  right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },

} as const;



const NO_BORDER = {

  top: { style: BorderStyle.NIL, size: 0, color: COLOR_WHITE },

  bottom: { style: BorderStyle.NIL, size: 0, color: COLOR_WHITE },

  left: { style: BorderStyle.NIL, size: 0, color: COLOR_WHITE },

  right: { style: BorderStyle.NIL, size: 0, color: COLOR_WHITE },

} as const;



const LABEL_COLUMN_WIDTH = 3200;

function summaryTableCellText(value: string): string {
  return hasDisplayableSummaryValue(value) ? value : "";
}

const VALUE_COLUMN_WIDTH = CONTENT_WIDTH - LABEL_COLUMN_WIDTH;



function malgunRun(text: string, options: Partial<IRunOptions> = {}): TextRun {
  return new TextRun({
    text: sanitizeMultilineSummaryText(text),
    font: {
      name: FONT,
      hint: "eastAsia",
    },
    size: FONT_SIZE_BODY,
    ...options,
  });
}



function clearShading(fill: string, color = COLOR_WHITE) {

  return {

    fill,

    color,

    type: ShadingType.CLEAR,

  } as const;

}



function cellWidth(size: number) {

  return { size, type: WidthType.DXA } as const;

}



function singleParagraph(

  text: string,

  options: {

    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];

    bold?: boolean;

    color?: string;

    size?: number;

    keepLines?: boolean;

  } = {},

): Paragraph {

  return new Paragraph({

    alignment: options.alignment ?? AlignmentType.LEFT,

    spacing: { before: 0, after: 0 },

    keepLines: options.keepLines ?? false,

    children: [

      malgunRun(text, {

        bold: options.bold,

        color: options.color,

        size: options.size ?? FONT_SIZE_BODY,

      }),

    ],

  });

}



function multiLineParagraphs(

  text: string,

  options: {

    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];

    size?: number;

    lineSpacingAfter?: number;

  } = {},

): Paragraph[] {

  const lines = text

    .split(/\r?\n/u)

    .map((line) => line.trim())

    .filter(Boolean);

  const alignment = options.alignment ?? AlignmentType.LEFT;

  const lineSpacingAfter = options.lineSpacingAfter ?? 20;



  if (lines.length === 0) {

    return [singleParagraph(EMPTY_SUMMARY_VALUE, { alignment })];

  }



  return lines.map((line, index) =>

    new Paragraph({

      alignment,

      spacing: {

        before: 0,

        after: index < lines.length - 1 ? lineSpacingAfter : 0,

      },

      children: [

        malgunRun(line, { size: options.size ?? FONT_SIZE_BODY }),

      ],

    }),

  );

}



function romanSectionHeading(numeral: string, title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    children: [
      malgunRun(`${numeral}. `, { bold: true, size: 24, color: COLOR_HEADER_BLUE }),
      malgunRun(title, { bold: true, size: 24 }),
    ],
  });
}

function projectNameParagraph(name: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [malgunRun(name, { bold: true, size: 24 })],
  });
}

function footnoteParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 0 },
    children: [
      malgunRun(text, { size: FONT_SIZE_SMALL, color: COLOR_TEXT_BLUE }),
    ],
  });
}

function footnoteParagraphs(text: string): Paragraph[] {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => footnoteParagraph(line));
}

function buildNestedSubTable(subTable: OrderReportSummarySubTable): Table {
  const columnCount = Math.max(
    subTable.헤더.length,
    ...subTable.행.map((row) => row.length),
    1,
  );
  const columnWidth = Math.floor(CONTENT_WIDTH / columnCount);
  const columnWidths = Array.from({ length: columnCount }, () => columnWidth);

  const headerCells =
    subTable.헤더.length > 0
      ? subTable.헤더.map(
          (label, index) =>
            new TableCell({
              width: cellWidth(columnWidths[index] ?? columnWidth),
              margins: CELL_MARGIN,
              borders: CELL_BORDER,
              shading: clearShading(COLOR_LABEL_GRAY),
              verticalAlign: VerticalAlign.CENTER,
              children: [
                singleParagraph(label, {
                  alignment: AlignmentType.CENTER,
                  bold: true,
                  size: FONT_SIZE_SMALL,
                  keepLines: true,
                }),
              ],
            }),
        )
      : [];

  const bodyRows = subTable.행.map((cells, rowIndex) => {
    const fill = rowIndex % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA_GRAY;
    const padded = Array.from({ length: columnCount }, (_, index) =>
      summaryTableCellText(cells[index] ?? ""),
    );

    return new TableRow({
      children: padded.map((value, colIndex) =>
        new TableCell({
          width: cellWidth(columnWidths[colIndex] ?? columnWidth),
          margins: CELL_MARGIN,
          borders: CELL_BORDER,
          shading: clearShading(fill),
          verticalAlign: VerticalAlign.TOP,
          children: multiLineParagraphs(value, {
            alignment: AlignmentType.CENTER,
            size: FONT_SIZE_SMALL,
          }),
        }),
      ),
    });
  });

  const rows: TableRow[] = [];
  if (headerCells.length > 0) {
    rows.push(new TableRow({ children: headerCells }));
  }
  rows.push(...bodyRows);

  return new Table({
    width: cellWidth(CONTENT_WIDTH),
    columnWidths,
    layout: "fixed",
    rows,
  });
}

function resolveOverviewOrderer(
  row: OrderReportSummaryOverviewRow,
  fallback: string,
): string {
  if (hasDisplayableSummaryValue(row.발주자)) return row.발주자;
  if (hasDisplayableSummaryValue(fallback)) return fallback;
  return EMPTY_SUMMARY_VALUE;
}

function buildSampleOverviewTable(
  row: OrderReportSummaryOverviewRow,
  fallbackOrderer: string,
): FileChild[] {
  const overviewRows: Array<{ label: string; value: string; nested?: Table }> =
    [];

  const orderer = resolveOverviewOrderer(row, fallbackOrderer);
  if (hasDisplayableSummaryValue(orderer)) {
    overviewRows.push({ label: "발주자", value: orderer });
  }

  const amount = formatOverviewBaseAmountForDocx(row.기초금액);
  if (amount) {
    overviewRows.push({ label: "기초금액", value: amount });
  }

  if (hasDisplayableSummaryValue(row.공사기간)) {
    overviewRows.push({ label: "공사기간", value: row.공사기간 });
  }

  if (hasDisplayableSummaryValue(row.공사내용)) {
    overviewRows.push({ label: "공사내용", value: row.공사내용 });
  }

  for (const subTable of row.표) {
    if (
      !hasDisplayableSummaryValue(subTable.제목) &&
      subTable.헤더.length === 0 &&
      subTable.행.length === 0
    ) {
      continue;
    }
    overviewRows.push({
      label: subTable.제목,
      value: "",
      nested: buildNestedSubTable(subTable),
    });
  }

  if (overviewRows.length === 0) {
    overviewRows.push({
      label: "공사개요",
      value: EMPTY_SUMMARY_VALUE,
    });
  }

  const table = new Table({
    width: cellWidth(CONTENT_WIDTH),
    columnWidths: [LABEL_COLUMN_WIDTH, VALUE_COLUMN_WIDTH],
    layout: "fixed",
    rows: overviewRows.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              width: cellWidth(LABEL_COLUMN_WIDTH),
              margins: CELL_MARGIN,
              borders: CELL_BORDER,
              shading: clearShading(COLOR_LABEL_GRAY),
              verticalAlign: VerticalAlign.CENTER,
              children: [
                singleParagraph(item.label, {
                  alignment: AlignmentType.CENTER,
                  bold: true,
                  keepLines: true,
                }),
              ],
            }),
            new TableCell({
              width: cellWidth(VALUE_COLUMN_WIDTH),
              margins: CELL_MARGIN,
              borders: CELL_BORDER,
              shading: clearShading(COLOR_WHITE),
              verticalAlign: VerticalAlign.TOP,
              children: item.nested
                ? [item.nested]
                : multiLineParagraphs(item.value),
            }),
          ],
        }),
    ),
  });

  const children: FileChild[] = [table];

  if (hasDisplayableSummaryValue(row.비고)) {
    children.push(...footnoteParagraphs(row.비고));
  }

  return children;
}

function buildBidNoticeSampleSections(
  summary: OrderReportSummaryData,
): FileChild[] {
  const children: FileChild[] = [];
  const overviewRows = summary.공사개요.length > 0 ? summary.공사개요 : [];

  const projectName =
    overviewRows.find((row) => hasDisplayableSummaryValue(row.공사명))?.공사명 ??
    summary.공고명;

  children.push(romanSectionHeading("I", "공사명"));
  children.push(
    projectNameParagraph(
      hasDisplayableSummaryValue(projectName)
        ? projectName
        : EMPTY_SUMMARY_VALUE,
    ),
  );

  children.push(romanSectionHeading("II", "공사개요"));
  if (overviewRows.length === 0) {
    children.push(
      buildLabelValueTable([{ label: "공사개요", value: EMPTY_SUMMARY_VALUE }]),
    );
  } else {
    for (const row of overviewRows) {
      children.push(
        ...buildSampleOverviewTable(row, summary.발주기관),
      );
    }
  }

  children.push(romanSectionHeading("III", "입찰 일정"));
  children.push(buildScheduleFlow(summary.주요일정));

  children.push(romanSectionHeading("IV", "입찰참가자격"));
  children.push(buildQualificationTable(summary.신청자격));

  return children;
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    border: {
      top: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "CCCCCC",
        space: 8,
      },
    },
    children: [malgunRun(title, { bold: true, size: 24 })],
  });
}

function tabHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [malgunRun(title, { bold: true, size: 28, color: COLOR_HEADER_BLUE })],
  });
}

function sourceFilesParagraph(label: string, files: string[]): Paragraph | null {
  if (files.length === 0) return null;
  return new Paragraph({
    spacing: { after: 200 },
    children: [
      malgunRun(`${label}: `, { bold: true, size: FONT_SIZE_SMALL, color: "666666" }),
      malgunRun(files.join(", "), { size: FONT_SIZE_SMALL, color: "666666" }),
    ],
  });
}



function buildLabelValueTable(

  rows: Array<{ label: string; value: string }>,

): Table {

  const bodyRows = rows.map(

    (row) =>

      new TableRow({

        children: [

          new TableCell({

            width: cellWidth(LABEL_COLUMN_WIDTH),

            margins: CELL_MARGIN,

            borders: CELL_BORDER,

            shading: clearShading(COLOR_LABEL_GRAY),

            verticalAlign: VerticalAlign.CENTER,

            children: [

              singleParagraph(row.label, {

                alignment: AlignmentType.CENTER,

                bold: true,

                keepLines: true,

              }),

            ],

          }),

          new TableCell({

            width: cellWidth(VALUE_COLUMN_WIDTH),

            margins: CELL_MARGIN,

            borders: CELL_BORDER,

            shading: clearShading(COLOR_WHITE),

            verticalAlign: VerticalAlign.TOP,

            children: multiLineParagraphs(row.value),

          }),

        ],

      }),

  );



  return new Table({

    width: cellWidth(CONTENT_WIDTH),

    columnWidths: [LABEL_COLUMN_WIDTH, VALUE_COLUMN_WIDTH],

    layout: "fixed",

    rows: bodyRows,

  });

}



function buildScheduleStepCell(
  step: OrderReportSummaryScheduleStep,
  width: number,
): TableCell {
  const dateText =
    step.날짜 && step.날짜 !== EMPTY_SUMMARY_VALUE
      ? step.날짜
      : EMPTY_SUMMARY_VALUE;
  const stepText =
    step.단계 && step.단계 !== EMPTY_SUMMARY_VALUE
      ? step.단계
      : EMPTY_SUMMARY_VALUE;

  return new TableCell({
    width: cellWidth(width),
    margins: CELL_MARGIN,
    borders: CELL_BORDER,
    shading: clearShading(COLOR_LABEL_GRAY),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          malgunRun(dateText, {
            bold: true,
            size: FONT_SIZE_SMALL,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          malgunRun(stepText, {
            size: FONT_SIZE_SMALL,
          }),
        ],
      }),
    ],
  });
}

function buildScheduleFlow(steps: OrderReportSummaryScheduleStep[]): Table {
  const effectiveSteps = getEffectiveScheduleSteps(steps);
  const fallbackSteps =
    effectiveSteps.length > 0
      ? effectiveSteps
      : normalizeScheduleFlowSteps(steps);
  const stepCount = Math.max(fallbackSteps.length, 1);
  const arrowCount = Math.max(stepCount - 1, 0);
  const arrowWidth = 300;
  const stepWidth = Math.floor(
    (CONTENT_WIDTH - arrowCount * arrowWidth) / stepCount,
  );

  const columnWidths: number[] = [];
  const stepCells: TableCell[] = [];

  fallbackSteps.forEach((step, index) => {
    if (index > 0) {
      columnWidths.push(arrowWidth);
      stepCells.push(buildScheduleArrowCell(arrowWidth));
    }

    columnWidths.push(stepWidth);
    stepCells.push(buildScheduleStepCell(step, stepWidth));
  });

  return new Table({
    width: cellWidth(CONTENT_WIDTH),
    columnWidths,
    layout: "fixed",
    rows: [new TableRow({ children: stepCells })],
  });
}



function buildScheduleArrowCell(width: number): TableCell {

  return new TableCell({

    width: cellWidth(width),

    margins: {

      marginUnitType: WidthType.DXA,

      top: 60,

      bottom: 60,

      left: 20,

      right: 20,

    },

    borders: NO_BORDER,

    verticalAlign: VerticalAlign.CENTER,

    children: [

      singleParagraph("▶", {

        alignment: AlignmentType.CENTER,

        bold: true,

        color: COLOR_TEXT_BLUE,

      }),

    ],

  });

}



function buildQualificationTable(
  rows: OrderReportSummaryQualificationRow[],
): Table {
  const effectiveRows =
    rows.length > 0
      ? rows
      : [{ 구분: EMPTY_SUMMARY_VALUE, 기준: EMPTY_SUMMARY_VALUE }];

  const headerRow = new TableRow({
    children: ["구분", "제한내용"].map((label, index) =>
      new TableCell({
        width: cellWidth(
          index === 0 ? LABEL_COLUMN_WIDTH : VALUE_COLUMN_WIDTH,
        ),
        margins: CELL_MARGIN,
        borders: CELL_BORDER,
        shading: clearShading(COLOR_HEADER_BLUE, COLOR_WHITE),
        verticalAlign: VerticalAlign.CENTER,
        children: [
          singleParagraph(label, {
            alignment: AlignmentType.CENTER,
            bold: true,
            color: COLOR_WHITE,
            keepLines: true,
          }),
        ],
      }),
    ),
  });

  const bodyRows = effectiveRows.map(
    (row, rowIndex) =>
      new TableRow({
        children: [
          new TableCell({
            width: cellWidth(LABEL_COLUMN_WIDTH),
            margins: CELL_MARGIN,
            borders: CELL_BORDER,
            shading: clearShading(
              rowIndex % 2 === 0 ? COLOR_LABEL_GRAY : COLOR_ZEBRA_GRAY,
            ),
            verticalAlign: VerticalAlign.CENTER,
            children: [
              singleParagraph(row.구분, {
                alignment: AlignmentType.CENTER,
                bold: true,
                keepLines: true,
              }),
            ],
          }),
          new TableCell({
            width: cellWidth(VALUE_COLUMN_WIDTH),
            margins: CELL_MARGIN,
            borders: CELL_BORDER,
            shading: clearShading(COLOR_WHITE),
            verticalAlign: VerticalAlign.TOP,
            children: multiLineParagraphs(row.기준),
          }),
        ],
      }),
  );

  return new Table({
    width: cellWidth(CONTENT_WIDTH),
    columnWidths: [LABEL_COLUMN_WIDTH, VALUE_COLUMN_WIDTH],
    layout: "fixed",
    rows: [headerRow, ...bodyRows],
  });
}



export function buildOrderReportSummaryDocxFileName(

  notice: KhnpBidNoticeRow,

): string {

  const safeNo = notice.notice_no.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 40);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `발주요약_${safeNo}_${date}.docx`;

}



export interface OrderReportSummaryDocxOptions {
  pqSummary?: OrderReportPqAutoSummary | null;
  bidNoticeSourceFiles?: string[];
  pqSourceFiles?: string[];
}

export async function buildOrderReportSummaryDocx(

  notice: KhnpBidNoticeRow,

  summary: OrderReportSummaryData | null,

  generatedAt: Date,

  options: OrderReportSummaryDocxOptions = {},

): Promise<Buffer> {

  const pqSummary = options.pqSummary ?? null;
  const bidNoticeSourceFiles = options.bidNoticeSourceFiles ?? [];
  const pqSourceFiles = options.pqSourceFiles ?? pqSummary?.분석파일 ?? [];

  const children: FileChild[] = [];

  if (summary) {
    const enriched: OrderReportSummaryData = {
      ...summary,
      공고명: notice.title || summary.공고명,
      공고번호: notice.notice_no || summary.공고번호,
      생성일시:
        summary.생성일시 !== EMPTY_SUMMARY_VALUE
          ? summary.생성일시
          : generatedAt.toLocaleString("ko-KR"),
      공사개요: summary.공사개요.map(dedupeOverviewFinancialFields),
    };

    children.push(tabHeading("입찰공고문"));
    const bidSourcePara = sourceFilesParagraph("분석 파일", bidNoticeSourceFiles);
    if (bidSourcePara) children.push(bidSourcePara);

    children.push(...buildBidNoticeSampleSections(enriched));
  }

  if (pqSummary) {
    if (summary) {
      children.push(
        new Paragraph({
          spacing: { before: 400, after: 0 },
          children: [new PageBreak()],
        }),
      );
    }

    children.push(tabHeading("PQ 또는 적격심사"));
    const pqSourcePara = sourceFilesParagraph("분석 파일", pqSourceFiles);
    if (pqSourcePara) children.push(pqSourcePara);

    if (hasDisplayableSummaryValue(pqSummary.요약)) {
      children.push(
        sectionHeading("요약"),
        ...multiLineParagraphs(pqSummary.요약, { lineSpacingAfter: 40 }),
      );
    }

    for (const section of pqSummary.항목) {
      if (!hasDisplayableSummaryValue(section.내용)) continue;
      children.push(sectionHeading(section.제목));
      children.push(...multiLineParagraphs(section.내용));
    }
  }



  const doc = new Document({

    styles: {

      default: {

        document: {

          run: {

            font: {
              name: FONT,
              hint: "eastAsia",
            },

            size: FONT_SIZE_BODY,

          },

          paragraph: {

            spacing: { before: 0, after: 0 },

          },

        },

      },

    },

    sections: [

      {

        properties: {

          page: {

            size: {

              width: PAGE_WIDTH,

              height: PAGE_HEIGHT,

            },

            margin: {

              top: PAGE_MARGIN,

              right: PAGE_MARGIN,

              bottom: PAGE_MARGIN,

              left: PAGE_MARGIN,

            },

          },

        },

        children,

      },

    ],

  });



  return Buffer.from(await Packer.toBuffer(doc));

}


