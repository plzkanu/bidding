import type { SummaryPreviewRow, SummaryPreviewSubTable } from "@/lib/order-report-summary/field-map";

interface OrderReportOverviewSectionProps {
  rows: SummaryPreviewRow[];
  subTables?: SummaryPreviewSubTable[];
  footnotes?: string;
}

export function OrderReportOverviewSection({
  rows,
  subTables = [],
  footnotes,
}: OrderReportOverviewSectionProps) {
  return (
    <div className="mt-4 space-y-3">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.label}-${index}`} className="border border-[#BFBFBF]">
              <th
                scope="row"
                className="w-32 whitespace-nowrap border border-[#BFBFBF] bg-[#E7E6E6] px-4 py-2.5 text-center align-top font-semibold text-slate-700"
              >
                {row.label}
              </th>
              <td className="border border-[#BFBFBF] px-4 py-2.5 align-top whitespace-pre-wrap text-slate-800">
                {row.value}
              </td>
            </tr>
          ))}
          {subTables.map((table, tableIndex) => (
            <tr
              key={`${table.title}-${tableIndex}`}
              className="border border-[#BFBFBF]"
            >
              <th
                scope="row"
                className="w-32 whitespace-nowrap border border-[#BFBFBF] bg-[#E7E6E6] px-4 py-2.5 text-center align-top font-semibold text-slate-700"
              >
                {table.title}
              </th>
              <td className="border border-[#BFBFBF] p-0 align-top">
                <table className="w-full border-collapse text-xs">
                  {table.headers.length > 0 ? (
                    <thead>
                      <tr>
                        {table.headers.map((header, headerIndex) => (
                          <th
                            key={`${header}-${headerIndex}`}
                            className="border border-[#BFBFBF] bg-[#E7E6E6] px-2 py-2 text-center font-semibold text-slate-700"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {table.rows.map((cells, rowIndex) => (
                      <tr key={rowIndex}>
                        {cells.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border border-[#BFBFBF] px-2 py-2 text-center align-top whitespace-pre-wrap text-slate-800"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {table.note ? (
                  <p className="px-3 py-2 text-xs whitespace-pre-wrap text-slate-600">
                    {table.note}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {footnotes ? (
        <p className="text-xs whitespace-pre-wrap text-[#2E74B5]">{footnotes}</p>
      ) : null}
    </div>
  );
}
