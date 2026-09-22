"use client";

import { useEffect } from "react";
import {
  buildPreliminaryPriceDistribution,
  createPreliminaryPriceDistributionMeta,
  formatDistributionAmount,
  formatDistributionRate,
} from "@/lib/bid-notices/preliminary-price-distribution";

interface PreliminaryPriceDistributionModalProps {
  onClose: () => void;
  baseAmount: number | null;
  projectName?: string;
}

const HEADER_CLASS =
  "border border-[#BFBFBF] bg-[#1F4E78] px-2 py-2 text-center text-xs font-semibold text-white";
const CELL_CLASS =
  "border border-[#BFBFBF] px-2 py-1.5 text-center text-xs tabular-nums text-slate-800";

export function PreliminaryPriceDistributionModal({
  onClose,
  baseAmount,
  projectName,
}: PreliminaryPriceDistributionModalProps) {
  const table =
    baseAmount != null && baseAmount > 0
      ? buildPreliminaryPriceDistribution(
          createPreliminaryPriceDistributionMeta({
            baseAmount,
            projectName,
          }),
        )
      : null;
  const meta = table?.meta;
  const rows = table?.rows ?? [];

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preliminary-price-distribution-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2
            id="preliminary-price-distribution-title"
            className="text-lg font-semibold text-slate-800"
          >
            예비가격분포표
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {!meta ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
              예비가격기초금액이 없어 분포표를 계산할 수 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-sm border border-[#BFBFBF]">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <th
                      colSpan={6}
                      className="border border-[#BFBFBF] bg-[#1F4E78] px-3 py-2.5 text-center text-sm font-bold text-white"
                    >
                      {meta.title}
                    </th>
                  </tr>
                  <tr>
                    <th
                      colSpan={2}
                      className="border border-[#BFBFBF] bg-[#E7E6E6] px-3 py-2 text-left text-xs font-semibold text-slate-700"
                    >
                      ※ 예비기초가격 :
                    </th>
                    <td
                      colSpan={4}
                      className="border border-[#BFBFBF] px-3 py-2 text-sm tabular-nums font-medium text-slate-800"
                    >
                      {formatDistributionAmount(meta.baseAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={6}
                      className="border border-[#BFBFBF] px-3 py-2 text-xs text-slate-700"
                    >
                      ※ 평 가 산 식 : {meta.scoreFormula}
                    </td>
                  </tr>
                  <tr>
                    <th
                      colSpan={2}
                      className="border border-[#BFBFBF] bg-[#E7E6E6] px-3 py-2 text-left text-xs font-semibold text-slate-700"
                    >
                      ※ 공 사 명 :
                    </th>
                    <td
                      colSpan={4}
                      className="border border-[#BFBFBF] px-3 py-2 text-sm text-slate-800"
                    >
                      {meta.projectName}
                    </td>
                  </tr>
                </tbody>
              </table>
              <table className="-mt-px w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th rowSpan={2} className={`${HEADER_CLASS} w-14`}>
                      NO.
                    </th>
                    <th rowSpan={2} className={`${HEADER_CLASS} w-16`}>
                      분포
                    </th>
                    <th rowSpan={2} className={`${HEADER_CLASS} w-28`}>
                      비율
                    </th>
                    <th rowSpan={2} className={`${HEADER_CLASS} w-36`}>
                      예정가
                    </th>
                    <th colSpan={2} className={HEADER_CLASS}>
                      {meta.companyName}
                    </th>
                  </tr>
                  <tr>
                    <th className={HEADER_CLASS}>최대(+)</th>
                    <th className={HEADER_CLASS}>최소(-)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.no}
                      className={row.isBaseRate ? "bg-yellow-300" : "bg-white"}
                    >
                      <td className={CELL_CLASS}>{row.no}</td>
                      <td className={CELL_CLASS} />
                      <td className={CELL_CLASS}>
                        {formatDistributionRate(row.rate)}
                      </td>
                      <td className={`${CELL_CLASS} text-right`}>
                        {formatDistributionAmount(row.scheduledPrice)}
                      </td>
                      <td className={`${CELL_CLASS} text-right`}>
                        {formatDistributionAmount(row.companyMax)}
                      </td>
                      <td className={`${CELL_CLASS} text-right`}>
                        {formatDistributionAmount(row.companyMin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
