import { NextResponse } from "next/server";
import { getApiSession, requireApiAdmin, unauthorizedResponse } from "@/lib/api-auth";
import {
  createDepartment,
  listDepartments,
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

export async function GET(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  const { departments, error } = await listDepartments({
    activeOnly: activeOnly || session.role !== "admin",
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const body = (await request.json()) as { name?: string };
    const { department, error } = await createDepartment(body.name ?? "");

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ department }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "부서 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
