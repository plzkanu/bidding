import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  getAssignmentMap,
  saveNoticeAssignment,
} from "@/lib/bid-notices/assignments";
import type { BidNoticeType } from "@/lib/bid-notices/types";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

const VALID_NOTICE_TYPES: BidNoticeType[] = ["BID", "PRIVATE", "PLAN_SPEC"];

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
  const siteIdRaw = searchParams.get("siteId");
  const noticeType = searchParams.get("noticeType") as BidNoticeType | null;

  const filters: { siteId?: number; noticeType?: BidNoticeType } = {};
  if (siteIdRaw) {
    const siteId = Number(siteIdRaw);
    if (!Number.isNaN(siteId)) {
      filters.siteId = siteId;
    }
  }
  if (noticeType && VALID_NOTICE_TYPES.includes(noticeType)) {
    filters.noticeType = noticeType;
  }

  const { assignments, error } = await getAssignmentMap(filters);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ assignments });
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
      noticeId?: string;
      departmentId?: string;
      assigneeUserId?: string | null;
    };

    const noticeId = body.noticeId?.trim();
    if (!noticeId) {
      return NextResponse.json(
        { error: "noticeId는 필수입니다." },
        { status: 400 },
      );
    }

    const { assignment, error } = await saveNoticeAssignment(
      session.id,
      noticeId,
      {
        departmentId: body.departmentId ?? "",
        assigneeUserId: body.assigneeUserId ?? null,
      },
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ assignment });
  } catch {
    return NextResponse.json(
      { error: "담당 지정 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
