import {
  listBidCompetitors,
  normalizeBidCompetitorsError,
} from "@/lib/bid-competitors";
import {
  listBidOpeningCategories,
  normalizeBidOpeningCategoriesError,
} from "@/lib/bid-opening-categories";
import {
  createBidOpeningResult,
  type BidOpeningResultInput,
  normalizeBidOpeningResultsError,
} from "@/lib/bid-opening-results";
import {
  computeConfirmedEstimatedPriceRate,
  isOurCompanyAwardName,
  parseCsvAwardWinner,
  parseAmountInput,
  parseOpeningDateInput,
  parseOpeningPercentValue,
  parseRateInput,
} from "@/lib/bid-opening-results-format";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as XLSX from "xlsx";

export const BID_OPENING_RESULTS_CSV_HEADERS = [
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
  "경쟁사",
  "투찰금액",
  "투찰율",
] as const;

type CsvHeaderName = (typeof BID_OPENING_RESULTS_CSV_HEADERS)[number];

const OPTIONAL_CSV_HEADERS = new Set<CsvHeaderName>([
  "낙찰자",
  "우리투찰금액",
  "우리투찰율",
  "확정예가",
]);

const CSV_HEADER_ALIASES: Record<string, CsvHeaderName> = {
  지초금액: "기초금액",
  낙찰율: "낙착율",
  낙찰회사: "낙찰자",
};

const UTF8_BOM = "\uFEFF";

export interface BidOpeningResultsCsvImportError {
  row: number;
  message: string;
}

export interface BidOpeningResultsCsvImportResult {
  created: number;
  errors: BidOpeningResultsCsvImportError[];
  warnings: BidOpeningResultsCsvImportError[];
}

interface ParsedCsvRow {
  rowNumber: number;
  values: Record<(typeof BID_OPENING_RESULTS_CSV_HEADERS)[number], string>;
}

interface GroupedNotice {
  key: string;
  firstRow: number;
  categoryName: string;
  noticeNo: string;
  bidName: string;
  bidDate: string | null;
  baseAmount: number | null;
  estimatedPrice: number | null;
  awardRate: number | null;
  confirmedEstimatedPrice: number | null;
  awardWinnerRaw: string | null;
  ourBidAmount: number | null;
  ourBidRate: number | null;
  bids: Array<{
    rowNumber: number;
    competitorName: string;
    bidAmount: number | null;
    bidRate: number | null;
  }>;
}

function encodeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    "건설",
    "2026-001",
    "OO발전소 설비공사",
    "26.06.15",
    "1000000000",
    "950000000",
    "87.5",
    "",
    "우리",
    "910000000",
    "87.8",
    "A건설",
    "920000000",
    "88.2",
  ],
  [
    "건설",
    "2026-001",
    "OO발전소 설비공사",
    "26.06.15",
    "1000000000",
    "950000000",
    "87.5",
    "",
    "우리",
    "910000000",
    "87.8",
    "B엔지니어링",
    "935000000",
    "89.5",
  ],
];

export function buildBidOpeningResultsCsvTemplate(): string {
  const header = BID_OPENING_RESULTS_CSV_HEADERS.join(",");
  const lines = [
    header,
    ...TEMPLATE_EXAMPLE_ROWS.map((row) => row.map(encodeCsvField).join(",")),
  ];

  return UTF8_BOM + lines.join("\r\n");
}

export function buildBidOpeningResultsXlsxTemplate(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...BID_OPENING_RESULTS_CSV_HEADERS],
    ...TEMPLATE_EXAMPLE_ROWS,
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "개찰결과");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function formatXlsxCell(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") {
    return String(cell.w).trim();
  }
  if (cell.v instanceof Date) {
    const yy = String(cell.v.getFullYear()).slice(-2);
    const mm = String(cell.v.getMonth() + 1).padStart(2, "0");
    const dd = String(cell.v.getDate()).padStart(2, "0");
    return `${yy}.${mm}.${dd}`;
  }
  if (cell.v == null) return "";
  return String(cell.v).trim();
}

