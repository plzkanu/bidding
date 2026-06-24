import { NextResponse } from "next/server";
import {
  getApiSession,
  requireApiAdmin,
  unauthorizedResponse,
} from "@/lib/api-auth";
import {
  addNoticeAttachment,
  listNoticeAttachments,
  removeNoticeAttachment,
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
  const noticeId = id?.trim();
  if (!noticeId) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { attachments, error } = await listNoticeAttachments(noticeId);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ attachments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  const noticeId = id?.trim();
  if (!noticeId) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 파일이 필요합니다." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { attachment, error } = await addNoticeAttachment(
      noticeId,
      session.id,
      file.name,
      file.type || null,
      buffer,
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ attachment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "첨부파일 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  const noticeId = id?.trim();
  if (!noticeId) {
    return NextResponse.json({ error: "공고 ID가 필요합니다." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("attachmentId")?.trim();
  if (!attachmentId) {
    return NextResponse.json(
      { error: "attachmentId는 필수입니다." },
      { status: 400 },
    );
  }

  const { error } = await removeNoticeAttachment(noticeId, attachmentId);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ deleted: true });
}
