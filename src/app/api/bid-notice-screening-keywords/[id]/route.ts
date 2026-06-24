import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  deleteScreeningKeyword,
  updateScreeningKeyword,
} from "@/lib/bid-notices/screening-keywords";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      keyword?: string;
      is_active?: boolean;
    };

    const { keywordRow, error } = await updateScreeningKeyword(id, {
      keyword: body.keyword,
      is_active: body.is_active,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ keyword: keywordRow });
  } catch {
    return NextResponse.json(
      { error: "키워드 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  const { error } = await deleteScreeningKeyword(id);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
