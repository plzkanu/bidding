import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface BidOpeningCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export const BID_OPENING_CATEGORIES_TABLE_SETUP_MESSAGE =
  "구분을 저장할 수 없습니다. Supabase에 bid_opening_categories 테이블이 필요합니다. supabase/migrations/015_bid_opening_results.sql을 적용해 주세요.";

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("bid_opening_categories") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeBidOpeningCategoriesError(
  message: string | undefined,
): string {
  if (isMissingTableError(message)) {
    return BID_OPENING_CATEGORIES_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "구분 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 구분을 사용할 수 없습니다.";
  }
  return null;
}

export async function listBidOpeningCategories(options?: {
  activeOnly?: boolean;
}): Promise<{ categories: BidOpeningCategory[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { categories: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("bid_opening_categories")
      .select("*")
      .order("name", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return {
        categories: [],
        error: normalizeBidOpeningCategoriesError(error.message),
      };
    }

    return { categories: (data ?? []) as BidOpeningCategory[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "구분 목록 조회에 실패했습니다.";
    return { categories: [], error: normalizeBidOpeningCategoriesError(message) };
  }
}

export async function findActiveBidOpeningCategoryById(
  id: string,
): Promise<{ category: BidOpeningCategory | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { category: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_opening_categories")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return {
        category: null,
        error: normalizeBidOpeningCategoriesError(error.message),
      };
    }

    return {
      category: (data as BidOpeningCategory | null) ?? null,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "구분 조회에 실패했습니다.";
    return { category: null, error: normalizeBidOpeningCategoriesError(message) };
  }
}

export async function createBidOpeningCategory(
  name: string,
  createdBy: string,
): Promise<{ category: BidOpeningCategory | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { category: null, error: configError };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { category: null, error: "구분명을 입력해 주세요." };
  }

  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("bid_opening_categories")
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
      if (error.message.includes("idx_bid_opening_categories_name_lower")) {
        return { category: null, error: "이미 등록된 구분입니다." };
      }
      return {
        category: null,
        error: normalizeBidOpeningCategoriesError(error.message),
      };
    }

    return { category: data as BidOpeningCategory, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "구분 등록에 실패했습니다.";
    return { category: null, error: normalizeBidOpeningCategoriesError(message) };
  }
}

export async function updateBidOpeningCategory(
  id: string,
  input: { name?: string; is_active?: boolean },
): Promise<{ category: BidOpeningCategory | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { category: null, error: configError };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      return { category: null, error: "구분명을 입력해 주세요." };
    }
    patch.name = trimmed;
  }
  if (input.is_active !== undefined) {
    patch.is_active = input.is_active;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_opening_categories")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_bid_opening_categories_name_lower")) {
        return { category: null, error: "이미 등록된 구분입니다." };
      }
      return {
        category: null,
        error: normalizeBidOpeningCategoriesError(error.message),
      };
    }

    return { category: data as BidOpeningCategory, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "구분 수정에 실패했습니다.";
    return { category: null, error: normalizeBidOpeningCategoriesError(message) };
  }
}

export async function deleteBidOpeningCategory(
  id: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("bid_opening_categories")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.message.includes("bid_opening_results")) {
        return {
          error:
            "이 구분이 사용된 개찰결과가 있어 삭제할 수 없습니다. 비활성화를 이용해 주세요.",
        };
      }
      return { error: normalizeBidOpeningCategoriesError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "구분 삭제에 실패했습니다.";
    return { error: normalizeBidOpeningCategoriesError(message) };
  }
}
