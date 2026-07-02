import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface BidCompetitor {
  id: string;
  name: string;
  is_active: boolean;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export const BID_COMPETITORS_TABLE_SETUP_MESSAGE =
  "경쟁사를 저장할 수 없습니다. Supabase에 bid_competitors 테이블이 필요합니다. supabase/migrations/015_bid_opening_results.sql을 적용해 주세요.";

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("bid_competitors") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeBidCompetitorsError(message: string | undefined): string {
  if (isMissingTableError(message)) {
    return BID_COMPETITORS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "경쟁사 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 경쟁사를 사용할 수 없습니다.";
  }
  return null;
}

export async function listBidCompetitors(options?: {
  activeOnly?: boolean;
}): Promise<{ competitors: BidCompetitor[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { competitors: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("bid_competitors")
      .select("*")
      .order("name", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return {
        competitors: [],
        error: normalizeBidCompetitorsError(error.message),
      };
    }

    return { competitors: (data ?? []) as BidCompetitor[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "경쟁사 목록 조회에 실패했습니다.";
    return { competitors: [], error: normalizeBidCompetitorsError(message) };
  }
}

export async function findActiveBidCompetitorById(
  id: string,
): Promise<{ competitor: BidCompetitor | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { competitor: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_competitors")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return {
        competitor: null,
        error: normalizeBidCompetitorsError(error.message),
      };
    }

    return {
      competitor: (data as BidCompetitor | null) ?? null,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "경쟁사 조회에 실패했습니다.";
    return { competitor: null, error: normalizeBidCompetitorsError(message) };
  }
}

export async function createBidCompetitor(
  name: string,
  createdBy: string,
): Promise<{ competitor: BidCompetitor | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { competitor: null, error: configError };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { competitor: null, error: "경쟁사명을 입력해 주세요." };
  }

  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("bid_competitors")
      .insert({
        name: trimmed,
        is_active: true,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_bid_competitors_name_lower")) {
        return { competitor: null, error: "이미 등록된 경쟁사입니다." };
      }
      return {
        competitor: null,
        error: normalizeBidCompetitorsError(error.message),
      };
    }

    return { competitor: data as BidCompetitor, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "경쟁사 등록에 실패했습니다.";
    return { competitor: null, error: normalizeBidCompetitorsError(message) };
  }
}

export async function updateBidCompetitor(
  id: string,
  input: { name?: string; is_active?: boolean },
): Promise<{ competitor: BidCompetitor | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { competitor: null, error: configError };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      return { competitor: null, error: "경쟁사명을 입력해 주세요." };
    }
    patch.name = trimmed;
  }
  if (input.is_active !== undefined) {
    patch.is_active = input.is_active;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_competitors")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_bid_competitors_name_lower")) {
        return { competitor: null, error: "이미 등록된 경쟁사입니다." };
      }
      return {
        competitor: null,
        error: normalizeBidCompetitorsError(error.message),
      };
    }

    return { competitor: data as BidCompetitor, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "경쟁사 수정에 실패했습니다.";
    return { competitor: null, error: normalizeBidCompetitorsError(message) };
  }
}

export async function deleteBidCompetitor(
  id: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("bid_competitors").delete().eq("id", id);

    if (error) {
      if (error.message.includes("bid_opening_result_bids")) {
        return {
          error:
            "이 경쟁사가 등록된 개찰결과가 있어 삭제할 수 없습니다. 비활성화를 이용해 주세요.",
        };
      }
      return { error: normalizeBidCompetitorsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "경쟁사 삭제에 실패했습니다.";
    return { error: normalizeBidCompetitorsError(message) };
  }
}
