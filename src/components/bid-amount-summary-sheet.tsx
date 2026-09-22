"use client";

import { useState, type ReactNode } from "react";
import { PreliminaryPriceDistributionModal } from "@/components/preliminary-price-distribution-modal";
import type { BidAmountSheetData } from "@/lib/bid-notices/bid-amount-sheet";
import {
  formatOpeningAmount,
  parseAmountInput,
} from "@/lib/bid-opening-results-format";

interface BidAmountSummarySheetProps {
  sheet: BidAmountSheetData;
  bidAmount: string;
  onBidAmountChange: (value: string) => void;
  disabled?: boolean;
}

const LABEL =
  "border border-[#BFBFBF] bg-[#D6DCE4] px-2 py-2 text-center text-xs font-semibold text-slate-700";
const VALUE =
  "border border-[#BFBFBF] bg-white px-3 py-2 align-middle text-sm text-slate-800";
const HEADER =
  "border border-[#BFBFBF] bg-[#1F4E78] px-3 py-2 text-left text-sm font-bold text-white";
const PQ_HEAD =
  "border border-[#BFBFBF] bg-[#5B9BD5] px-2 py-2.5 text-center text-sm font-semibold text-white";
const PQ_CELL =
  "border border-[#BFBFBF] bg-white px-2 py-2.5 text-center text-sm text-slate-800";
const PQ_GROUP =
  "border border-[#BFBFBF] bg-[#D6DCE4] px-2 py-2.5 text-center text-sm font-semibold text-slate-700";
const PQ_TOTAL =
  "border border-[#BFBFBF] bg-[#1F4E78] px-2 py-2.5 text-center text-sm font-semibold text-white";

function displayOrBlank(value: string): string {
  return value.trim() ? value : "";
}

function LabelCell({
  children,
  rowSpan,
  colSpan = 2,
  className = "",
}: {
  children: ReactNode;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <th
      scope="row"
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`${LABEL} ${className}`}
    >
      {children}
    </th>
  );
}

function ValueCell({
  children,
  colSpan,
  className = "",
}: {
  children: ReactNode;
  colSpan: number;
  className?: string;
}) {
  return (
    <td colSpan={colSpan} className={`${VALUE} ${className}`}>
      {children}
    </td>
  );
}

