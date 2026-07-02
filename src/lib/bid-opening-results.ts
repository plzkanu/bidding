import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  findActiveBidOpeningCategoryById,
  normalizeBidOpeningCategoriesError,
} from "@/lib/bid-opening-categories";
import {
  findActiveBidCompetitorById,
  normalizeBidCompetitorsError,
} from "@/lib/bid-competitors";
import {
  computeConfirmedEstimatedPriceRate,
  computeBidRateFromAmount,
  formatAwardWinnerLabel,
  parseOpeningDateInput,
  type BidOpeningAwardWinnerType,
} from "@/lib/bid-opening-results-format";

export interface BidOpeningResultBid {
  id: string;
  competitorId: string;
  competitorName: string;
  bidAmount: number | null;
  bidRate: number | null;
}

export interface BidOpeningResult {
  id: string;
  categoryId: string;
  categoryName: string;
  noticeNo: string;
  bidName: string;
  bidDate: string | null;
  baseAmount: number | null;
  estimatedPrice: number | null;
  awardRate: number | null;
  confirmedEstimatedPrice: number | null;
  awardWinnerType: BidOpeningAwardWinnerType | null;
  awardWinnerCompetitorId: string | null;
  awardWinnerCompetitorName: string | null;
  awardWinnerLabel: string;
  ourBidAmount: number | null;
  ourBidRate: number | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  bids: BidOpeningResultBid[];
}

export interface BidOpeningResultInput {
  categoryId: string;
  noticeNo: string;
  bidName: string;
  bidDate?: string | null;
  baseAmount?: number | null;
  estimatedPrice?: number | null;
  awardRate?: number | null;
  confirmedEstimatedPrice?: number | null;
  awardWinnerType?: BidOpeningAwardWinnerType | null;
  awardWinnerCompetitorId?: string | null;
  ourBidAmount?: number | null;
  ourBidRate?: number | null;
  bids?: Array<{
    competitorId: string;
    bidAmount?: number | null;
    bidRate?: number | null;
  }>;
}

export const BID_OPENING_RESULTS_TABLE_SETUP_MESSAGE =
  "개찰결과를 저장할 수 없습니다. Supabase에 bid_opening_results 테이블이 필요합니다. supabase/migrations/015_bid_opening_results.sql을 적용해 주세요.";

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    (message.includes("bid_opening_results") ||
      message.includes("bid_opening_result_bids")) &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeBidOpeningResultsError(
  message: string | undefined,
): string {
  if (isMissingTableError(message)) {
    return BID_OPENING_RESULTS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "개찰결과 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 개찰결과를 사용할 수 없습니다.";
  }
  return null;
}

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapBidRow(
  row: Record<string, unknown>,
): BidOpeningResultBid {
  const competitor = row.bid_competitors as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const competitorName = Array.isArray(competitor)
    ? competitor[0]?.name
    : competitor?.name;

  return {
    id: row.id as string,
    competitorId: row.competitor_id as string,
    competitorName: competitorName ?? "",
    bidAmount: parseNumeric(row.bid_amount),
    bidRate: parseNumeric(row.bid_rate),
  };
}

function mapResultRow(row: Record<string, unknown>): BidOpeningResult {
  const category = row.bid_opening_categories as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const categoryName = Array.isArray(category)
    ? category[0]?.name
    : category?.name;

  const bidRows = row.bid_opening_result_bids as
    | Record<string, unknown>[]
    | null
    | undefined;

  const awardWinnerType = (row.award_winner_type as BidOpeningAwardWinnerType | null) ?? null;
  const awardWinnerCompetitor = row.award_winner_competitor as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const awardWinnerCompetitorName = Array.isArray(awardWinnerCompetitor)
    ? awardWinnerCompetitor[0]?.name
    : awardWinnerCompetitor?.name;

  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    categoryName: categoryName ?? "",
    noticeNo: row.notice_no as string,
    bidName: row.bid_name as string,
    bidDate: (row.bid_date as string | null) ?? null,
    baseAmount: parseNumeric(row.base_amount),
    estimatedPrice: parseNumeric(row.estimated_price),
    awardRate: parseNumeric(row.award_rate),
    confirmedEstimatedPrice: parseNumeric(row.confirmed_estimated_price),
    awardWinnerType,
    awardWinnerCompetitorId:
      (row.award_winner_competitor_id as string | null) ?? null,
    awardWinnerCompetitorName: awardWinnerCompetitorName ?? null,
    awardWinnerLabel: formatAwardWinnerLabel(
      awardWinnerType,
      awardWinnerCompetitorName,
    ),
    ourBidAmount: parseNumeric(row.our_bid_amount),
    ourBidRate: parseNumeric(row.our_bid_rate),
    createdBy: row.created_by as string,
    createdAt: (row.created_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    bids: (bidRows ?? []).map(mapBidRow),
  };
}

const RESULT_SELECT = `
  *,
  bid_opening_categories ( name ),
  award_winner_competitor:bid_competitors!award_winner_competitor_id ( name ),
  bid_opening_result_bids (
    id,
    competitor_id,
    bid_amount,
    bid_rate,
    bid_competitors ( name )
  )
`;

