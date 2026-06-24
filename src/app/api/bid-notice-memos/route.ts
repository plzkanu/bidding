import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { getNoticeMemo, saveNoticeMemo } from "@/lib/bid-notices/memos";
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

  const noticeId = new URL(request.url).searchParams.get("noticeId")?.trim();
  if (!noticeId) {
    return NextResponse.json(
      { error: "noticeId는 필수입니다." },
      { status: 400 },
    );
  }

  const { data, error } = await getNoticeMemo(session.id, noticeId);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    memo: data?.memo ?? "",
    updatedAt: data?.updatedAt ?? null,
  });
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
      memo?: string;
    };
    const noticeId = body.noticeId?.trim();
    if (!noticeId) {
      return NextResponse.json(
        { error: "noticeId는 필수입니다." },
        { status: 400 },
      );
    }

    const { data, error } = await saveNoticeMemo(
      session.id,
      noticeId,
      body.memo ?? "",
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({
      memo: data?.memo ?? "",
      updatedAt: data?.updatedAt ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "메모 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
