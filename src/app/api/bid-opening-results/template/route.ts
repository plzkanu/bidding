import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import { listBidCompetitors } from "@/lib/bid-competitors";
import { listBidOpeningCategories } from "@/lib/bid-opening-categories";
import {
  buildBidOpeningResultsCsvTemplate,
  buildBidOpeningResultsLongCsvTemplate,
  buildBidOpeningResultsXlsxTemplate,
  type BidOpeningResultsTemplateContext,
} from "@/lib/bid-opening-results-csv";
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

async function loadTemplateContext(): Promise<BidOpeningResultsTemplateContext> {
  const [{ categories }, { competitors }] = await Promise.all([
    listBidOpeningCategories({ activeOnly: true }),
    listBidCompetitors({ activeOnly: true }),
  ]);
  return {
    categories: categories.map((row) => row.name),
    competitors: competitors.map((row) => row.name),
  };
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
  const format = searchParams.get("format")?.trim().toLowerCase();
  const ctx = await loadTemplateContext();

  if (format === "xlsx") {
    const buffer = buildBidOpeningResultsXlsxTemplate(ctx);
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="bid-opening-results-template.xlsx"; filename*=UTF-8\'\'%EA%B0%9C%EC%B0%B0%EA%B2%B0%EA%B3%BC_%EC%96%91%EC%8B%9D.xlsx',
      },
    });
  }

  if (format === "long" || format === "vertical") {
    const csv = buildBidOpeningResultsLongCsvTemplate(ctx);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="bid-opening-results-vertical-template.csv"; filename*=UTF-8\'\'%EA%B0%9C%EC%B0%B0%EA%B2%B0%EA%B3%BC_%EC%84%B8%EB%A1%9C%EC%96%91%EC%8B%9D.csv',
      },
    });
  }

  const csv = buildBidOpeningResultsCsvTemplate(ctx);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="bid-opening-results-template.csv"; filename*=UTF-8\'\'%EA%B0%9C%EC%B0%B0%EA%B2%B0%EA%B3%BC_%EC%96%91%EC%8B%9D.csv',
    },
  });
}