async function validateResultInput(
  input: BidOpeningResultInput,
): Promise<{ error: string | null }> {
  const categoryId = input.categoryId?.trim();
  if (!categoryId) {
    return { error: "구분을 선택해 주세요." };
  }

  const { category, error: categoryError } =
    await findActiveBidOpeningCategoryById(categoryId);
  if (categoryError) {
    return { error: normalizeBidOpeningCategoriesError(categoryError) };
  }
  if (!category) {
    return { error: "등록된 활성 구분만 선택할 수 있습니다." };
  }

  const noticeNo = input.noticeNo?.trim();
  if (!noticeNo) {
    return { error: "입찰공고번호를 입력해 주세요." };
  }

  const bidName = input.bidName?.trim();
  if (!bidName) {
    return { error: "입찰명을 입력해 주세요." };
  }

  if (input.bidDate?.trim()) {
    const parsedBidDate = parseOpeningDateInput(input.bidDate);
    if (!parsedBidDate) {
      return { error: "입찰일 형식이 올바르지 않습니다. (예: 26.06.15)" };
    }
  }

  const bids = input.bids ?? [];
  const competitorIds = new Set<string>();
  for (const bid of bids) {
    const competitorId = bid.competitorId?.trim();
    if (!competitorId) {
      return { error: "경쟁사를 선택해 주세요." };
    }
    if (competitorIds.has(competitorId)) {
      return { error: "같은 경쟁사를 중복 선택할 수 없습니다." };
    }
    competitorIds.add(competitorId);

    const { competitor, error: competitorError } =
      await findActiveBidCompetitorById(competitorId);
    if (competitorError) {
      return { error: normalizeBidCompetitorsError(competitorError) };
    }
    if (!competitor) {
      return { error: "등록된 활성 경쟁사만 선택할 수 있습니다." };
    }
  }

  const awardWinnerType = input.awardWinnerType ?? null;
  const awardWinnerCompetitorId = input.awardWinnerCompetitorId?.trim() || null;

  if (awardWinnerType === "ours") {
    if (awardWinnerCompetitorId) {
      return { error: "낙찰자가 우리일 때 경쟁사를 지정할 수 없습니다." };
    }
  } else if (awardWinnerType === "competitor") {
    if (!awardWinnerCompetitorId) {
      return { error: "낙찰 경쟁사를 선택해 주세요." };
    }
    if (!competitorIds.has(awardWinnerCompetitorId)) {
      return {
        error: "낙찰 경쟁사는 이 공고에 투찰한 경쟁사 중에서 선택해 주세요.",
      };
    }
    const { competitor, error: competitorError } =
      await findActiveBidCompetitorById(awardWinnerCompetitorId);
    if (competitorError) {
      return { error: normalizeBidCompetitorsError(competitorError) };
    }
    if (!competitor) {
      return { error: "등록된 활성 경쟁사만 낙찰자로 선택할 수 있습니다." };
    }
  } else if (awardWinnerCompetitorId) {
    return { error: "낙찰자 유형을 선택해 주세요." };
  }

  return { error: null };
}

function normalizeBidRatesInInput(
  input: BidOpeningResultInput,
): BidOpeningResultInput {
  const awardRate = input.awardRate ?? null;
  const baseAmount = input.baseAmount ?? null;

  return {
    ...input,
    ourBidRate: computeBidRateFromAmount(
      input.ourBidAmount ?? null,
      awardRate,
      baseAmount,
    ),
    bids: (input.bids ?? []).map((bid) => ({
      ...bid,
      bidRate: computeBidRateFromAmount(
        bid.bidAmount ?? null,
        awardRate,
        baseAmount,
      ),
    })),
  };
}

