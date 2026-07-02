"use client";

import { useEffect, useMemo, useState } from "react";
import type { BidOpeningResult } from "@/lib/bid-opening-results";
import {
  buildOpeningResultsComparisonData,
  formatComparisonRate,
  isComparisonWinnerCell,
} from "@/lib/bid-opening-results-comparison";
import {
  formatOpeningAmount,
  formatOpeningDate,
} from "@/lib/bid-opening-results-format";

interface BidOpeningResultsComparisonModalProps {
  categoryId: string;
  onClose: () => void;
  onSelectResult?: (item: BidOpeningResult) => void;
}

const FIXED_HEADER_CLASS =
  "border border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap";
const CELL_CLASS =
  "border border-slate-300 px-2 py-1 text-xs whitespace-nowrap tabular-nums";
const WINNER_CELL_CLASS = "bg-yellow-300";
const CONFIRMED_CELL_CLASS = "bg-[#FCE4D6]";

export function BidOpeningResultsComparisonModal({
  categoryId,
  onClose,
  onSelectResult,
}: BidOpeningResultsComparisonModalProps) {
  const [items, setItems] = useState<BidOpeningResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadComparisonData() {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (categoryId) {
          params.set("categoryId", categoryId);
        }
        const response = await fetch(
          `/api/bid-opening-results/chart?${params.toString()}`,
        );
        const data = (await response.json()) as {
          items?: BidOpeningResult[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "비교 데이터를 불러오지 못했습니다.");
        }
        setItems(data.items ?? []);
      } catch (err) {
        setItems([]);
        setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    loadComparisonData();
  }, [categoryId]);

  const tableData = useMemo(
    () => buildOpeningResultsComparisonData(items),
    [items],
  );

  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  function handleBidNameClick(resultId: string) {
    const item = itemsById.get(resultId);
    if (item && onSelectResult) {
      onSelectResult(item);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[92vh] w-full max-w-[96rem] flex-col rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">경쟁업체 비교</h2>
            <p className="mt-1 text-sm text-slate-500">
              입찰일 최신순 · 노란색: 낙찰 업체 투찰
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {isLoading ? (
            <p className="py-20 text-center text-sm text-slate-400">
              비교 데이터를 불러오는 중…
            </p>
          ) : error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : tableData.rows.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-500">
              표시할 개찰결과가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-300">
              <table className="w-max min-w-full border-collapse text-left">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th
                      rowSpan={2}
                      className={`${FIXED_HEADER_CLASS} sticky left-0 z-30 min-w-[18rem]`}
                    >
                      입찰명
                    </th>
                    <th rowSpan={2} className={`${FIXED_HEADER_CLASS} min-w-[5.5rem]`}>
                      입찰일
                    </th>
                    <th rowSpan={2} className={`${FIXED_HEADER_CLASS} min-w-[7.5rem]`}>
                      기초금액
                    </th>
                    <th rowSpan={2} className={`${FIXED_HEADER_CLASS} min-w-[7.5rem]`}>
                      예정가격
                    </th>
                    <th rowSpan={2} className={`${FIXED_HEADER_CLASS} min-w-[5.5rem]`}>
                      낙찰율
                    </th>
                    <th rowSpan={2} className={`${FIXED_HEADER_CLASS} min-w-[5.5rem] bg-[#FCE4D6]`}>
                      확정예가
                    </th>
                    {tableData.companies.map((company) => (
                      <th
                        key={company.id}
                        colSpan={2}
                        className={`${FIXED_HEADER_CLASS} min-w-[10rem]`}
                      >
                        {company.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {tableData.companies.flatMap((company) => [
                      <th
                        key={`${company.id}-amount`}
                        className={`${FIXED_HEADER_CLASS} min-w-[5.5rem]`}
                      >
                        투찰금액
                      </th>,
                      <th
                        key={`${company.id}-rate`}
                        className={`${FIXED_HEADER_CLASS} min-w-[4.5rem]`}
                      >
                        투찰율
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row) => {
                    const isOurAward = row.awardWinnerType === "ours";
                    return (
                      <tr key={row.resultId} className="hover:bg-slate-50/80">
                        <td
                          className={`${CELL_CLASS} sticky left-0 z-10 min-w-[18rem] max-w-[36rem] bg-white align-top whitespace-normal break-words ${
                            onSelectResult ? "cursor-pointer" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleBidNameClick(row.resultId)}
                            disabled={!onSelectResult}
                            className={`text-left ${
                              isOurAward
                                ? "font-medium text-red-600 hover:underline"
                                : "text-[#0563C1] hover:underline disabled:no-underline disabled:cursor-default"
                            }`}
                          >
                            {row.bidName}
                          </button>
                        </td>
                        <td className={`${CELL_CLASS} text-center`}>
                          {formatOpeningDate(row.bidDate)}
                        </td>
                        <td className={`${CELL_CLASS} text-right`}>
                          {formatOpeningAmount(row.baseAmount)}
                        </td>
                        <td className={`${CELL_CLASS} text-right`}>
                          {formatOpeningAmount(row.estimatedPrice)}
                        </td>
                        <td className={`${CELL_CLASS} text-right`}>
                          {formatComparisonRate(row.awardRate)}
                        </td>
                        <td
                          className={`${CELL_CLASS} text-right ${CONFIRMED_CELL_CLASS}`}
                        >
                          {formatComparisonRate(row.confirmedRate)}
                        </td>
                        {tableData.companies.flatMap((company) => {
                          const cell = row.bidsByCompanyId[company.id];
                          const isWinner = isComparisonWinnerCell(row, company.id);
                          const highlight = isWinner ? WINNER_CELL_CLASS : "";
                          return [
                            <td
                              key={`${company.id}-amount`}
                              className={`${CELL_CLASS} text-right ${highlight}`}
                            >
                              {cell?.amount != null
                                ? formatOpeningAmount(cell.amount)
                                : ""}
                            </td>,
                            <td
                              key={`${company.id}-rate`}
                              className={`${CELL_CLASS} text-right ${highlight}`}
                            >
                              {formatComparisonRate(cell?.rate)}
                            </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
