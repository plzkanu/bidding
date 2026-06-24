import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { isNoticeFavorite } from "@/lib/bid-notices/favorites";
import { getNoticeMemo } from "@/lib/bid-notices/memos";
import { isNoticeSubmitted } from "@/lib/bid-notices/submissions";
import { isNoticeEstimated } from "@/lib/bid-notices/estimates";
import { isNoticeOrderReported } from "@/lib/bid-notices/order-reports";
import { getNoticeAssignment } from "@/lib/bid-notices/assignments";
import { getKhnpBidNoticeById } from "@/lib/bid-notices/khnp";
import {
  deleteManualBidNotice,
  getManualNoticePermissions,
  updateManualBidNotice,
  type ManualBidNoticeInput,
} from "@/lib/bid-notices/manual-entry";
import type { BidNoticeType } from "@/lib/bid-notices/types";
import { getNoticeScreeningStatus } from "@/lib/bid-notices/screening";
import { getNoticeActivityLog } from "@/lib/bid-notices/notice-activity";
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { notice, error } = await getKhnpBidNoticeById(id.trim());

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  if (!notice) {
    return NextResponse.json(
      { error: "공고를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { isFavorite, error: favError } = await isNoticeFavorite(
    session.id,
    notice.id,
  );

  if (favError) {
    return NextResponse.json({ error: favError }, { status: 500 });
  }

  const { data: memoData, error: memoError } = await getNoticeMemo(
    session.id,
    notice.id,
  );

  if (memoError) {
    return NextResponse.json({ error: memoError }, { status: 500 });
  }

  const { isSubmitted, error: submissionError } = await isNoticeSubmitted(
    session.id,
    notice.id,
  );

  if (submissionError) {
    return NextResponse.json({ error: submissionError }, { status: 500 });
  }

  const { isEstimated, error: estimateError } = await isNoticeEstimated(
    session.id,
    notice.id,
  );

  if (estimateError) {
    return NextResponse.json({ error: estimateError }, { status: 500 });
  }

  const { isOrderReported, error: orderReportError } = await isNoticeOrderReported(
    session.id,
    notice.id,
  );

  if (orderReportError) {
    return NextResponse.json({ error: orderReportError }, { status: 500 });
  }

  const { canEdit, canDelete } = await getManualNoticePermissions(
    notice,
    session.id,
    session.role,
  );

  const { assignment, error: assignmentError } = await getNoticeAssignment(
    notice.id,
  );

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError }, { status: 500 });
  }

  const { status: screeningStatus, error: screeningError } =
    await getNoticeScreeningStatus(session.id, notice.id);

  if (screeningError) {
    return NextResponse.json({ error: screeningError }, { status: 500 });
  }

  const { activities, error: activityError } = await getNoticeActivityLog(
    notice.id,
  );

  if (activityError) {
    return NextResponse.json({ error: activityError }, { status: 500 });
  }

  return NextResponse.json({
    notice,
    isFavorite,
    isSubmitted,
    isEstimated,
    isOrderReported,
    memo: memoData?.memo ?? "",
    memoUpdatedAt: memoData?.updatedAt ?? null,
    assignment,
    screeningStatus,
    activities,
    canEdit,
    canDelete,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
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

    const { notice, error } = await updateManualBidNotice(
      session.id,
      session.role,
      id.trim(),
      {
        ...body,
        siteId: Number(body.siteId),
        noticeType: body.noticeType as BidNoticeType,
      },
    );

    if (error) {
      const status = error.includes("권한") ? 403 : 400;
      return NextResponse.json({ error }, { status });
    }

    return NextResponse.json({ notice });
  } catch {
    return NextResponse.json(
      { error: "공고 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { error } = await deleteManualBidNotice(
    session.id,
    session.role,
    id.trim(),
  );

  if (error) {
    const status =
      error.includes("권한") || error.includes("수집된") ? 403 : 400;
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ ok: true });
}
