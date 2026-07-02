import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import type { BidOpeningResultInput } from "@/lib/bid-opening-results";
import type { BidOpeningAwardWinnerType } from "@/lib/bid-opening-results-format";
import {
  createBidOpeningResult,
  deleteAllBidOpeningResults,
  listBidOpeningResults,
} from "@/lib/bid-opening-results";
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

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseAwardWinnerType(
  value: unknown,
): BidOpeningAwardWinnerType | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value === "ours" || value === "competitor") return value;
  return null;
}

function parseBody(body: Record<string, unknown>): BidOpeningResultInput {
  const bids = Array.isArray(body.bids)
    ? body.bids.map((row) => {
        const bid = row as Record<string, unknown>;
        return {
          competitorId: String(bid.competitorId ?? ""),
          bidAmount: parseOptionalNumber(bid.bidAmount),
          bidRate: parseOptionalNumber(bid.bidRate),
        };
      })
    : undefined;

  return {
    categoryId: String(body.categoryId ?? ""),
    noticeNo: String(body.noticeNo ?? ""),
    bidName: String(body.bidName ?? ""),
    bidDate:
      body.bidDate === undefined
        ? undefined
        : body.bidDate
          ? String(body.bidDate)
          : null,
    baseAmount: parseOptionalNumber(body.baseAmount),
    estimatedPrice: parseOptionalNumber(body.estimatedPrice),
    awardRate: parseOptionalNumber(body.awardRate),
    confirmedEstimatedPrice: parseOptionalNumber(body.confirmedEstimatedPrice),
    ourBidAmount: parseOptionalNumber(body.ourBidAmount),
    ourBidRate: parseOptionalNumber(body.ourBidRate),
    awardWinnerType: parseAwardWinnerType(body.awardWinnerType),
    awardWinnerCompetitorId:
      body.awardWinnerCompetitorId === undefined
        ? undefined
        : body.awardWinnerCompetitorId
          ? String(body.awardWinnerCompetitorId)
          : null,
    bids,
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
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");

  const { items, total, error } = await listBidOpeningResults({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    categoryId: categoryId?.trim() || null,
    search: search?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ items, total });
}

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { item, error } = await createBidOpeningResult(
      parseBody(body),
      session.id,
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "개찰결과 등록에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  const { deleted, error } = await deleteAllBidOpeningResults();

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, deleted });
}
