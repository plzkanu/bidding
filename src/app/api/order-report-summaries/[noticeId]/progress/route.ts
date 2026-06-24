import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { getSummaryAttachmentProgress } from "@/lib/order-report-summary/summary-progress";

export async function GET(
  _request: Request,
  context: { params: Promise<{ noticeId: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }

  const { noticeId } = await context.params;
  const id = noticeId?.trim();
  if (!id) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const progress = getSummaryAttachmentProgress(session.id, id);
  return NextResponse.json({ progress });
}
