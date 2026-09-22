export interface PreliminaryPriceDistributionMeta {
  title: string;
  baseAmount: number;
  scoreFormula: string;
  projectName: string;
  companyName: string;
  maxCoefficient: number;
  minCoefficient: number;
  startRateBp: number;
  endRateBp: number;
  stepBp: number;
}

export interface PreliminaryPriceDistributionRow {
  no: number;
  rate: number;
  scheduledPrice: number;
  companyMax: number;
  companyMin: number;
  isBaseRate: boolean;
}

export interface PreliminaryPriceDistributionTable {
  meta: PreliminaryPriceDistributionMeta;
  rows: PreliminaryPriceDistributionRow[];
}

/** 첨부 용역기준표.xlsx 샘플 (새울1호기 RCP 용역) */
export const SAMPLE_SERVICE_PRELIMINARY_DISTRIBUTION: PreliminaryPriceDistributionMeta =
  {
    title: "복수예비가격 분포(100개) : 예비기초가격의 ±2.5%",
    baseAmount: 3_279_846_900,
    scoreFormula:
      "30 - 1 × |(88/100 - 입찰가격/예정가격) × 100|",
    projectName:
      "새울1호기 RCP 완전분해점검 및 RCP 순환품 완전분해점검 용역 [A26S049000]",
    companyName: "수산",
    maxCoefficient: 0.88,
    minCoefficient: 0.827,
    startRateBp: 10_250,
    endRateBp: 9_750,
    stepBp: 5,
  };

export function createPreliminaryPriceDistributionMeta(input: {
  baseAmount: number;
  projectName?: string;
}): PreliminaryPriceDistributionMeta {
  return {
    ...SAMPLE_SERVICE_PRELIMINARY_DISTRIBUTION,
    baseAmount: input.baseAmount,
    projectName: input.projectName?.trim() || "",
  };
}

function excelRound(value: number): number {
  return Math.round(value);
}

export function buildPreliminaryPriceDistribution(
  meta: PreliminaryPriceDistributionMeta = SAMPLE_SERVICE_PRELIMINARY_DISTRIBUTION,
): PreliminaryPriceDistributionTable {
  const rows: PreliminaryPriceDistributionRow[] = [];
  let no = 1;

  for (let bp = meta.startRateBp; bp >= meta.endRateBp; bp -= meta.stepBp) {
    const rate = bp / 10_000;
    const scheduledPrice = excelRound((meta.baseAmount * bp) / 10_000);
    const maxNumerator = Math.round(meta.maxCoefficient * 1000);
    const minNumerator = Math.round(meta.minCoefficient * 1000);
    rows.push({
      no,
      rate,
      scheduledPrice,
      companyMax: excelRound((scheduledPrice * maxNumerator) / 1000),
      companyMin: excelRound((scheduledPrice * minNumerator) / 1000),
      isBaseRate: bp === 10_000,
    });
    no += 1;
  }

  return { meta, rows };
}

export function formatDistributionRate(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`;
}

export function formatDistributionAmount(value: number): string {
  return value.toLocaleString("ko-KR");
}
