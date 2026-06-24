import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { getOrderReportListMetaByNoticeIds } from "@/lib/order-report-summary/summaries";
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

export async function GET(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { searchParams } = new URL(request.url);
  const noticeIds = (searchParams.get("noticeIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (noticeIds.length === 0) {
    return NextResponse.json({ statuses: {}, meta: {} });
  }

  const { meta, error } = await getOrderReportListMetaByNoticeIds(
    session.id,
    noticeIds,
  );

  if (error) {
    return NextResponse.json({ error, statuses: {}, meta: {} }, { status: 500 });
  }

  const statuses: Record<string, string> = {};
  for (const [noticeId, item] of Object.entries(meta)) {
    statuses[noticeId] = item.summaryStatus;
  }

  return NextResponse.json({ statuses, meta });
}
