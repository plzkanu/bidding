export const ORDER_REPORT_SUMMARY_ENGINES = ["exaone", "claude"] as const;

export type OrderReportSummaryEngine =
  (typeof ORDER_REPORT_SUMMARY_ENGINES)[number];

export const DEFAULT_ORDER_REPORT_SUMMARY_ENGINE: OrderReportSummaryEngine =
  "exaone";

export const ORDER_REPORT_SUMMARY_ENGINE_LABELS: Record<
  OrderReportSummaryEngine,
  string
> = {
  exaone: "LG엑사원",
  claude: "클로드",
};

export function isOrderReportSummaryEngine(
  value: unknown,
): value is OrderReportSummaryEngine {
  return (
    typeof value === "string" &&
    (ORDER_REPORT_SUMMARY_ENGINES as readonly string[]).includes(value)
  );
}

export function parseOrderReportSummaryEngine(
  value: unknown,
): OrderReportSummaryEngine {
  if (isOrderReportSummaryEngine(value)) {
    return value;
  }
  return DEFAULT_ORDER_REPORT_SUMMARY_ENGINE;
}
