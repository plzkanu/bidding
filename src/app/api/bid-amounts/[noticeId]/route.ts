import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  getUserBidAmountDecision,
  parseSaveBidAmountBody,
  saveUserBidAmountDecision,
} from "@/lib/bid-notices/bid-amounts";
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

interface RouteContext {
  params: Promise<{ noticeId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { noticeId: rawId } = await context.params;
  const noticeId = rawId?.trim();
  if (!noticeId) {
    return NextResponse.json(
      { error: "noticeId는 필수입니다." },
      { status: 400 },
    );
  }

  const { decision, error } = await getUserBidAmountDecision(
    session.id,
    noticeId,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ decision });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { noticeId: rawId } = await context.params;
  const noticeId = rawId?.trim();
  if (!noticeId) {
    return NextResponse.json(
      { error: "noticeId는 필수입니다." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const { input, error: parseError } = parseSaveBidAmountBody(body);
    if (parseError || !input) {
      return NextResponse.json(
        { error: parseError ?? "요청이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const { decision, error } = await saveUserBidAmountDecision(
      session.id,
      noticeId,
      input,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ decision });
  } catch {
    return NextResponse.json(
      { error: "투찰금액 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
