import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getBidNoticeById } from "./notice-repository";
import { listUserOrderReports } from "./order-reports";
import {
  computeBidRateFromAmount,
  parseAmountInput,
  parseOpeningPercentValue,
} from "@/lib/bid-opening-results-format";

export const BID_AMOUNT_TABLE_SETUP_MESSAGE =
  "투찰금액을 저장할 수 없습니다. Supabase에 user_bid_amount_decisions 테이블이 필요합니다. supabase/migrations/026_user_bid_amount_decisions.sql을 적용해 주세요.";

export type BidAmountDecisionStatus = "DRAFT" | "DECIDED";

export interface UserBidAmountDecision {
  id: string;
  noticeId: string;
  bidAmount: number | null;
  baseAmount: number | null;
  awardRate: number | null;
  bidRate: number | null;
  memo: string | null;
  status: BidAmountDecisionStatus;
  decidedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("user_bid_amount_decisions") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeBidAmountError(message: string | undefined): string {
  if (isMissingTableError(message)) {
    return BID_AMOUNT_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "투찰금액 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 투찰금액을 사용할 수 없습니다.";
  }
  return null;
}

function parseStatus(value: unknown): BidAmountDecisionStatus {
  return value === "DECIDED" ? "DECIDED" : "DRAFT";
}

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapRow(row: Record<string, unknown>): UserBidAmountDecision {
  return {
    id: String(row.id),
    noticeId: String(row.notice_id),
    bidAmount: parseNumeric(row.bid_amount),
    baseAmount: parseNumeric(row.base_amount),
    awardRate: parseNumeric(row.award_rate),
    bidRate: parseNumeric(row.bid_rate),
    memo: typeof row.memo === "string" ? row.memo : null,
    status: parseStatus(row.status),
    decidedAt: typeof row.decided_at === "string" ? row.decided_at : null,
    updatedAt: String(row.updated_at ?? row.created_at),
    createdAt: String(row.created_at),
  };
}

export async function assertCompletedOrderReport(
  userId: string,
  noticeId: string,
): Promise<{ error: string | null }> {
  const { reports, error } = await listUserOrderReports(userId, {
    completedOnly: true,
  });
  if (error) {
    return { error };
  }
  if (!reports.some((r) => r.noticeId === noticeId)) {
    return {
      error:
        "발주보고가 완료된 공고만 투찰금액을 결정할 수 있습니다. 발주보고 메뉴에서 보고 완료 후 다시 시도해 주세요.",
    };
  }
  return { error: null };
}

export async function listUserBidAmountDecisions(
  userId: string,
  noticeIds?: string[],
): Promise<{ decisions: UserBidAmountDecision[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { decisions: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("user_bid_amount_decisions")
      .select(
        "id, notice_id, bid_amount, base_amount, award_rate, bid_rate, memo, status, decided_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (noticeIds && noticeIds.length > 0) {
      query = query.in("notice_id", noticeIds);
    }

    const { data, error } = await query;
    if (error) {
      return { decisions: [], error: normalizeBidAmountError(error.message) };
    }

    return {
      decisions: (data ?? []).map((row) =>
        mapRow(row as Record<string, unknown>),
      ),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "투찰금액 목록 조회에 실패했습니다.";
    return { decisions: [], error: normalizeBidAmountError(message) };
  }
}

export async function getUserBidAmountDecision(
  userId: string,
  noticeId: string,
): Promise<{ decision: UserBidAmountDecision | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { decision: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_amount_decisions")
      .select(
        "id, notice_id, bid_amount, base_amount, award_rate, bid_rate, memo, status, decided_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { decision: null, error: normalizeBidAmountError(error.message) };
    }
    if (!data) {
      return { decision: null, error: null };
    }

    return {
      decision: mapRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "투찰금액 조회에 실패했습니다.";
    return { decision: null, error: normalizeBidAmountError(message) };
  }
}

export interface SaveBidAmountDecisionInput {
  bidAmount: number | null;
  baseAmount: number | null;
  awardRate: number | null;
  memo: string | null;
  status: BidAmountDecisionStatus;
}

export async function saveUserBidAmountDecision(
  userId: string,
  noticeId: string,
  input: SaveBidAmountDecisionInput,
): Promise<{ decision: UserBidAmountDecision | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { decision: null, error: configError };
  }

  const gate = await assertCompletedOrderReport(userId, noticeId);
  if (gate.error) {
    return { decision: null, error: gate.error };
  }

  const { notice, error: noticeError } = await getBidNoticeById(noticeId);
  if (noticeError) {
    return { decision: null, error: normalizeBidAmountError(noticeError) };
  }
  if (!notice) {
    return { decision: null, error: "공고를 찾을 수 없습니다." };
  }

  if (input.status === "DECIDED") {
    if (input.bidAmount == null || input.bidAmount <= 0) {
      return {
        decision: null,
        error: "투찰금액을 확정하려면 0보다 큰 금액을 입력해 주세요.",
      };
    }
  }

  const bidRate = computeBidRateFromAmount(
    input.bidAmount,
    input.awardRate,
    input.baseAmount,
  );

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    notice_id: noticeId,
    bid_amount: input.bidAmount,
    base_amount: input.baseAmount,
    award_rate: input.awardRate,
    bid_rate: bidRate,
    memo: input.memo?.trim() || null,
    status: input.status,
    decided_at: input.status === "DECIDED" ? now : null,
    updated_at: now,
  };

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_bid_amount_decisions")
      .upsert(payload, { onConflict: "user_id,notice_id" })
      .select(
        "id, notice_id, bid_amount, base_amount, award_rate, bid_rate, memo, status, decided_at, created_at, updated_at",
      )
      .single();

    if (error) {
      return { decision: null, error: normalizeBidAmountError(error.message) };
    }

    return {
      decision: mapRow(data as Record<string, unknown>),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "투찰금액 저장에 실패했습니다.";
    return { decision: null, error: normalizeBidAmountError(message) };
  }
}

export function parseSaveBidAmountBody(body: unknown): {
  input: SaveBidAmountDecisionInput | null;
  error: string | null;
} {
  if (!body || typeof body !== "object") {
    return { input: null, error: "요청 본문이 올바르지 않습니다." };
  }
  const raw = body as Record<string, unknown>;
  const status: BidAmountDecisionStatus =
    raw.status === "DECIDED" ? "DECIDED" : "DRAFT";

  const toAmount = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") return parseAmountInput(value);
    return null;
  };

  const toRate = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? parseOpeningPercentValue(String(value))
        : null;
    }
    if (typeof value === "string") return parseOpeningPercentValue(value);
    return null;
  };

  return {
    input: {
      bidAmount: toAmount(raw.bidAmount),
      baseAmount: toAmount(raw.baseAmount),
      awardRate: toRate(raw.awardRate),
      memo: typeof raw.memo === "string" ? raw.memo : null,
      status,
    },
    error: null,
  };
}
