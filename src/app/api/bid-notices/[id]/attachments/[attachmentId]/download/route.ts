import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  buildContentDisposition,
  getNoticeAttachmentFile,
} from "@/lib/bid-notices/attachments";
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
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id, attachmentId } = await context.params;
  const noticeId = id?.trim();
  const fileId = attachmentId?.trim();

  if (!noticeId || !fileId) {
    return NextResponse.json(
      { error: "공고 ID와 첨부파일 ID가 필요합니다." },
      { status: 400 },
    );
  }

  const { file, buffer, error } = await getNoticeAttachmentFile(noticeId, fileId);
  if (error || !file || !buffer) {
    return NextResponse.json(
      { error: error ?? "첨부파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": buildContentDisposition(file.fileName),
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
