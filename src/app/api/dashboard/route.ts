import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  getDashboardData,
  type DashboardScope,
} from "@/lib/bid-notices/dashboard";
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

function parseScope(raw: string | null): DashboardScope {
  return raw === "favorites" ? "favorites" : "all";
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
  const siteIdRaw = searchParams.get("siteId");
  const siteId = siteIdRaw ? Number(siteIdRaw) : NaN;
  const scope = parseScope(searchParams.get("scope"));

  if (!siteIdRaw || Number.isNaN(siteId)) {
    return NextResponse.json(
      { error: "siteId는 필수입니다." },
      { status: 400 },
    );
  }

  const {
    favorites,
    approachingCounts,
    kpis,
    noticeCalendar,
    deadlineSchedule,
    estimates,
    otherDeptFavorites,
    error,
  } = await getDashboardData({
    userId: session.id,
    department: session.department ?? "",
    siteId,
    scope,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    favorites,
    approachingCounts,
    kpis,
    noticeCalendar,
    deadlineSchedule,
    estimates,
    otherDeptFavorites,
    scope,
  });
}
