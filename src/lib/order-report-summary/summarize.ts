import { summarizeOrderReportWithClaude } from "@/lib/claude/summarize-order-report";
import { getClaudeConfigError } from "@/lib/claude/config";
import { summarizeOrderReportWithExaone } from "@/lib/exaone/summarize-order-report";
import { getExaoneConfigError } from "@/lib/exaone/config";
import type { OrderReportSummaryEngine } from "@/lib/order-report-summary/engines";
import type { SummarizeOrderReportInput } from "@/lib/order-report-summary/summarize-input";
import type {
  OrderReportPqAutoSummary,
  OrderReportSummaryData,
} from "@/lib/order-report-summary/types";
import { summarizePqOrderReportWithClaude } from "@/lib/claude/summarize-pq-report";
import { summarizePqOrderReportWithExaone } from "@/lib/exaone/summarize-pq-report";

export function getEngineConfigError(
  engine: OrderReportSummaryEngine,
): string | null {
  if (engine === "exaone") {
    return getExaoneConfigError();
  }
  return getClaudeConfigError();
}

export async function summarizeOrderReport(
  engine: OrderReportSummaryEngine,
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportSummaryData; model: string }> {
  if (engine === "exaone") {
    return summarizeOrderReportWithExaone(input);
  }
  return summarizeOrderReportWithClaude(input);
}

export async function summarizePqOrderReport(
  engine: OrderReportSummaryEngine,
  input: SummarizeOrderReportInput,
): Promise<{ summary: OrderReportPqAutoSummary; model: string }> {
  if (engine === "exaone") {
    return summarizePqOrderReportWithExaone(input);
  }
  return summarizePqOrderReportWithClaude(input);
}
