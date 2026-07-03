import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listBidOpeningResultsForChart } from "@/lib/bid-opening-results";
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
  const categoryId = searchParams.get("categoryId")?.trim() || null;

  if (!categoryId) {
    return NextResponse.json(
      { error: "그래프·비교는 구분을 선택한 뒤 사용할 수 있습니다." },
      { status: 400 },
    );
  }

  const { items, error } = await listBidOpeningResultsForChart({
    categoryId,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ items });
}
