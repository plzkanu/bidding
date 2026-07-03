import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  buildWideHeaderRow,
  buildWideSubHeaderRow,
  WIDE_FORMAT_BASE_COLUMN_COUNT,
} from "@/lib/bid-opening-results-csv";
import {
  computeConfirmedEstimatedPriceRate,
  formatAwardWinnerLabel,
  formatOpeningDate,
  getOurCompanyChartTitle,
  hasOurOpeningBid,
  isOurCompanyAwardName,
  normalizeStoredBidRate,
} from "@/lib/bid-opening-results-format";
import * as XLSX from "xlsx-js-style";

const LIST_EXPORT_HEADERS = [
  "구분",
  "입찰공고번호",
  "입찰명",
  "입찰일",
  "기초금액",
  "예정가격",
  "낙착율",
  "확정예가",
  "낙찰자",
  "우리투찰금액",
  "우리투찰율",
  "투찰건수",
] as const;

const WIDE_DATA_START_ROW = 2;
const AWARD_WINNER_YELLOW_FILL = {
  fill: {
    patternType: "solid",
    fgColor: { rgb: "FFFF00" },
  },
};

function countBids(item: BidOpeningResult): number {
  return item.bids.length + (hasOurOpeningBid(item) ? 1 : 0);
}

function normalizeCompetitorKey(name: string): string {
  return name.trim().toLowerCase();
}

function collectWideCompetitorColumns(items: BidOpeningResult[]): string[] {
  const ourLabel = getOurCompanyChartTitle();
  const columns: string[] = [];
  const seen = new Set<string>();

  const addColumn = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = normalizeCompetitorKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    columns.push(trimmed);
  };

  addColumn(ourLabel);

  for (const item of items) {
    for (const bid of item.bids) {
      if (!isOurCompanyAwardName(bid.competitorName)) {
        addColumn(bid.competitorName);
      }
    }
  }

  return columns;
}

function buildBidLookup(
  item: BidOpeningResult,
): Map<string, { amount: number | null; rate: number | null }> {
  const lookup = new Map<
    string,
    { amount: number | null; rate: number | null }
  >();

  if (hasOurOpeningBid(item)) {
    lookup.set(normalizeCompetitorKey(getOurCompanyChartTitle()), {
      amount: item.ourBidAmount,
      rate: item.ourBidRate,
    });
  }

  for (const bid of item.bids) {
    lookup.set(normalizeCompetitorKey(bid.competitorName), {
      amount: bid.bidAmount,
      rate: bid.bidRate,
    });
  }

  return lookup;
}

function resolveWinnerColumnIndex(
  item: BidOpeningResult,
  competitorColumns: string[],
): number | null {
  if (item.awardWinnerType === "ours") {
    const index = competitorColumns.findIndex((name) =>
      isOurCompanyAwardName(name),
    );
    return index >= 0 ? index : null;
  }

  if (item.awardWinnerType === "competitor") {
    const winnerName = item.awardWinnerCompetitorName?.trim();
    if (!winnerName) return null;

    const winnerKey = normalizeCompetitorKey(winnerName);
    const exactIndex = competitorColumns.findIndex(
      (name) => normalizeCompetitorKey(name) === winnerKey,
    );
    if (exactIndex >= 0) return exactIndex;

    const fuzzyIndex = competitorColumns.findIndex((name) => {
      const columnKey = normalizeCompetitorKey(name);
      return columnKey.includes(winnerKey) || winnerKey.includes(columnKey);
    });
    return fuzzyIndex >= 0 ? fuzzyIndex : null;
  }

  const winnerLabel = formatAwardWinnerLabel(
    item.awardWinnerType,
    item.awardWinnerCompetitorName,
  );
  if (winnerLabel === "-" || !winnerLabel.trim()) return null;

  if (isOurCompanyAwardName(winnerLabel)) {
    const index = competitorColumns.findIndex((name) =>
      isOurCompanyAwardName(name),
    );
    return index >= 0 ? index : null;
  }

  const winnerKey = normalizeCompetitorKey(winnerLabel);
  const fallbackIndex = competitorColumns.findIndex((name) => {
    const columnKey = normalizeCompetitorKey(name);
    return columnKey === winnerKey || columnKey.includes(winnerKey);
  });
  return fallbackIndex >= 0 ? fallbackIndex : null;
}

