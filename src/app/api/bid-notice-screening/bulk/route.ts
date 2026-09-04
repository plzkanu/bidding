import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  bulkSetNoticeScreeningStatuses,
  parseScreeningStatus,
  SCREENING_STATUS_LABELS,
} from "@/lib/bid-notices/screening";
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

export async function PUT(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const body = (await request.json()) as {
      noticeIds?: string[];
      status?: string;
    };

    if (!Array.isArray(body.noticeIds)) {
      return NextResponse.json(
        { error: "noticeIds 배열이 필요합니다." },
        { status: 400 },
      );
    }

    const status = parseScreeningStatus(body.status);

    const { updatedCount, error } = await bulkSetNoticeScreeningStatuses(
      session.id,
      body.noticeIds,
      status,
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({
      updatedCount,
      status,
      label: SCREENING_STATUS_LABELS[status],
    });
  } catch {
    return NextResponse.json(
      { error: "일괄 선별에 실패했습니다." },
      { status: 500 },
    );
  }
}
