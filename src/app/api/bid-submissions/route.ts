import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  addBidSubmission,
  listUserBidSubmissions,
  removeBidSubmission,
} from "@/lib/bid-notices/submissions";
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

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { submissions, error } = await listUserBidSubmissions(session.id);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    submissions,
    noticeIds: submissions.map((s) => s.noticeId),
  });
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

    const { error } = await addBidSubmission(session.id, noticeId);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ isSubmitted: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "입찰 등록에 실패했습니다." },
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

  const { error } = await removeBidSubmission(session.id, noticeId);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ isSubmitted: false });
}
