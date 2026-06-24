import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { isClaudeConfigured } from "@/lib/claude/config";
import { isExaoneConfigured } from "@/lib/exaone/config";
import {
  ORDER_REPORT_SUMMARY_ENGINE_LABELS,
  ORDER_REPORT_SUMMARY_ENGINES,
  type OrderReportSummaryEngine,
} from "@/lib/order-report-summary/engines";

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }

  const configured: Record<OrderReportSummaryEngine, boolean> = {
    claude: isClaudeConfigured(),
    exaone: isExaoneConfigured(),
  };

  const engines = ORDER_REPORT_SUMMARY_ENGINES.map((id) => ({
    id,
    label: ORDER_REPORT_SUMMARY_ENGINE_LABELS[id],
    configured: configured[id],
  }));

  return NextResponse.json({ engines });
}
