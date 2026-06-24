import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listWorkResults } from "@/lib/bid-notices/work-results";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    { error: getSupabaseConfigError() ?? "Supabase가 설정되지 않았습니다." },
    { status: 503 },
  );
}

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { results, error } = await listWorkResults(session.id);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const orderReportCount = results.filter(
    (r) => r.kind === "ORDER_REPORT",
  ).length;
  const bidCount = results.filter((r) => r.kind === "BID").length;
  const estimateCount = results.filter((r) => r.kind === "ESTIMATE").length;

  return NextResponse.json({
    results,
    orderReportCount,
    bidCount,
    estimateCount,
  });
}