export function BidAmountSummarySheet({
  sheet,
  bidAmount,
  onBidAmountChange,
  disabled = false,
}: BidAmountSummarySheetProps) {
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const pqRows = sheet.적격심사;
  const capabilityRows = pqRows.filter(
    (row) => row.구분 === "수행능력평가",
  );
  const priceRow = pqRows.find((row) => row.구분 === "입찰가격 평가");
  const totalRow = pqRows.find((row) => row.총계);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold text-[#1F4E78]">I. 입찰 내역</h3>
          <button
            type="button"
            onClick={() => setIsDistributionOpen(true)}
            className="rounded-md border border-[#004b87]/30 bg-[#004b87]/5 px-3 py-1 text-xs font-medium text-[#004b87] hover:bg-[#004b87]/10"
          >
            예비가격분포표
          </button>
        </div>
        {isDistributionOpen ? (
          <PreliminaryPriceDistributionModal
            onClose={() => setIsDistributionOpen(false)}
            baseAmount={sheet.baseAmountNumber}
            projectName={sheet.공사명}
          />
        ) : null}

        <div className="overflow-x-auto rounded-sm border border-[#BFBFBF] bg-white">
          <table className="w-full min-w-[52rem] table-fixed border-collapse">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[5%]" />
              <col className="w-[11%]" />
              <col className="w-[5%]" />
              <col className="w-[11%]" />
              <col className="w-[5%]" />
              <col className="w-[11%]" />
              <col className="w-[5%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <tbody>
              <tr>
                <th colSpan={2} className={HEADER}>
                  I. 입찰 내역
                </th>
                <td colSpan={8} className="border border-[#BFBFBF] bg-white" />
              </tr>
              <tr>
                <LabelCell>{("공 사 명")}</LabelCell>
                <ValueCell colSpan={8} className="font-medium">
                  {displayOrBlank(sheet.공사명)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>입 찰 종 류</LabelCell>
                <ValueCell colSpan={3}>
                  {displayOrBlank(sheet.입찰종류)}
                </ValueCell>
                <LabelCell>입 찰 방 법</LabelCell>
                <ValueCell colSpan={3}>
                  {displayOrBlank(sheet.입찰방법)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>낙찰자결정방법</LabelCell>
                <ValueCell colSpan={3}>
                  {displayOrBlank(sheet.낙찰자결정방법)}
                </ValueCell>
                <LabelCell>발 주 기 관</LabelCell>
                <ValueCell colSpan={3}>
                  {displayOrBlank(sheet.발주기관)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell className="align-top">투 찰 일 자</LabelCell>
                <ValueCell colSpan={8} className="whitespace-pre-wrap leading-relaxed">
                  {displayOrBlank(sheet.투찰일자)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell className="align-top">
                  입 찰 참 가 자 격
                </LabelCell>
                <ValueCell
                  colSpan={8}
                  className="min-h-[6rem] whitespace-pre-wrap align-top leading-relaxed"
                >
                  {displayOrBlank(sheet.입찰참가자격)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>추 정 금 액</LabelCell>
                <ValueCell colSpan={3} className="tabular-nums">
                  {displayOrBlank(sheet.추정금액)}
                </ValueCell>
                <LabelCell>추 정 가 격</LabelCell>
                <ValueCell colSpan={3} className="tabular-nums">
                  {displayOrBlank(sheet.추정가격)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>예비가격기초금액</LabelCell>
                <ValueCell colSpan={6} className="tabular-nums">
                  {displayOrBlank(sheet.예비가격기초금액)}
                </ValueCell>
                <ValueCell
                  colSpan={2}
                  className="text-center text-xs text-slate-600"
                >
                  (VAT 포함)
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>{sheet.기간라벨}</LabelCell>
                <ValueCell colSpan={8}>{displayOrBlank(sheet.기간)}</ValueCell>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold text-[#1F4E78]">II. 적격심사</h3>
        <div className="overflow-x-auto rounded-sm border border-[#BFBFBF] bg-white">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead>
              <tr>
                <th className={`${PQ_HEAD} w-36`}>구분</th>
                <th className={`${PQ_HEAD} w-40`}>평가항목</th>
                <th className={`${PQ_HEAD} w-32`}>배점</th>
                <th className={`${PQ_HEAD} w-32`}>득점</th>
                <th className={PQ_HEAD}>비고</th>
              </tr>
            </thead>
            <tbody>
              {capabilityRows.map((row, index) => (
                <tr key={row.평가항목}>
                  {index === 0 ? (
                    <th rowSpan={capabilityRows.length} className={PQ_GROUP}>
                      수행능력평가
                    </th>
                  ) : null}
                  <td
                    className={`${PQ_CELL} ${
                      row.소계 ? "bg-[#FFF2CC] font-semibold" : ""
                    }`}
                  >
                    {row.평가항목}
                  </td>
                  <td className={`${PQ_CELL} tabular-nums`}>{row.배점}</td>
                  <td className={`${PQ_CELL} tabular-nums`}>{row.득점}</td>
                  <td className={PQ_CELL}>{row.비고}</td>
                </tr>
              ))}
              {priceRow ? (
                <tr>
                  <th colSpan={2} className={PQ_GROUP}>
                    {priceRow.구분}
                  </th>
                  <td className={`${PQ_CELL} tabular-nums`}>{priceRow.배점}</td>
                  <td className={`${PQ_CELL} tabular-nums`}>{priceRow.득점}</td>
                  <td className={PQ_CELL}>{priceRow.비고}</td>
                </tr>
              ) : null}
              {totalRow ? (
                <tr>
                  <th colSpan={2} className={PQ_TOTAL}>
                    총 계
                  </th>
                  <td className={`${PQ_TOTAL} tabular-nums`}>{totalRow.배점}</td>
                  <td className={`${PQ_TOTAL} tabular-nums`}>{totalRow.득점}</td>
                  <td className={PQ_TOTAL}>{totalRow.비고}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold text-[#1F4E78]">Ⅲ. 투찰가격</h3>
        <div className="overflow-hidden rounded-sm border border-[#BFBFBF] bg-white">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <th colSpan={2} className={`${HEADER} w-40`}>
                  Ⅲ. 투찰가격
                </th>
                <td className="border border-[#BFBFBF] bg-white" />
              </tr>
              <tr>
                <th className={`${LABEL} w-40`}>투찰가격</th>
                <td className={`${VALUE} min-h-[5.5rem]`}>
                  <div className="flex min-h-[4.5rem] items-center justify-end gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bidAmount}
                      onChange={(event) => onBidAmountChange(event.target.value)}
                      disabled={disabled}
                      placeholder=""
                      aria-label="투찰가격"
                      className="min-h-[2.75rem] w-full max-w-md border-0 border-b border-slate-400 bg-transparent px-1 py-1 text-right text-lg tabular-nums text-slate-900 outline-none focus:border-[#004b87] disabled:text-slate-500"
                    />
                    <span className="shrink-0 text-sm text-slate-600">원</span>
                  </div>
                  {parseAmountInput(bidAmount) != null ? (
                    <p className="mt-1 text-right text-xs text-slate-500">
                      {formatOpeningAmount(parseAmountInput(bidAmount))}원
                    </p>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
