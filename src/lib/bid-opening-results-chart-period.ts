export type ChartPeriodPreset = "3m" | "1y" | "2y" | "3y" | "all" | "custom";

export const DEFAULT_CHART_PERIOD: ChartPeriodPreset = "1y";

export const CHART_PERIOD_PRESETS: Array<{
  id: ChartPeriodPreset;
  label: string;
}> = [
  { id: "3m", label: "최근 3개월" },
  { id: "1y", label: "최근 1년" },
  { id: "2y", label: "최근 2년" },
  { id: "3y", label: "최근 3년" },
  { id: "all", label: "전체" },
  { id: "custom", label: "기간입력" },
];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function subtractYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  return result;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return toIsoDate(parsed) === value;
}

export function resolveChartPeriodRange(options: {
  preset: ChartPeriodPreset;
  customDateFrom?: string | null;
  customDateTo?: string | null;
  now?: Date;
}): {
  dateFrom: string | null;
  dateTo: string | null;
  error: string | null;
} {
  const now = options.now ?? new Date();
  const dateTo = toIsoDate(now);

  switch (options.preset) {
    case "3m":
      return {
        dateFrom: toIsoDate(subtractMonths(now, 3)),
        dateTo,
        error: null,
      };
    case "1y":
      return {
        dateFrom: toIsoDate(subtractYears(now, 1)),
        dateTo,
        error: null,
      };
    case "2y":
      return {
        dateFrom: toIsoDate(subtractYears(now, 2)),
        dateTo,
        error: null,
      };
    case "3y":
      return {
        dateFrom: toIsoDate(subtractYears(now, 3)),
        dateTo,
        error: null,
      };
    case "all":
      return { dateFrom: null, dateTo: null, error: null };
    case "custom": {
      const dateFrom = options.customDateFrom?.trim() || null;
      const customDateTo = options.customDateTo?.trim() || null;

      if (!dateFrom || !customDateTo) {
        return {
          dateFrom: null,
          dateTo: null,
          error: "시작일과 종료일을 입력해 주세요.",
        };
      }
      if (!isValidIsoDate(dateFrom) || !isValidIsoDate(customDateTo)) {
        return {
          dateFrom: null,
          dateTo: null,
          error: "날짜 형식이 올바르지 않습니다.",
        };
      }
      if (dateFrom > customDateTo) {
        return {
          dateFrom: null,
          dateTo: null,
          error: "시작일이 종료일보다 늦을 수 없습니다.",
        };
      }
      return {
        dateFrom,
        dateTo: customDateTo,
        error: null,
      };
    }
    default:
      return { dateFrom: null, dateTo: null, error: null };
  }
}

export function getDefaultCustomDateRange(now = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: toIsoDate(subtractYears(now, 1)),
    dateTo: toIsoDate(now),
  };
}

export function formatChartPeriodSummary(
  preset: ChartPeriodPreset,
  dateFrom: string | null,
  dateTo: string | null,
): string {
  if (preset === "all") return "전체 기간";
  if (dateFrom && dateTo) return `${dateFrom} ~ ${dateTo}`;
  const label = CHART_PERIOD_PRESETS.find((item) => item.id === preset)?.label;
  return label ?? "";
}

export function appendChartPeriodSearchParams(
  params: URLSearchParams,
  options: {
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): void {
  if (options.dateFrom) {
    params.set("dateFrom", options.dateFrom);
  }
  if (options.dateTo) {
    params.set("dateTo", options.dateTo);
  }
}