function setCellStyle(
  sheet: XLSX.WorkSheet,
  row: number,
  column: number,
  style: Record<string, unknown>,
) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = sheet[address];
  if (!cell) return;
  cell.s = { ...(cell.s ?? {}), ...style };
}

function applyAwardWinnerHighlight(
  sheet: XLSX.WorkSheet,
  items: BidOpeningResult[],
  competitorColumns: string[],
) {
  items.forEach((item, itemIndex) => {
    const winnerColumnIndex = resolveWinnerColumnIndex(item, competitorColumns);
    if (winnerColumnIndex == null || winnerColumnIndex < 0) return;

    const amountColumn =
      WIDE_FORMAT_BASE_COLUMN_COUNT + winnerColumnIndex * 2;
    const rateColumn = amountColumn + 1;
    const rowIndex = WIDE_DATA_START_ROW + itemIndex;

    setCellStyle(sheet, rowIndex, amountColumn, AWARD_WINNER_YELLOW_FILL);
    setCellStyle(sheet, rowIndex, rateColumn, AWARD_WINNER_YELLOW_FILL);
  });
}

function buildListExportRow(item: BidOpeningResult): (string | number)[] {
  const confirmedRate = computeConfirmedEstimatedPriceRate(
    item.baseAmount,
    item.estimatedPrice,
  );

  const winnerLabel = formatAwardWinnerLabel(
    item.awardWinnerType,
    item.awardWinnerCompetitorName,
  );
  const winner = winnerLabel === "-" ? "" : winnerLabel;

  return [
    item.categoryName,
    item.noticeNo,
    item.bidName,
    formatOpeningDate(item.bidDate) === "-"
      ? ""
      : formatOpeningDate(item.bidDate),
    item.baseAmount ?? "",
    item.estimatedPrice ?? "",
    item.awardRate != null ? normalizeStoredBidRate(item.awardRate) ?? "" : "",
    confirmedRate ?? "",
    winner,
    item.ourBidAmount ?? "",
    item.ourBidRate != null ? normalizeStoredBidRate(item.ourBidRate) ?? "" : "",
    countBids(item),
  ];
}

function buildWideExportRow(
  item: BidOpeningResult,
  competitorColumns: string[],
): (string | number)[] {
  const winnerLabel = formatAwardWinnerLabel(
    item.awardWinnerType,
    item.awardWinnerCompetitorName,
  );
  const winner = winnerLabel === "-" ? "" : winnerLabel;
  const bidLookup = buildBidLookup(item);

  const row: (string | number)[] = [
    item.categoryName,
    item.noticeNo,
    item.bidName,
    formatOpeningDate(item.bidDate) === "-"
      ? ""
      : formatOpeningDate(item.bidDate),
    item.baseAmount ?? "",
    item.estimatedPrice ?? "",
    item.awardRate != null ? normalizeStoredBidRate(item.awardRate) ?? "" : "",
    winner,
  ];

  for (const columnName of competitorColumns) {
    const bid = bidLookup.get(normalizeCompetitorKey(columnName));
    row.push(
      bid?.amount ?? "",
      bid?.rate != null ? normalizeStoredBidRate(bid.rate) ?? "" : "",
    );
  }

  return row;
}

function buildWideColumnWidths(competitorCount: number) {
  return [
    { wch: 8 },
    { wch: 14 },
    { wch: 32 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    ...Array.from({ length: competitorCount }, () => [
      { wch: 14 },
      { wch: 10 },
    ]).flat(),
  ];
}

export function buildBidOpeningResultsExportXlsx(
  items: BidOpeningResult[],
): ArrayBuffer {
  const listSheet = XLSX.utils.aoa_to_sheet([
    [...LIST_EXPORT_HEADERS],
    ...items.map((item) => buildListExportRow(item)),
  ]);
  listSheet["!cols"] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 32 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
  ];

  const competitorColumns = collectWideCompetitorColumns(items);
  const wideSheet = XLSX.utils.aoa_to_sheet([
    buildWideHeaderRow(competitorColumns),
    buildWideSubHeaderRow(competitorColumns.length),
    ...items.map((item) => buildWideExportRow(item, competitorColumns)),
  ]);
  wideSheet["!cols"] = buildWideColumnWidths(competitorColumns.length);
  applyAwardWinnerHighlight(wideSheet, items, competitorColumns);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, listSheet, "조회목록");
  XLSX.utils.book_append_sheet(workbook, wideSheet, "가로양식");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function buildBidOpeningResultsExportFileName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `개찰결과_조회_${y}${m}${d}.xlsx`;
}
