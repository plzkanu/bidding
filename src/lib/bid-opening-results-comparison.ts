import type { BidOpeningResult } from "@/lib/bid-opening-results";
import { formatChartRateLabel } from "@/lib/bid-opening-results-chart";
import {
  computeConfirmedEstimatedPriceRate,
  getOurCompanyChartLegendLabel,
  hasOurOpeningBid,
  normalizeStoredBidRate,
} from "@/lib/bid-opening-results-format";

export const OUR_COMPANY_COMPARISON_ID = "ours";

export interface ComparisonCompanyColumn {
  id: string;
  label: string;
}

export interface ComparisonBidCell {
  amount: number | null;
  rate: number | null;
}

export interface ComparisonTableRow {
  resultId: string;
  bidName: string;
  bidDate: string | null;
  baseAmount: number | null;
  estimatedPrice: number | null;
  awardRate: number | null;
  confirmedRate: number | null;
  awardWinnerType: BidOpeningResult["awardWinnerType"];
  awardWinnerCompetitorId: string | null;
  bidsByCompanyId: Record<string, ComparisonBidCell>;
}

export interface ComparisonTableData {
  companies: ComparisonCompanyColumn[];
  rows: ComparisonTableRow[];
}

function compareBidDatesDesc(
  a: BidOpeningResult,
  b: BidOpeningResult,
): number {
  const dateA = a.bidDate ?? "";
  const dateB = b.bidDate ?? "";
  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

export function buildOpeningResultsComparisonData(
  items: BidOpeningResult[],
): ComparisonTableData {
  const companyMap = new Map<string, string>();
  companyMap.set(OUR_COMPANY_COMPARISON_ID, getOurCompanyChartLegendLabel());

  for (const item of items) {
    for (const bid of item.bids) {
      const id = `competitor:${bid.competitorId}`;
      if (!companyMap.has(id)) {
        companyMap.set(id, bid.competitorName);
      }
    }
  }

  const competitors = [...companyMap.entries()]
    .filter(([id]) => id !== OUR_COMPANY_COMPARISON_ID)
    .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, "ko"));

  const companies: ComparisonCompanyColumn[] = [
    {
      id: OUR_COMPANY_COMPARISON_ID,
      label: companyMap.get(OUR_COMPANY_COMPARISON_ID)!,
    },
    ...competitors.map(([id, label]) => ({ id, label })),
  ];

  const rows = [...items].sort(compareBidDatesDesc).map((item) => {
    const bidsByCompanyId: Record<string, ComparisonBidCell> = {};

    if (hasOurOpeningBid(item)) {
      bidsByCompanyId[OUR_COMPANY_COMPARISON_ID] = {
        amount: item.ourBidAmount,
        rate: normalizeStoredBidRate(item.ourBidRate),
      };
    }

    for (const bid of item.bids) {
      const id = `competitor:${bid.competitorId}`;
      bidsByCompanyId[id] = {
        amount: bid.bidAmount,
        rate: normalizeStoredBidRate(bid.bidRate),
      };
    }

    return {
      resultId: item.id,
      bidName: item.bidName,
      bidDate: item.bidDate,
      baseAmount: item.baseAmount,
      estimatedPrice: item.estimatedPrice,
      awardRate: normalizeStoredBidRate(item.awardRate),
      confirmedRate: computeConfirmedEstimatedPriceRate(
        item.baseAmount,
        item.estimatedPrice,
      ),
      awardWinnerType: item.awardWinnerType,
      awardWinnerCompetitorId: item.awardWinnerCompetitorId,
      bidsByCompanyId,
    };
  });

  return { companies, rows };
}

export function isComparisonWinnerCell(
  row: ComparisonTableRow,
  companyId: string,
): boolean {
  if (row.awardWinnerType === "ours") {
    return companyId === OUR_COMPANY_COMPARISON_ID;
  }
  if (row.awardWinnerType === "competitor" && row.awardWinnerCompetitorId) {
    return companyId === `competitor:${row.awardWinnerCompetitorId}`;
  }
  return false;
}

export function formatComparisonRate(value: number | null | undefined): string {
  if (value == null) return "";
  return formatChartRateLabel(value);
}
