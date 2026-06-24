import { NextResponse } from "next/server";
import { getApiSession, requireApiAdmin, unauthorizedResponse } from "@/lib/api-auth";
import {
  createCrawlSite,
  getCrawlSites,
  type CrawlSiteInput,
} from "@/lib/crawl-sites";
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
  const includeInactive =
    searchParams.get("includeInactive") === "true" && session.role === "admin";

  const { sites, error } = await getCrawlSites({
    activeOnly: !includeInactive,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ sites });
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
    const body = (await request.json()) as CrawlSiteInput;

    if (!body.site_code?.trim() || !body.site_name?.trim() || !body.site_url?.trim()) {
      return NextResponse.json(
        { error: "사이트 코드, 사이트명, URL은 필수입니다." },
        { status: 400 },
      );
    }

    const { site, error } = await createCrawlSite(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ site }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "사이트 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}
