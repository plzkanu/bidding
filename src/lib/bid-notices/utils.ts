import type {
  KhnpBidOpen,
  KhnpBidPrivate,
  KhnpBidPlanSpec,
  KhnpBidNoticeRow,
} from "./types";

export function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("ko-KR");
}

function formatListDateParts(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matched) {
    return `${matched[1].slice(-2)}-${matched[2]}-${matched[3]}`;
  }
  return null;
}

/** 목록 셀용 날짜 (예: 26-06-16) */
export function formatListDate(value: string | null | undefined): string {
  return formatListDateParts(value) ?? "-";
}

/** 목록 셀용 일시 (예: 26-06-16 14:30) */
export function formatListDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = formatListDateParts(value);
  if (!datePart) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${datePart} ${hh}:${min}`;
}

export function formatListPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "-";
  return `${formatListDate(start)} ~ ${formatListDate(end)}`;
}

/** 목록 셀용 공고기간 */
export function formatNoticePeriodForList(row: KhnpBidNoticeRow): string {
  if (row.notice_period_start || row.notice_period_end) {
    return formatListPeriod(row.notice_period_start, row.notice_period_end);
  }

  if (row.notice_type === "BID") {
    const open = getOpenDetail(row);
    if (open?.bid_start_dt || open?.bid_close_dt) {
      return formatListPeriod(open.bid_start_dt, open.bid_close_dt);
    }
  }

  return "-";
}

export const LIST_DATE_COL_CLASS =
  "w-[4.25rem] px-2 py-1.5 leading-tight break-words whitespace-nowrap";
export const LIST_DATETIME_COL_CLASS =
  "w-[7rem] px-2 py-1.5 leading-tight break-words whitespace-nowrap";
export const LIST_PERIOD_COL_CLASS =
  "w-[9.5rem] px-2 py-1.5 leading-tight break-words";

export function formatPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "-";
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

/** 마스터 공고기간이 없을 때 입찰공고(BID)는 입찰개시·마감일(날짜만)로 표시 */
export function formatNoticePeriod(row: KhnpBidNoticeRow): string {
  if (row.notice_period_start || row.notice_period_end) {
    return formatPeriod(row.notice_period_start, row.notice_period_end);
  }

  if (row.notice_type === "BID") {
    const open = getOpenDetail(row);
    if (open?.bid_start_dt || open?.bid_close_dt) {
      return formatPeriod(open.bid_start_dt, open.bid_close_dt);
    }
  }

  return "-";
}

export function getOpenDetail(row: {
  khnp_bid_open: KhnpBidOpen | KhnpBidOpen[] | null;
}): KhnpBidOpen | null {
  return pickOne(row.khnp_bid_open);
}

export function getPrivateDetail(row: {
  khnp_bid_private: KhnpBidPrivate | KhnpBidPrivate[] | null;
}): KhnpBidPrivate | null {
  return pickOne(row.khnp_bid_private);
}

export function getPlanSpecDetail(row: {
  khnp_bid_plan_spec: KhnpBidPlanSpec | KhnpBidPlanSpec[] | null;
}): KhnpBidPlanSpec | null {
  return pickOne(row.khnp_bid_plan_spec);
}

export function splitDeptName(
  value: string | null | undefined,
): { firstLine: string; secondLine: string | null } | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const spaceIndex = trimmed.search(/\s/);
  if (spaceIndex === -1) {
    return { firstLine: trimmed, secondLine: null };
  }
  const firstLine = trimmed.slice(0, spaceIndex);
  const rest = trimmed.slice(spaceIndex + 1).trim();
  return { firstLine, secondLine: rest || null };
}

/** 목록용: 부서명에서 첫 띄어쓰기 이전까지만 표시 */
export function formatDeptNameForList(
  value: string | null | undefined,
): string {
  const split = splitDeptName(value);
  if (!split) return "-";
  return split.firstLine;
}

export function truncateText(text: string | null | undefined, max = 60): string {
  if (!text) return "-";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
