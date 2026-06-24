import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  deleteDepartment,
  updateDepartment,
} from "@/lib/departments";
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
      name?: string;
      is_active?: boolean;
    };

    const { department, error } = await updateDepartment(id, {
      name: body.name,
      is_active: body.is_active,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ department });
  } catch {
    return NextResponse.json(
      { error: "부서 수정에 실패했습니다." },
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
  const { error } = await deleteDepartment(id);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