export function parseXlsxToTable(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const table: string[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: string[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      row.push(formatXlsxCell(sheet[address]));
    }
    const cleaned = trimTrailingEmptyCells(row);
    if (cleaned.some((cell) => cell.trim() !== "")) {
      table.push(cleaned);
    }
  }

  return table;
}

export function isXlsxFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".xlsx");
}

export function isCsvFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".csv");
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

export function decodeCsvText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (isReadableCsvHeader(utf8)) {
    return utf8;
  }

  try {
    const eucKr = new TextDecoder("euc-kr").decode(bytes);
    if (isReadableCsvHeader(eucKr)) {
      return eucKr;
    }
  } catch {
    // fall through
  }

  return utf8;
}

function isReadableCsvHeader(text: string): boolean {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("구분") && firstLine.includes("입찰");
}

function detectCsvDelimiter(firstLine: string): "," | ";" | "\t" {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === ",") commas += 1;
    if (char === ";") semicolons += 1;
    if (char === "\t") tabs += 1;
  }

  if (semicolons > commas) return ";";
  if (tabs > commas) return "\t";
  return ",";
}

function trimTrailingEmptyCells(cells: string[]): string[] {
  const trimmed = [...cells];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  return trimmed;
}

function parseCsv(text: string, delimiter = ","): string[][] {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      const cleaned = trimTrailingEmptyCells(row);
      if (cleaned.some((cell) => cell.trim() !== "")) {
        rows.push(cleaned);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  const cleaned = trimTrailingEmptyCells(row);
  if (cleaned.some((cell) => cell.trim() !== "")) {
    rows.push(cleaned);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return stripBom(value).trim();
}

function canonicalHeaderName(value: string): CsvHeaderName | null {
  const normalized = normalizeHeader(value);
  const aliased = CSV_HEADER_ALIASES[normalized] ?? normalized;
  return (BID_OPENING_RESULTS_CSV_HEADERS as readonly string[]).includes(aliased)
    ? (aliased as CsvHeaderName)
    : null;
}

function buildColumnIndexes(
  headerCells: string[],
): { indexes: Record<CsvHeaderName, number> } | { error: string } {
  const indexes = {} as Record<CsvHeaderName, number>;
  const seen = new Set<CsvHeaderName>();

  for (const [index, cell] of headerCells.entries()) {
    const canonical = canonicalHeaderName(cell);
    if (!canonical) continue;
    if (seen.has(canonical)) {
      return { error: `헤더 열「${canonical}」가 중복되었습니다.` };
    }
    seen.add(canonical);
    indexes[canonical] = index;
  }

  for (const name of BID_OPENING_RESULTS_CSV_HEADERS) {
    if (indexes[name] === undefined) {
      if (OPTIONAL_CSV_HEADERS.has(name)) {
        indexes[name] = -1;
        continue;
      }
      return {
        error: `필수 열「${name}」이 없습니다. 양식 다운로드 후 헤더를 확인해 주세요.`,
      };
    }
  }

  return { indexes };
}

function readRowValues(
  line: string[],
  indexes: Record<CsvHeaderName, number>,
): Record<CsvHeaderName, string> {
  const values = {} as Record<CsvHeaderName, string>;
  for (const name of BID_OPENING_RESULTS_CSV_HEADERS) {
    const index = indexes[name];
    values[name] = index >= 0 ? (line[index]?.trim() ?? "") : "";
  }
  return values;
}

function findImportHeaderRowIndex(table: string[][]): number {
  const limit = Math.min(table.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const headerResult = buildColumnIndexes(table[index].map(normalizeHeader));
    if (!("error" in headerResult)) {
      return index;
    }
  }
  return 0;
}

function mergeGroupOurBid(
  group: GroupedNotice,
  rowNumber: number,
  noticeNo: string,
  ourBidAmount: number | null,
  ourBidRate: number | null,
  warnings: BidOpeningResultsCsvImportError[],
) {
  if (ourBidAmount != null) {
    if (group.ourBidAmount != null && group.ourBidAmount !== ourBidAmount) {
      warnings.push({
        row: rowNumber,
        message: `같은 공고(${noticeNo})의 우리투찰금액이 ${group.firstRow}행과 다릅니다. 첫 행 값을 사용합니다.`,
      });
    } else if (group.ourBidAmount == null) {
      group.ourBidAmount = ourBidAmount;
    }
  }
  if (ourBidRate != null) {
    if (group.ourBidRate != null && group.ourBidRate !== ourBidRate) {
      warnings.push({
        row: rowNumber,
        message: `같은 공고(${noticeNo})의 우리투찰율이 ${group.firstRow}행과 다릅니다. 첫 행 값을 사용합니다.`,
      });
    } else if (group.ourBidRate == null) {
      group.ourBidRate = ourBidRate;
    }
  }
}

interface WideColumnLayout {
  headerRowIndex: number;
  categoryCol: number;
  noticeNoCol: number;
  bidNameCol: number;
  bidDateCol: number;
  baseAmountCol: number;
  estimatedPriceCol: number;
  awardRateCol: number;
  awardWinnerCol: number;
  competitors: Array<{
    name: string;
    amountCol: number;
    rateCol: number;
  }>;
}

function readTableCell(row: string[], col: number): string {
  return row[col]?.trim() ?? "";
}

function isValidImportNoticeNo(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 5) return false;
  if (/총|이상|미만|합계|평균/i.test(trimmed)) return false;
  return /[A-Za-z]/.test(trimmed) && /\d/.test(trimmed);
}

function findWideColumnLayout(table: string[][]): WideColumnLayout | null {
  const limit = Math.min(table.length, 30);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const header = table[rowIndex].map(normalizeHeader);
    const noticeNoCol = header.indexOf("입찰공고번호");
    const awardWinnerCol = header.findIndex(
      (name) => name === "낙찰자" || name === "낙찰회사",
    );
    if (noticeNoCol < 0 || awardWinnerCol < 0) continue;
    if (header.includes("경쟁사") && header.includes("투찰금액")) {
      continue;
    }

    const categoryCol = header.indexOf("구분");
    const bidNameCol = header.indexOf("입찰명");
    const bidDateCol = header.indexOf("입찰일");
    const baseAmountCol = header.indexOf("기초금액");
    const estimatedPriceCol = header.indexOf("예정가격");
    const awardRateCol = header.findIndex(
      (name) => name === "낙착율" || name === "낙찰율",
    );
    if (
      categoryCol < 0 ||
      bidNameCol < 0 ||
      bidDateCol < 0 ||
      baseAmountCol < 0 ||
      estimatedPriceCol < 0 ||
      awardRateCol < 0
    ) {
      continue;
    }

    const competitors: WideColumnLayout["competitors"] = [];
    for (
      let colIndex = awardWinnerCol + 1;
      colIndex < table[rowIndex].length;
      colIndex += 2
    ) {
      const name = table[rowIndex][colIndex]?.trim();
      if (!name) continue;
      competitors.push({
        name,
        amountCol: colIndex,
        rateCol: colIndex + 1,
      });
    }

    if (competitors.length === 0) continue;

    return {
      headerRowIndex: rowIndex,
      categoryCol,
      noticeNoCol,
      bidNameCol,
      bidDateCol,
      baseAmountCol,
      estimatedPriceCol,
      awardRateCol,
      awardWinnerCol,
      competitors,
    };
  }
  return null;
}

