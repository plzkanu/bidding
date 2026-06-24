const KST_TIME_ZONE = "Asia/Seoul";

export const NOTICE_DATE_YESTERDAY_LABEL = "공고일시 전일자만 보기";

function getKstTodayStart(now: Date): Date {
  const todayYmd = now.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE });
  return new Date(`${todayYmd}T00:00:00+09:00`);
}

/** KST 기준 요일 (0=일, 1=월, …, 6=토) */
function getKstWeekday(now: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * 공고일시 전일자 필터 범위 (KST)
 * - 월요일: 금·토·일 (금요일 00:00 ~ 월요일 00:00)
 * - 그 외: 전일 (어제 00:00 ~ 오늘 00:00)
 */
export function getKstYesterdayNoticeDateRange(now = new Date()): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const todayStart = getKstTodayStart(now);
  const weekday = getKstWeekday(now);

  if (weekday === 1) {
    const fridayStart = new Date(
      todayStart.getTime() - 3 * 24 * 60 * 60 * 1000,
    );
    return {
      startIso: fridayStart.toISOString(),
      endIso: todayStart.toISOString(),
      label: "금·토·일",
    };
  }

  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayYmd = yesterdayStart.toLocaleDateString("en-CA", {
    timeZone: KST_TIME_ZONE,
  });

  return {
    startIso: yesterdayStart.toISOString(),
    endIso: todayStart.toISOString(),
    label: yesterdayYmd,
  };
}

export function getNoticeDateYesterdayFilterSummary(now = new Date()): string {
  if (getKstWeekday(now) === 1) {
    return "공고일시 금·토·일";
  }
  return "공고일시 전일자";
}

/** KST 기준 YYYY-MM-DD */
export function toKstDateYmd(value: string | Date, now?: Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return now
      ? now.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE })
      : "";
  }
  return date.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE });
}

export function getKstTodayYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE });
}

/** 오늘 포함 최근 30일 (KST 00:00 기준) */
export function getKstRollingMonthRange(now = new Date()): {
  startIso: string;
  endIso: string;
  startYmd: string;
  endYmd: string;
} {
  const todayStart = getKstTodayStart(now);
  const start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
  const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startYmd: start.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE }),
    endYmd: todayStart.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE }),
  };
}

/** KST 특정 일자 00:00 ~ 다음날 00:00 */
export function getKstDayRange(ymd: string): { startIso: string; endIso: string } {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function isValidNoticeDateYmd(
  value: string | null | undefined,
): value is string {
  if (!value?.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return false;
  return toKstDateYmd(date) === value;
}

export function formatNoticeDateFilterSummary(ymd: string): string {
  return `공고일시 ${formatKstDateLabel(ymd)}`;
}

export function formatKstDateLabel(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return ymd;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: KST_TIME_ZONE,
  });
}

/** KST 기준 요일 (0=일 … 6=토) */
export function getKstWeekdayFromYmd(ymd: string): number {
  const date = new Date(`${ymd}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getUTCDay();
}

export function addKstDaysYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: KST_TIME_ZONE });
}

/** startYmd ~ endYmd (포함) 일자 배열 */
export function listKstYmdRange(startYmd: string, endYmd: string): string[] {
  const result: string[] = [];
  let current = startYmd;
  while (current <= endYmd) {
    result.push(current);
    current = addKstDaysYmd(current, 1);
  }
  return result;
}
