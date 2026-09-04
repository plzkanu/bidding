"use client";

import { splitQualificationItems } from "@/lib/order-report-summary/qualification-format";
import type { SummaryPreviewRow } from "@/lib/order-report-summary/field-map";

interface OrderReportQualificationTableProps {
  rows: SummaryPreviewRow[];
}

export function OrderReportQualificationTable({
  rows,
}: OrderReportQualificationTableProps) {
  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="w-32 border border-[#BFBFBF] bg-[#2E74B5] px-4 py-2.5 text-center font-semibold text-white">
            구분
          </th>
          <th className="border border-[#BFBFBF] bg-[#2E74B5] px-4 py-2.5 text-center font-semibold text-white">
            제한내용
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const items = splitQualificationItems(row.value);
          return (
            <tr key={`${row.label}-${index}`} className="border border-[#BFBFBF]">
              <th
                scope="row"
                className="whitespace-nowrap border border-[#BFBFBF] bg-[#E7E6E6] px-4 py-2.5 text-center align-top font-semibold text-slate-700"
              >
                {row.label}
              </th>
              <td className="border border-[#BFBFBF] px-4 py-2.5 align-top text-slate-800">
                {items.length > 0 ? (
                  <ul className="space-y-1.5">
                    {items.map((item, itemIndex) => (
                      <li
                        key={`${row.label}-${itemIndex}`}
                        className="flex gap-2 leading-relaxed"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2E74B5]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  row.value
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
