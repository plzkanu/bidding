import type { OrderReportSummaryScheduleStep } from "@/lib/order-report-summary/types";
import {
  emptyScheduleFlowSteps,
  getEffectiveScheduleSteps,
} from "@/lib/order-report-summary/schedule-flow";

interface OrderReportScheduleFlowProps {
  steps?: OrderReportSummaryScheduleStep[] | null;
  placeholder?: boolean;
}

function displayDate(value: string, placeholder: boolean): string {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  return placeholder ? "" : "—";
}

export function OrderReportScheduleFlow({
  steps,
  placeholder = false,
}: OrderReportScheduleFlowProps) {
  const flowSteps = steps?.length
    ? getEffectiveScheduleSteps(steps)
    : placeholder
      ? emptyScheduleFlowSteps()
      : [];

  if (flowSteps.length === 0 && !placeholder) {
    return (
      <p className="mt-4 text-sm text-slate-300">미기재</p>
    );
  }

  return (
    <div className="mt-4 flex items-stretch">
      {flowSteps.map((step, index) => (
        <div key={`${step.단계}-${index}`} className="flex min-w-0 flex-1 items-stretch">
          {index > 0 ? (
            <div
              className="flex shrink-0 items-center px-1 text-[10px] text-[#2E74B5]"
              aria-hidden
            >
              ▶
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center border border-[#BFBFBF] bg-[#E7E6E6] px-2 py-3 text-center text-xs leading-relaxed">
            <div className="font-semibold whitespace-pre-wrap text-slate-800">
              {displayDate(step.날짜, placeholder) || (
                <span className="text-slate-300">
                  {placeholder ? "일정" : "—"}
                </span>
              )}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-slate-700">
              {step.단계 || (
                <span className="text-slate-300">
                  {placeholder ? "단계" : "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
