export function formatOpeningAmount(value: number | null | undefined): string {
  if (value == null) return "-";
  return value.toLocaleString("ko-KR");
}

export function formatOpeningRate(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}%`;
}

export function parseAmountInput(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function parseRateInput(value: string): number | null {
  const trimmed = value.trim().replace(/%/g, "").replace(/,/g, "");
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/** Excel 비율 셀 (0.79995, 99.93%, 101.2 등) */
export function parseOpeningPercentValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("%")) {
    return parseRateInput(trimmed);
  }
  const num = parseAmountInput(trimmed);
  if (num == null) return null;
  if (num > 0 && num < 10 && !Number.isInteger(num)) {
    return parseFloat((num * 100).toFixed(4));
  }
  return num;
}

/**
 * 확정예가(%) = 예정가격 ÷ 기초금액 × 100
 */
export function computeConfirmedEstimatedPriceRate(
  baseAmount: number | null | undefined,
  estimatedPrice: number | null | undefined,
): number | null {
  if (
    baseAmount == null ||
    estimatedPrice == null ||
    baseAmount <= 0
  ) {
    return null;
  }
  return parseFloat(((estimatedPrice / baseAmount) * 100).toFixed(4));
}

/**
 * 투찰율(%) = 투찰금액 ÷ 낙찰율 ÷ 기초금액 × 100
 */
export function computeBidRateFromAmount(
  bidAmount: number | null | undefined,
  awardRate: number | null | undefined,
  baseAmount: number | null | undefined,
): number | null {
  if (
    bidAmount == null ||
    awardRate == null ||
    baseAmount == null ||
    bidAmount <= 0 ||
    baseAmount <= 0
  ) {
    return null;
  }
  const normalizedAwardRate = normalizeStoredBidRate(awardRate);
  if (normalizedAwardRate == null || normalizedAwardRate <= 0) {
    return null;
  }
  return parseFloat(
    ((bidAmount / normalizedAwardRate / baseAmount) * 100).toFixed(4),
  );
}

export function formatBidRateInputValue(
  value: number | null | undefined,
): string {
  if (value == null) return "";
  return String(value);
}

export type BidOpeningAwardWinnerType = "ours" | "competitor";

export function formatAwardWinnerLabel(
  type: BidOpeningAwardWinnerType | null | undefined,
  competitorName?: string | null,
): string {
  if (type === "ours") return "우리";
  if (type === "competitor" && competitorName) return competitorName;
  if (type === "competitor") return "경쟁사";
  return "-";
}

export function isOursAwardWinnerLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["우리", "당사", "자사", "ours"].includes(normalized);
}

const DEFAULT_OUR_COMPANY_AWARD_NAMES = [
  "수산인더스트리",
  "(주)수산인더스트리",
  "수산",
  "soosan",
  "soosan industry",
];

/** 낙찰자·경쟁사 열 비교용 회사명 정규화 */
export function normalizeOurCompanyName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/^\(주\)/i, "")
    .replace(/㈜/g, "")
    .toLowerCase();
}

export function getOurCompanyAwardNames(): string[] {
  const fromEnv =
    process.env.BID_OPENING_OUR_COMPANY_NAMES?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...new Set([...DEFAULT_OUR_COMPANY_AWARD_NAMES, ...fromEnv])];
}

/** 그래프 제목용 우리 회사명 */
export function getOurCompanyChartTitle(): string {
  return (
    getOurCompanyAwardNames().find((name) => name.includes("인더스트리")) ??
    getOurCompanyAwardNames()[0] ??
    "우리"
  );
}

/** 그래프 범례용 짧은 우리 회사명 */
export function getOurCompanyChartLegendLabel(): string {
  return (
    getOurCompanyAwardNames().find((name) => name === "수산") ??
    getOurCompanyChartTitle()
  );
}

/** DB·Excel 혼용 투찰율(%) 정규화 */
export function normalizeStoredBidRate(
  rate: number | null | undefined,
): number | null {
  if (rate == null) return null;
  if (rate > 0 && rate < 10) {
    return parseFloat((rate * 100).toFixed(4));
  }
  return rate;
}

/** 낙찰자/경쟁사 열에 우리 회사명이 들어온 경우 */
export function isOurCompanyAwardName(value: string): boolean {
  if (isOursAwardWinnerLabel(value)) return true;
  const normalized = normalizeOurCompanyName(value);
  if (!normalized) return false;
  return getOurCompanyAwardNames().some(
    (name) => normalizeOurCompanyName(name) === normalized,
  );
}

export function parseCsvAwardWinner(value: string): {
  type: BidOpeningAwardWinnerType;
  competitorName: string | null;
} | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isOurCompanyAwardName(trimmed)) {
    return { type: "ours", competitorName: null };
  }
  return { type: "competitor", competitorName: trimmed };
}

/** 표시·입력용 날짜 (예: 26.06.15) */
export function formatOpeningDate(value: string | null | undefined): string {
  if (!value) return "-";
  const iso = parseOpeningDateInput(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  return `${year.slice(-2)}.${month}.${day}`;
}

/** YY.MM.DD 등 → DB 저장용 YYYY-MM-DD */
export function parseOpeningDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const shortDot = trimmed.match(/^(\d{2})[.](\d{1,2})[.](\d{1,2})$/);
  if (shortDot) {
    const year = 2000 + Number(shortDot[1]);
    const month = shortDot[2].padStart(2, "0");
    const day = shortDot[3].padStart(2, "0");
    return toIsoDate(year, month, day);
  }

  const shortDash = trimmed.match(/^(\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (shortDash) {
    const year = 2000 + Number(shortDash[1]);
    const month = shortDash[2].padStart(2, "0");
    const day = shortDash[3].padStart(2, "0");
    return toIsoDate(year, month, day);
  }

  const longForm = trimmed.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (longForm) {
    const month = longForm[2].padStart(2, "0");
    const day = longForm[3].padStart(2, "0");
    return toIsoDate(Number(longForm[1]), month, day);
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return toIsoDate(Number(iso[1]), iso[2], iso[3]);
  }

  return null;
}

function toIsoDate(year: number, month: string, day: string): string | null {
  const date = new Date(year, Number(month) - 1, Number(day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

export function toOpeningDateInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const formatted = formatOpeningDate(value);
  return formatted === "-" ? "" : formatted;
}

/** 우리 투찰금액이 0보다 큰 경우 */
export function hasOurOpeningBid(item: {
  ourBidAmount: number | null;
}): boolean {
  return item.ourBidAmount != null && item.ourBidAmount > 0;
}

/** 경쟁사 투찰 + 우리 투찰(금액>0) 건수 */
export function countOpeningResultBids(item: {
  ourBidAmount: number | null;
  bids: unknown[];
}): number {
  return item.bids.length + (hasOurOpeningBid(item) ? 1 : 0);
}
