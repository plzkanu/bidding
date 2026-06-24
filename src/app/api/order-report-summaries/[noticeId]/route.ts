import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  cancelOrderReportSummary,
  generateOrderReportSummary,
  getOrderReportSummary,
} from "@/lib/order-report-summary/summaries";
import { parseOrderReportSummaryEngine } from "@/lib/order-report-summary/engines";
import { getEngineConfigError } from "@/lib/order-report-summary/summarize";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

export const maxDuration = 120;

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    { error: getSupabaseConfigError() ?? "Supabase가 설정되지 않았습니다." },
    { status: 503 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ noticeId: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { noticeId } = await context.params;
  const id = noticeId?.trim();
  if (!id) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { summary, error } = await getOrderReportSummary(session.id, id);
  if (error) {
    return NextResponse.json({ error, summary }, { status: 500 });
  }

  return NextResponse.json({ summary });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ noticeId: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  let engine = parseOrderReportSummaryEngine(null);
  try {
    const body = (await request.json()) as { engine?: unknown };
    engine = parseOrderReportSummaryEngine(body.engine);
  } catch {
    // 빈 body — 기본 엔진(claude) 사용
  }

  const engineError = getEngineConfigError(engine);
  if (engineError) {
    return NextResponse.json({ error: engineError }, { status: 503 });
  }

  const { noticeId } = await context.params;
  const id = noticeId?.trim();
  if (!id) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { summary, error } = await generateOrderReportSummary(
    session.id,
    id,
    engine,
  );
  if (summary?.status === "FAILED") {
    return NextResponse.json({ summary }, { status: 400 });
  }
  if (error) {
    return NextResponse.json({ error, summary }, { status: 400 });
  }

  return NextResponse.json({ summary }, { status: 201 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ noticeId: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { noticeId } = await context.params;
  const id = noticeId?.trim();
  if (!id) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { summary, error } = await cancelOrderReportSummary(session.id, id);
  if (error) {
    return NextResponse.json({ error, summary }, { status: 400 });
  }

  return NextResponse.json({ summary });
}
