import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listUserBidAmountDecisions } from "@/lib/bid-notices/bid-amounts";
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
  const noticeIdsParam = searchParams.get("noticeIds")?.trim();
  const noticeIds = noticeIdsParam
    ? noticeIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  const { decisions, error } = await listUserBidAmountDecisions(
    session.id,
    noticeIds,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ decisions });
}
