import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  addNoticeFavorite,
  getFavoriteNoticeIds,
  removeNoticeFavorite,
} from "@/lib/bid-notices/favorites";
import { ALL_BID_NOTICE_TYPES } from "@/lib/bid-notices/dataset";
import type { BidNoticeType } from "@/lib/bid-notices/types";
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
  const siteIdRaw = searchParams.get("siteId");
  const noticeType = searchParams.get("noticeType") as BidNoticeType | null;

  const filters: { siteId?: number; noticeType?: BidNoticeType } = {};
  if (siteIdRaw) {
    const siteId = Number(siteIdRaw);
    if (!Number.isNaN(siteId)) {
      filters.siteId = siteId;
    }
  }
  if (noticeType && ALL_BID_NOTICE_TYPES.includes(noticeType)) {
    filters.noticeType = noticeType;
  }

  const { noticeIds, error } = await getFavoriteNoticeIds(session.id, filters);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ noticeIds });
}

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const body = (await request.json()) as { noticeId?: string };
    const noticeId = body.noticeId?.trim();

    if (!noticeId) {
      return NextResponse.json(
        { error: "noticeId는 필수입니다." },
        { status: 400 },
      );
    }

    const { error } = await addNoticeFavorite(session.id, noticeId);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ isFavorite: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "관심공고 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { searchParams } = new URL(request.url);
  const noticeId = searchParams.get("noticeId")?.trim();

  if (!noticeId) {
    return NextResponse.json(
      { error: "noticeId는 필수입니다." },
      { status: 400 },
    );
  }

  const { error } = await removeNoticeFavorite(session.id, noticeId);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ isFavorite: false });
}
