import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  deleteCrawlSite,
  updateCrawlSite,
  type CrawlSiteInput,
} from "@/lib/crawl-sites";
import { getSupabaseConfigError, isSupabaseConfigured } from "@/lib/supabase/config";

type RouteContext = { params: Promise<{ id: string }> };

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    { error: getSupabaseConfigError() ?? "Supabase가 설정되지 않았습니다." },
    { status: 503 },
  );
}

export async function PUT(request: Request, context: RouteContext) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  const siteId = Number(id);
  if (Number.isNaN(siteId)) {
    return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Partial<CrawlSiteInput>;
    const { site, error } = await updateCrawlSite(siteId, body);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ site });
  } catch {
    return NextResponse.json(
      { error: "사이트 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const sessionOrResponse = await requireApiAdmin();
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { id } = await context.params;
  const siteId = Number(id);
  if (Number.isNaN(siteId)) {
    return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
  }

  const { error } = await deleteCrawlSite(siteId);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
