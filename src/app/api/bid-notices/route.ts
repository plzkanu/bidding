import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listKhnpBidNotices } from "@/lib/bid-notices/khnp";
import {
  createManualBidNotice,
  type ManualBidNoticeInput,
} from "@/lib/bid-notices/manual-entry";
import type { DeadlineWindow } from "@/lib/bid-notices/deadline";
import type { BidNoticeType } from "@/lib/bid-notices/types";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { isValidNoticeDateYmd } from "@/lib/bid-notices/notice-date";

const VALID_NOTICE_TYPES: BidNoticeType[] = ["BID", "PRIVATE", "PLAN_SPEC"];
const VALID_DEADLINE_WINDOWS: DeadlineWindow[] = ["week", "day"];

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
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const search = searchParams.get("search") ?? undefined;
  const favoritesOnly = searchParams.get("favoritesOnly") === "true";
  const keywordScreeningOnly =
    searchParams.get("keywordScreeningOnly") === "true";
  const noticeDateYesterday =
    searchParams.get("noticeDateYesterday") === "true";
  const noticeDateRaw = searchParams.get("noticeDate")?.trim() ?? "";
  const deadlineClosed = searchParams.get("deadlineClosed") === "true";
  const deadlineWindowRaw = searchParams.get("deadlineWindow");
  const deadlineWindow =
    deadlineWindowRaw &&
    VALID_DEADLINE_WINDOWS.includes(deadlineWindowRaw as DeadlineWindow)
      ? (deadlineWindowRaw as DeadlineWindow)
      : undefined;

  if (
    deadlineWindowRaw &&
    deadlineWindowRaw !== "" &&
    !deadlineWindow
  ) {
    return NextResponse.json(
      { error: "deadlineWindow은 week 또는 day여야 합니다." },
      { status: 400 },
    );
  }

  const siteId = siteIdRaw ? Number(siteIdRaw) : NaN;
  if (!siteIdRaw || Number.isNaN(siteId)) {
    return NextResponse.json(
      { error: "siteId는 필수입니다." },
      { status: 400 },
    );
  }

  if (!noticeType || !VALID_NOTICE_TYPES.includes(noticeType)) {
    return NextResponse.json(
      { error: "noticeType은 BID, PRIVATE, PLAN_SPEC 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  if (noticeDateRaw && !isValidNoticeDateYmd(noticeDateRaw)) {
    return NextResponse.json(
      { error: "noticeDate는 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400 },
    );
  }

  const { notices, total, error } = await listKhnpBidNotices({
    siteId,
    noticeType,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    search,
    favoritesOnly,
    userId: session.id,
    deadlineWindow,
    deadlineClosed,
    noticeDateYesterday: noticeDateRaw ? false : noticeDateYesterday,
    noticeDate: noticeDateRaw || undefined,
    keywordScreeningOnly,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ notices, total, page, pageSize });
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
    const body = (await request.json()) as ManualBidNoticeInput;

    if (
      !body.noticeType ||
      !VALID_NOTICE_TYPES.includes(body.noticeType as BidNoticeType)
    ) {
      return NextResponse.json(
        { error: "noticeType은 BID, PRIVATE, PLAN_SPEC 중 하나여야 합니다." },
        { status: 400 },
      );
    }

    const siteId = Number(body.siteId);
    if (!Number.isFinite(siteId) || siteId <= 0) {
      return NextResponse.json(
        { error: "siteId는 필수입니다." },
        { status: 400 },
      );
    }

    const { notice, error } = await createManualBidNotice(session.id, {
      ...body,
      siteId,
      noticeType: body.noticeType as BidNoticeType,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ notice }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "공고 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
