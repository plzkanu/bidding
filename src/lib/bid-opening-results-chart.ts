import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  computeConfirmedEstimatedPriceRate,
  getOurCompanyChartLegendLabel,
  hasOurOpeningBid,
  normalizeStoredBidRate,
} from "@/lib/bid-opening-results-format";

export const CONFIRMED_SERIES_ID = "confirmed";

export interface OpeningResultsChartCompany {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export interface OpeningResultsChartData {
  pointLabels: string[];
  confirmedSeries: OpeningResultsChartCompany;
  companies: OpeningResultsChartCompany[];
}

const COMPANY_COLORS = [
  "#004b87",
  "#e85d4c",
  "#2a9d8f",
  "#f4a261",
  "#7b6fd6",
  "#3d8bfd",
  "#6c757d",
  "#e9c46a",
];

export function buildOpeningResultsChartData(
  items: BidOpeningResult[],
): OpeningResultsChartData {
  const pointLabels = items.map((_, index) => String(index + 1));
  const confirmedValues = items.map((item) =>
    computeConfirmedEstimatedPriceRate(item.baseAmount, item.estimatedPrice),
  );

  const companyMap = new Map<
    string,
    { label: string; values: (number | null)[] }
  >();

  const oursId = "ours";
  const oursLabel = getOurCompanyChartLegendLabel();
  companyMap.set(oursId, {
    label: oursLabel,
    values: items.map((item) =>
      hasOurOpeningBid(item)
        ? normalizeStoredBidRate(item.ourBidRate)
        : null,
    ),
  });

  for (const item of items) {
    for (const bid of item.bids) {
      const id = `competitor:${bid.competitorId}`;
      if (!companyMap.has(id)) {
        companyMap.set(id, {
          label: bid.competitorName,
          values: items.map(() => null),
        });
      }
    }
  }

  items.forEach((item, index) => {
    for (const bid of item.bids) {
      const id = `competitor:${bid.competitorId}`;
      const entry = companyMap.get(id);
      if (!entry) continue;
      const rate = normalizeStoredBidRate(bid.bidRate);
      if (rate != null) {
        entry.values[index] = rate;
      }
    }
  });

  const companies = [...companyMap.entries()]
    .filter(([, series]) => series.values.some((value) => value != null))
    .map(([id, series], index) => ({
      id,
      label: series.label,
      color: COMPANY_COLORS[index % COMPANY_COLORS.length],
      values: series.values,
    }));

  return {
    pointLabels,
    confirmedSeries: {
      id: CONFIRMED_SERIES_ID,
      label: "확정예가",
      color: "#7c5cbf",
      values: confirmedValues,
    },
    companies,
  };
}

export function getDefaultSelectedCompanyIds(
  data: OpeningResultsChartData,
): string[] {
  const ours = data.companies.find((company) => company.id === "ours");
  return ours ? [ours.id] : data.companies.slice(0, 1).map((c) => c.id);
}

export function formatChartRateLabel(value: number): string {
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}%`;
}

export function computeChartYAxis(values: number[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  if (values.length === 0) {
    return { min: 95, max: 105, ticks: [95, 97.5, 100, 102.5, 105] };
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const min = Math.floor((minValue - 2.5) / 2.5) * 2.5;
  const max = Math.ceil((maxValue + 2.5) / 2.5) * 2.5;
  const ticks: number[] = [];
  for (let tick = min; tick <= max + 0.001; tick += 2.5) {
    ticks.push(parseFloat(tick.toFixed(4)));
  }
  return { min, max, ticks };
}
