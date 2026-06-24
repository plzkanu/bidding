import { NextResponse } from "next/server";
import { getApiSession, requireApiAdmin, unauthorizedResponse } from "@/lib/api-auth";
import {
  createScreeningKeyword,
  createScreeningKeywordsBulk,
  listScreeningKeywords,
  parseBulkKeywordInput,
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

  const { keywords, error } = await listScreeningKeywords({
    activeOnly: activeOnly || session.role !== "admin",
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ keywords });
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
    const body = (await request.json()) as {
      keyword?: string;
      keywords?: string[];
    };

    if (Array.isArray(body.keywords)) {
      const parsed = parseBulkKeywordInput(body.keywords.join("\n"));
      if (parsed.length === 0) {
        return NextResponse.json(
          { error: "등록할 키워드를 입력해 주세요." },
          { status: 400 },
        );
      }

      const { created, skipped, errors, error } =
        await createScreeningKeywordsBulk(parsed);

      if (error) {
        return NextResponse.json({ error }, { status: 500 });
      }

      if (created.length === 0 && errors.length > 0) {
        return NextResponse.json({ error: errors[0] }, { status: 400 });
      }

      return NextResponse.json(
        { keywords: created, skipped, errors },
        { status: 201 },
      );
    }

    const { keywordRow, error } = await createScreeningKeyword(body.keyword ?? "");

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ keyword: keywordRow }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "키워드 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