function parseWideFormatGroups(
  table: string[][],
  layout: WideColumnLayout,
): {
  groups: Map<string, GroupedNotice>;
  errors: BidOpeningResultsCsvImportError[];
  warnings: BidOpeningResultsCsvImportError[];
} {
  const groups = new Map<string, GroupedNotice>();
  const errors: BidOpeningResultsCsvImportError[] = [];
  const warnings: BidOpeningResultsCsvImportError[] = [];

  for (let index = layout.headerRowIndex + 1; index < table.length; index += 1) {
    const line = table[index];
    const rowNumber = index + 1;
    const noticeNo = readTableCell(line, layout.noticeNoCol);
    const bidName = readTableCell(line, layout.bidNameCol);

    if (!noticeNo && !bidName) continue;
    if (!isValidImportNoticeNo(noticeNo)) continue;

    const categoryName = readTableCell(line, layout.categoryCol);
    if (!categoryName) {
      errors.push({
        row: rowNumber,
        message: "구분을 입력해 주세요. (구분 관리에 등록한 이름)",
      });
      continue;
    }
    if (!bidName) {
      errors.push({ row: rowNumber, message: "입찰명을 입력해 주세요." });
      continue;
    }

    const bidDateRaw = readTableCell(line, layout.bidDateCol);
    const bidDate = parseOpeningDateInput(bidDateRaw);
    if (bidDateRaw && !bidDate) {
      errors.push({
        row: rowNumber,
        message: "입찰일 형식이 올바르지 않습니다. (예: 26.06.15)",
      });
      continue;
    }

    const baseAmount = parseAmountInput(readTableCell(line, layout.baseAmountCol));
    const estimatedPrice = parseAmountInput(
      readTableCell(line, layout.estimatedPriceCol),
    );
    const awardWinnerRaw = readTableCell(line, layout.awardWinnerCol) || null;

    const group: GroupedNotice = {
      key: groupKey(categoryName, noticeNo),
      firstRow: rowNumber,
      categoryName,
      noticeNo,
      bidName,
      bidDate,
      baseAmount,
      estimatedPrice,
      awardRate: parseOpeningPercentValue(
        readTableCell(line, layout.awardRateCol),
      ),
      confirmedEstimatedPrice: computeConfirmedEstimatedPriceRate(
        baseAmount,
        estimatedPrice,
      ),
      awardWinnerRaw,
      ourBidAmount: null,
      ourBidRate: null,
      bids: [],
    };

    for (const competitor of layout.competitors) {
      const amountRaw = readTableCell(line, competitor.amountCol);
      const rateRaw = readTableCell(line, competitor.rateCol);
      const bidAmount = parseAmountInput(amountRaw);
      const bidRate = parseOpeningPercentValue(rateRaw);

      if (isOurCompanyAwardName(competitor.name)) {
        if (bidAmount != null && bidAmount > 0) {
          mergeGroupOurBid(
            group,
            rowNumber,
            noticeNo,
            bidAmount,
            bidRate,
            warnings,
          );
        }
        continue;
      }

      if (bidAmount == null || bidAmount <= 0) continue;

      if (
        group.bids.some(
          (bid) =>
            bid.competitorName.toLowerCase() === competitor.name.toLowerCase(),
        )
      ) {
        continue;
      }

      group.bids.push({
        rowNumber,
        competitorName: competitor.name,
        bidAmount,
        bidRate,
      });
    }

    groups.set(group.key, group);
  }

  return { groups, errors, warnings };
}