function buildResultPatch(input: BidOpeningResultInput) {
  const awardWinnerType = input.awardWinnerType ?? null;
  const bidDateRaw = input.bidDate?.trim();
  const bidDate = bidDateRaw ? parseOpeningDateInput(bidDateRaw) : null;
  const baseAmount = input.baseAmount ?? null;
  const estimatedPrice = input.estimatedPrice ?? null;

  return {
    category_id: input.categoryId.trim(),
    notice_no: input.noticeNo.trim(),
    bid_name: input.bidName.trim(),
    bid_date: bidDate,
    base_amount: baseAmount,
    estimated_price: estimatedPrice,
    award_rate: input.awardRate ?? null,
    confirmed_estimated_price: computeConfirmedEstimatedPriceRate(
      baseAmount,
      estimatedPrice,
    ),
    award_winner_type: awardWinnerType,
    award_winner_competitor_id:
      awardWinnerType === "competitor"
        ? input.awardWinnerCompetitorId?.trim() || null
        : null,
    our_bid_amount: input.ourBidAmount ?? null,
    our_bid_rate: input.ourBidRate ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function replaceResultBids(
  resultId: string,
  bids: BidOpeningResultInput["bids"],
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error: deleteError } = await supabase
    .from("bid_opening_result_bids")
    .delete()
    .eq("result_id", resultId);

  if (deleteError) {
    return { error: normalizeBidOpeningResultsError(deleteError.message) };
  }

  const rows = (bids ?? []).map((bid) => ({
    result_id: resultId,
    competitor_id: bid.competitorId.trim(),
    bid_amount: bid.bidAmount ?? null,
    bid_rate: bid.bidRate ?? null,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase
    .from("bid_opening_result_bids")
    .insert(rows);

  if (insertError) {
    return { error: normalizeBidOpeningResultsError(insertError.message) };
  }

  return { error: null };
}

export async function listBidOpeningResults(options?: {
  page?: number;
  pageSize?: number;
  categoryId?: string | null;
  search?: string | null;
}): Promise<{
  items: BidOpeningResult[];
  total: number;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { items: [], total: 0, error: configError };
  }

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("bid_opening_results")
      .select(RESULT_SELECT, { count: "exact" })
      .order("bid_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (options?.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    const search = options?.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      query = query.or(
        `notice_no.ilike.${pattern},bid_name.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return {
        items: [],
        total: 0,
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    return {
      items: (data ?? []).map((row) =>
        mapResultRow(row as Record<string, unknown>),
      ),
      total: count ?? 0,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 목록 조회에 실패했습니다.";
    return { items: [], total: 0, error: normalizeBidOpeningResultsError(message) };
  }
}

export async function listBidOpeningResultsForChart(options?: {
  categoryId?: string | null;
}): Promise<{ items: BidOpeningResult[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { items: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("bid_opening_results")
      .select(RESULT_SELECT)
      .order("bid_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(500);

    if (options?.categoryId) {
      query = query.eq("category_id", options.categoryId);
    }

    const { data, error } = await query;

    if (error) {
      return {
        items: [],
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    return {
      items: (data ?? []).map((row) =>
        mapResultRow(row as Record<string, unknown>),
      ),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 차트 조회에 실패했습니다.";
    return { items: [], error: normalizeBidOpeningResultsError(message) };
  }
}

export async function findBidOpeningResultById(
  id: string,
): Promise<{ item: BidOpeningResult | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { item: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_opening_results")
      .select(RESULT_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return {
        item: null,
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    if (!data) {
      return { item: null, error: null };
    }

    return {
      item: mapResultRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 조회에 실패했습니다.";
    return { item: null, error: normalizeBidOpeningResultsError(message) };
  }
}

export async function createBidOpeningResult(
  input: BidOpeningResultInput,
  createdBy: string,
): Promise<{ item: BidOpeningResult | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { item: null, error: configError };
  }

  const { error: validationError } = await validateResultInput(input);
  if (validationError) {
    return { item: null, error: validationError };
  }

  const normalizedInput = normalizeBidRatesInInput(input);

  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("bid_opening_results")
      .insert({
        ...buildResultPatch(normalizedInput),
        created_by: createdBy,
        created_at: now,
      })
      .select("id")
      .single();

    if (error) {
      return {
        item: null,
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    const resultId = data.id as string;
    const { error: bidsError } = await replaceResultBids(
      resultId,
      normalizedInput.bids,
    );
    if (bidsError) {
      await supabase.from("bid_opening_results").delete().eq("id", resultId);
      return { item: null, error: bidsError };
    }

    return findBidOpeningResultById(resultId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 등록에 실패했습니다.";
    return { item: null, error: normalizeBidOpeningResultsError(message) };
  }
}

export async function updateBidOpeningResult(
  id: string,
  input: BidOpeningResultInput,
): Promise<{ item: BidOpeningResult | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { item: null, error: configError };
  }

  const { error: validationError } = await validateResultInput(input);
  if (validationError) {
    return { item: null, error: validationError };
  }

  const normalizedInput = normalizeBidRatesInInput(input);

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("bid_opening_results")
      .update(buildResultPatch(normalizedInput))
      .eq("id", id);

    if (error) {
      return {
        item: null,
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    const { error: bidsError } = await replaceResultBids(id, normalizedInput.bids);
    if (bidsError) {
      return { item: null, error: bidsError };
    }

    return findBidOpeningResultById(id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 수정에 실패했습니다.";
    return { item: null, error: normalizeBidOpeningResultsError(message) };
  }
}

export async function deleteBidOpeningResult(
  id: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("bid_opening_results")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: normalizeBidOpeningResultsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "개찰결과 삭제에 실패했습니다.";
    return { error: normalizeBidOpeningResultsError(message) };
  }
}

/** 임시: 등록된 개찰결과 전체 삭제 (투찰 행은 CASCADE) */
export async function deleteAllBidOpeningResults(): Promise<{
  deleted: number;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { deleted: 0, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error, count } = await supabase
      .from("bid_opening_results")
      .delete({ count: "exact" })
      .not("id", "is", null);

    if (error) {
      return {
        deleted: 0,
        error: normalizeBidOpeningResultsError(error.message),
      };
    }

    return { deleted: count ?? 0, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "개찰결과 전체 삭제에 실패했습니다.";
    return { deleted: 0, error: normalizeBidOpeningResultsError(message) };
  }
}
