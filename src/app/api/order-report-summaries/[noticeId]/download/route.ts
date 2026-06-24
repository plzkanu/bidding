import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { buildContentDisposition } from "@/lib/bid-notices/attachments";
import { getOrderReportSummaryDocx } from "@/lib/order-report-summary/summaries";
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

  const { fileName, buffer, error } = await getOrderReportSummaryDocx(
    session.id,
    id,
  );

  if (error || !fileName || !buffer) {
    return NextResponse.json(
      { error: error ?? "DOCX 파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": buildContentDisposition(fileName),
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