function resolveCompetitorByImportName(
  name: string,
  competitorByName: Map<string, { id: string; name: string }>,
): { id: string; name: string } | null {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const direct = competitorByName.get(lower);
  if (direct) return direct;

  const withoutParens = trimmed
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim()
    .toLowerCase();
  if (withoutParens) {
    const byShort = competitorByName.get(withoutParens);
    if (byShort) return byShort;
  }

  for (const [key, competitor] of competitorByName) {
    if (lower.includes(key) || key.includes(lower)) return competitor;
    if (withoutParens && (withoutParens.includes(key) || key.includes(withoutParens))) {
      return competitor;
    }
  }

  return null;
}

function parseImportTable(table: string[][]): {
  rows: ParsedCsvRow[];
  errors: BidOpeningResultsCsvImportError[];
} {
  const errors: BidOpeningResultsCsvImportError[] = [];

  if (table.length === 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: "파일에 데이터가 없습니다." }],
    };
  }

  const headerRowIndex = findImportHeaderRowIndex(table);
  const headerResult = buildColumnIndexes(
    table[headerRowIndex].map(normalizeHeader),
  );
  if ("error" in headerResult) {
    return {
      rows: [],
      errors: [
        {
          row: headerRowIndex + 1,
          message: `${headerResult.error} (필요 열: ${BID_OPENING_RESULTS_CSV_HEADERS.join(", ")})`,
        },
      ],
    };
  }

  const { indexes } = headerResult;
  const rows: ParsedCsvRow[] = [];

  for (let index = headerRowIndex + 1; index < table.length; index += 1) {
    const line = table[index];
    const rowNumber = index + 1;
    const values = readRowValues(line, indexes);

    const isEmpty = BID_OPENING_RESULTS_CSV_HEADERS.every(
      (name) => values[name] === "",
    );
    if (isEmpty) {
      continue;
    }

    rows.push({ rowNumber, values });
  }

  return { rows, errors };
}

