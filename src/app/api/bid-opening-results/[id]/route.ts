import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import type { BidOpeningResultInput } from "@/lib/bid-opening-results";
import type { BidOpeningAwardWinnerType } from "@/lib/bid-opening-results-format";
import {
  deleteBidOpeningResult,
  findBidOpeningResultById,
  updateBidOpeningResult,
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
  const { item, error } = await findBidOpeningResultById(id);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json(
      { error: "개찰결과를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ item });
}

export async function PATCH(
  request: Request,
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

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { item, error } = await updateBidOpeningResult(id, parseBody(body));

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json(
      { error: "개찰결과 수정에 실패했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
  const { error } = await deleteBidOpeningResult(id);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
