import * as XLSX from "xlsx";
import {
  BID_NOTICE_TYPE_LABELS,
  type BidNoticeType,
  type KhnpBidNoticeRow,
} from "@/lib/bid-notices/types";
import {
  formatDate,
  formatDateTime,
  formatDeptNameForList,
  formatNoticePeriod,
  getOpenDetail,
  getPrivateDetail,
} from "@/lib/bid-notices/utils";

const BASE_HEADERS = ["관심", "공고번호", "공고구분", "공고명"] as const;

const TYPE_HEADERS: Record<BidNoticeType, readonly string[]> = {
  BID: ["상태", "구분", "입찰마감"],
  PRIVATE: ["주요구매내용"],
  PLAN_SPEC: [],
};

const TAIL_HEADERS = ["부서", "공고일시", "공고기간"] as const;

export function getBidNoticeExcelHeaders(
  noticeType: BidNoticeType,
): string[] {
  return [
    ...BASE_HEADERS,
    ...TYPE_HEADERS[noticeType],
    ...TAIL_HEADERS,
  ];
}

function rowToExcelCells(
  row: KhnpBidNoticeRow,
  noticeType: BidNoticeType,
  isFavorite: boolean,
): (string | number)[] {
  const open = getOpenDetail(row);
  const priv = getPrivateDetail(row);

  const base: (string | number)[] = [
    isFavorite ? "Y" : "N",
    row.notice_no,
    row.notice_div ?? "",
    row.title,
  ];

  let typeSpecific: (string | number)[] = [];
  if (noticeType === "BID") {
    typeSpecific = [
      open?.status ?? "",
      open?.purchase_type ?? "",
      formatDateTime(open?.bid_close_dt),
    ];
  } else if (noticeType === "PRIVATE") {
    typeSpecific = [priv?.main_content ?? ""];
  }

  const tail: (string | number)[] = [
    formatDeptNameForList(row.dept_name),
    formatDate(row.notice_date),
    formatNoticePeriod(row),
  ];

  return [...base, ...typeSpecific, ...tail];
}

export function buildBidNoticeWorkbook(
  rows: KhnpBidNoticeRow[],
  noticeType: BidNoticeType,
  favoriteIds: Set<string>,
): XLSX.WorkBook {
  const headers = getBidNoticeExcelHeaders(noticeType);
  const data = rows.map((row) =>
    rowToExcelCells(row, noticeType, favoriteIds.has(row.id)),
  );

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "공고목록");
  return workbook;
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export function buildBidNoticeExcelFileName(options: {
  siteName: string;
  noticeType: BidNoticeType;
  favoritesOnly: boolean;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const site = sanitizeFileNamePart(options.siteName);
  const typeLabel = sanitizeFileNamePart(
    BID_NOTICE_TYPE_LABELS[options.noticeType],
  );
  const prefix = options.favoritesOnly ? "관심공고_" : "입찰공고_";
  return `${prefix}${site}_${typeLabel}_${date}.xlsx`;
}

export function downloadBidNoticeExcel(
  rows: KhnpBidNoticeRow[],
  options: {
    noticeType: BidNoticeType;
    favoriteIds: Set<string>;
    siteName: string;
    favoritesOnly: boolean;
  },
): void {
  const workbook = buildBidNoticeWorkbook(
    rows,
    options.noticeType,
    options.favoriteIds,
  );
  const fileName = buildBidNoticeExcelFileName({
    siteName: options.siteName,
    noticeType: options.noticeType,
    favoritesOnly: options.favoritesOnly,
  });
  XLSX.writeFile(workbook, fileName);
}