function groupKey(categoryName: string, noticeNo: string): string {
  return `${categoryName.toLowerCase()}::${noticeNo.toLowerCase()}`;
}

function groupRows(
  rows: ParsedCsvRow[],
  errors: BidOpeningResultsCsvImportError[],
  warnings: BidOpeningResultsCsvImportError[],
): Map<string, GroupedNotice> {
  const groups = new Map<string, GroupedNotice>();

  for (const row of rows) {
    const categoryName = row.values.구분.trim();
    const noticeNo = row.values.입찰공고번호.trim();
    const bidName = row.values.입찰명.trim();
    const bidDateRaw = row.values.입찰일.trim();
    const competitorName = row.values.경쟁사.trim();
    const awardWinnerRaw = row.values.낙찰자.trim();

    if (!categoryName) {
      errors.push({ row: row.rowNumber, message: "구분을 입력해 주세요. (구분 관리에 등록한 이름)" });
      continue;
    }
    if (!noticeNo) {
      errors.push({ row: row.rowNumber, message: "입찰공고번호를 입력해 주세요." });
      continue;
    }
    if (!bidName) {
      errors.push({ row: row.rowNumber, message: "입찰명을 입력해 주세요." });
      continue;
    }

    const bidDate = parseOpeningDateInput(bidDateRaw);
    if (bidDateRaw && !bidDate) {
      errors.push({
        row: row.rowNumber,
        message: "입찰일 형식이 올바르지 않습니다. (예: 26.06.15)",
      });
      continue;
    }

    const key = groupKey(categoryName, noticeNo);
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        firstRow: row.rowNumber,
        categoryName,
        noticeNo,
        bidName,
        bidDate,
        baseAmount: parseAmountInput(row.values.기초금액),
        estimatedPrice: parseAmountInput(row.values.예정가격),
        awardRate: parseRateInput(row.values.낙착율),
        confirmedEstimatedPrice: computeConfirmedEstimatedPriceRate(
          parseAmountInput(row.values.기초금액),
          parseAmountInput(row.values.예정가격),
        ),
        awardWinnerRaw: awardWinnerRaw || null,
        ourBidAmount: parseAmountInput(row.values.우리투찰금액),
        ourBidRate: parseRateInput(row.values.우리투찰율),
        bids: [],
      };
      groups.set(key, group);
    } else {
      if (group.bidName !== bidName) {
        warnings.push({
          row: row.rowNumber,
          message: `같은 공고(${noticeNo})의 입찰명이 ${group.firstRow}행과 다릅니다. 첫 행 값을 사용합니다.`,
        });
      }
      if (group.bidDate !== bidDate && bidDate) {
        warnings.push({
          row: row.rowNumber,
          message: `같은 공고(${noticeNo})의 입찰일이 ${group.firstRow}행과 다릅니다. 첫 행 값을 사용합니다.`,
        });
      }
      if (
        awardWinnerRaw &&
        group.awardWinnerRaw &&
        awardWinnerRaw !== group.awardWinnerRaw
      ) {
        warnings.push({
          row: row.rowNumber,
          message: `같은 공고(${noticeNo})의 낙찰자가 ${group.firstRow}행과 다릅니다. 첫 행 값을 사용합니다.`,
        });
      } else if (awardWinnerRaw && !group.awardWinnerRaw) {
        group.awardWinnerRaw = awardWinnerRaw;
      }

      mergeGroupOurBid(
        group,
        row.rowNumber,
        noticeNo,
        parseAmountInput(row.values.우리투찰금액),
        parseRateInput(row.values.우리투찰율),
        warnings,
      );
    }

    if (competitorName) {
      if (isOurCompanyAwardName(competitorName)) {
        mergeGroupOurBid(
          group,
          row.rowNumber,
          noticeNo,
          parseAmountInput(row.values.투찰금액),
          parseRateInput(row.values.투찰율),
          warnings,
        );
        continue;
      }

      if (group.bids.some((bid) => bid.competitorName.toLowerCase() === competitorName.toLowerCase())) {
        errors.push({
          row: row.rowNumber,
          message: `같은 공고(${noticeNo})에 경쟁사「${competitorName}」가 중복되었습니다.`,
        });
        continue;
      }

      group.bids.push({
        rowNumber: row.rowNumber,
        competitorName,
        bidAmount: parseAmountInput(row.values.투찰금액),
        bidRate: parseRateInput(row.values.투찰율),
      });
    }
  }

  return groups;
}

