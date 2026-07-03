import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listBidOpeningResultsForExport } from "@/lib/bid-opening-results";
import {
  buildBidOpeningResultsExportFileName,
  buildBidOpeningResultsExportXlsx,
} from "@/lib/bid-opening-results-export";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { NextResponse } from "next/server";

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
  const categoryId = searchParams.get("categoryId")?.trim() || null;
  const search = searchParams.get("search")?.trim() || null;

  const { items, total, error } = await listBidOpeningResultsForExport({
    categoryId,
    search,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const buffer = buildBidOpeningResultsExportXlsx(items);
  const fileName = buildBidOpeningResultsExportFileName();
  const encodedName = encodeURIComponent(fileName);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bid-opening-results-export.xlsx"; filename*=UTF-8''${encodedName}`,
      "X-Export-Total": String(total),
      "X-Export-Rows": String(items.length),
      ...(total > items.length
        ? { "X-Export-Truncated": String(total - items.length) }
        : {}),
    },
  });
}
