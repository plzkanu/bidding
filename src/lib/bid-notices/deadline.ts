import { getOpenDetail } from "./utils";
import type { KhnpBidNoticeRow } from "./types";

export type DeadlineWindow = "week" | "day";

export const DEADLINE_WINDOW_LABELS: Record<DeadlineWindow, string> = {
  week: "7일 이내 마감",
  day: "1일 이내 마감",
};

export const DEADLINE_CLOSED_LABEL = "입찰마감 종료";

export type DeadlineListFilter = "active" | "expired";

const WINDOW_MS: Record<DeadlineWindow, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

/** 공고의 마감 시각 (없으면 null) */
export function getNoticeDeadline(row: KhnpBidNoticeRow): Date | null {
  if (row.notice_period_end) {
    const end = new Date(row.notice_period_end);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      return end;
    }
  }

  if (row.notice_type === "BID") {
    const close = getOpenDetail(row)?.bid_close_dt;
    if (close) {
      const dt = new Date(close);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  return null;
}

export function isApproachingDeadline(
  row: KhnpBidNoticeRow,
  window: DeadlineWindow,
  now: Date = new Date(),
): boolean {
  const deadline = getNoticeDeadline(row);
  if (!deadline) return false;

  const start = now.getTime();
  const end = start + WINDOW_MS[window];
  const t = deadline.getTime();

  return t >= start && t <= end;
}

/** 입찰마감 시각이 현재보다 이전이면 true (마감 시각 없으면 false) */
export function isDeadlineExpired(
  row: KhnpBidNoticeRow,
  now: Date = new Date(),
): boolean {
  const deadline = getNoticeDeadline(row);
  if (!deadline) return false;
  return deadline.getTime() < now.getTime();
}

export type DeadlineUrgency = "normal" | "warning" | "urgent" | "expired";

export interface DeadlineCountdown {
  label: string;
  urgency: DeadlineUrgency;
  deadline: Date;
}

/** D-day 배지용 마감 카운트다운 */
export function getDeadlineCountdown(
  row: KhnpBidNoticeRow,
  now: Date = new Date(),
): DeadlineCountdown | null {
  const deadline = getNoticeDeadline(row);
  if (!deadline) return null;

  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) {
    return { label: "마감됨", urgency: "expired", deadline };
  }

  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 1) {
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    const label = diffHours <= 1 ? "1시간 이내" : `${diffHours}시간 남음`;
    return { label, urgency: "urgent", deadline };
  }
  if (diffDays <= 7) {
    return { label: `D-${diffDays}`, urgency: "warning", deadline };
  }
  return { label: `D-${diffDays}`, urgency: "normal", deadline };
}

/** 입찰 개시~마감 구간 진행률 (0–100), 구간 밖이면 null */
export function getBidPeriodProgress(
  startDt: string | null | undefined,
  closeDt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!startDt || !closeDt) return null;
  const start = new Date(startDt).getTime();
  const close = new Date(closeDt).getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(close) || close <= start) return null;
  if (nowMs <= start) return 0;
  if (nowMs >= close) return 100;
  return Math.round(((nowMs - start) / (close - start)) * 100);
}