async function findExistingResultId(
  categoryId: string,
  noticeNo: string,
): Promise<{ id: string | null; error: string | null }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_opening_results")
      .select("id")
      .eq("category_id", categoryId)
      .eq("notice_no", noticeNo)
      .maybeSingle();

    if (error) {
      return { id: null, error: normalizeBidOpeningResultsError(error.message) };
    }

    return { id: (data?.id as string | undefined) ?? null, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "기존 개찰결과 조회에 실패했습니다.";
    return { id: null, error: normalizeBidOpeningResultsError(message) };
  }
}

export async function importBidOpeningResultsFromCsv(
  csvText: string,
  createdBy: string,
): Promise<BidOpeningResultsCsvImportResult> {
  const normalized = stripBom(csvText);
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectCsvDelimiter(firstLine);
  const table = parseCsv(normalized, delimiter);
  return importBidOpeningResultsFromTable(table, createdBy);
}

export async function importBidOpeningResultsFromXlsx(
  buffer: ArrayBuffer,
  createdBy: string,
): Promise<BidOpeningResultsCsvImportResult> {
  const table = parseXlsxToTable(buffer);
  return importBidOpeningResultsFromTable(table, createdBy);
}

export async function importBidOpeningResultsFromFile(
  buffer: ArrayBuffer,
  fileName: string,
  createdBy: string,
): Promise<BidOpeningResultsCsvImportResult> {
  if (isXlsxFileName(fileName)) {
    return importBidOpeningResultsFromXlsx(buffer, createdBy);
  }
  return importBidOpeningResultsFromCsv(decodeCsvText(buffer), createdBy);
}

async function importBidOpeningResultsFromTable(
  table: string[][],
  createdBy: string,
): Promise<BidOpeningResultsCsvImportResult> {
  if (!isSupabaseConfigured()) {
    return {
      created: 0,
      errors: [{ row: 0, message: "Supabase가 설정되지 않았습니다." }],
      warnings: [],
    };
  }

  const wideLayout = findWideColumnLayout(table);
  const errors: BidOpeningResultsCsvImportError[] = [];
  const warnings: BidOpeningResultsCsvImportError[] = [];
  let groups: Map<string, GroupedNotice>;

  if (wideLayout) {
    const wideResult = parseWideFormatGroups(table, wideLayout);
    groups = wideResult.groups;
    errors.push(...wideResult.errors);
    warnings.push(...wideResult.warnings);
  } else {
    const { rows, errors: parseErrors } = parseImportTable(table);
    errors.push(...parseErrors);

    if (parseErrors.length > 0) {
      return { created: 0, errors, warnings };
    }

    if (rows.length === 0) {
      return {
        created: 0,
        errors: [{ row: 2, message: "등록할 데이터 행이 없습니다." }],
        warnings,
      };
    }

    groups = groupRows(rows, errors, warnings);
  }

  if (errors.length > 0 && groups.size === 0) {
    return { created: 0, errors, warnings };
  }

  if (groups.size === 0) {
    return {
      created: 0,
      errors: [{ row: 2, message: "등록할 데이터 행이 없습니다." }],
      warnings,
    };
  }

  const [{ categories, error: categoriesError }, { competitors, error: competitorsError }] =
    await Promise.all([
      listBidOpeningCategories({ activeOnly: true }),
      listBidCompetitors({ activeOnly: true }),
    ]);

  if (categoriesError) {
    return {
      created: 0,
      errors: [{ row: 0, message: normalizeBidOpeningCategoriesError(categoriesError) }],
      warnings,
    };
  }
  if (competitorsError) {
    return {
      created: 0,
      errors: [{ row: 0, message: normalizeBidCompetitorsError(competitorsError) }],
      warnings,
    };
  }

  const categoryByName = new Map(
    categories.map((row) => [row.name.toLowerCase(), row]),
  );
  const competitorByName = new Map(
    competitors.map((row) => [row.name.toLowerCase(), row]),
  );

  let created = 0;

  for (const group of groups.values()) {
    const category = categoryByName.get(group.categoryName.toLowerCase());
    if (!category) {
      errors.push({
        row: group.firstRow,
        message: `등록되지 않은 구분입니다: 「${group.categoryName}」`,
      });
      continue;
    }

    for (const bid of group.bids) {
      if (!resolveCompetitorByImportName(bid.competitorName, competitorByName)) {
        errors.push({
          row: bid.rowNumber,
          message: `등록되지 않은 경쟁사입니다: 「${bid.competitorName}」`,
        });
      }
    }

    const hasBidErrors = group.bids.some(
      (bid) => !resolveCompetitorByImportName(bid.competitorName, competitorByName),
    );
    if (hasBidErrors) {
      continue;
    }

    const { id: existingId, error: existingError } = await findExistingResultId(
      category.id,
      group.noticeNo,
    );
    if (existingError) {
      errors.push({ row: group.firstRow, message: existingError });
      continue;
    }
    if (existingId) {
      errors.push({
        row: group.firstRow,
        message: `이미 등록된 공고입니다: 「${group.categoryName}」 ${group.noticeNo}`,
      });
      continue;
    }

    const input: BidOpeningResultInput = {
      categoryId: category.id,
      noticeNo: group.noticeNo,
      bidName: group.bidName,
      bidDate: group.bidDate,
      baseAmount: group.baseAmount,
      estimatedPrice: group.estimatedPrice,
      awardRate: group.awardRate,
      confirmedEstimatedPrice: group.confirmedEstimatedPrice,
      ourBidAmount: group.ourBidAmount,
      ourBidRate: group.ourBidRate,
      bids: group.bids.map((bid) => {
        const competitor = resolveCompetitorByImportName(
          bid.competitorName,
          competitorByName,
        )!;
        return {
          competitorId: competitor.id,
          bidAmount: bid.bidAmount,
          bidRate: bid.bidRate,
        };
      }),
    };

    if (group.awardWinnerRaw) {
      const parsedWinner = parseCsvAwardWinner(group.awardWinnerRaw);
      if (!parsedWinner) {
        errors.push({
          row: group.firstRow,
          message: `낙찰자 값이 올바르지 않습니다: 「${group.awardWinnerRaw}」`,
        });
        continue;
      }
      if (parsedWinner.type === "ours") {
        input.awardWinnerType = "ours";
        input.awardWinnerCompetitorId = null;
      } else if (parsedWinner.competitorName) {
        const winnerCompetitor = resolveCompetitorByImportName(
          parsedWinner.competitorName,
          competitorByName,
        );
        if (!winnerCompetitor) {
          errors.push({
            row: group.firstRow,
            message: `등록되지 않은 낙찰 경쟁사입니다: 「${parsedWinner.competitorName}」`,
          });
          continue;
        }
        const bidCompetitorIds = new Set(input.bids?.map((bid) => bid.competitorId));
        if (!bidCompetitorIds.has(winnerCompetitor.id)) {
          errors.push({
            row: group.firstRow,
            message: `낙찰 경쟁사「${parsedWinner.competitorName}」는 이 공고 투찰 목록에 없습니다.`,
          });
          continue;
        }
        input.awardWinnerType = "competitor";
        input.awardWinnerCompetitorId = winnerCompetitor.id;
      }
    }

    const { error: createError } = await createBidOpeningResult(input, createdBy);
    if (createError) {
      errors.push({ row: group.firstRow, message: createError });
      continue;
    }

    created += 1;
  }

  return { created, errors, warnings };
}
