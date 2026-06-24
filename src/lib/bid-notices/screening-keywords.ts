import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  parseBulkKeywordInput,
} from "./screening-keywords-utils";

export {
  buildKeywordMatchOrFilter,
  parseBulkKeywordInput,
  sanitizeKeywordForIlike,
} from "./screening-keywords-utils";

export interface BidNoticeScreeningKeyword {
  id: string;
  keyword: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export const SCREENING_KEYWORDS_TABLE_SETUP_MESSAGE =
  "자동선별 키워드를 저장할 수 없습니다. Supabase에 bid_notice_screening_keywords 테이블이 필요합니다. supabase/migrations/012_bid_notice_screening_keywords.sql을 적용해 주세요.";

function isMissingKeywordsTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("bid_notice_screening_keywords") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

export function normalizeScreeningKeywordsError(
  message: string | undefined,
): string {
  if (isMissingKeywordsTableError(message)) {
    return SCREENING_KEYWORDS_TABLE_SETUP_MESSAGE;
  }
  return message?.trim() || "자동선별 키워드 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 자동선별 키워드를 사용할 수 없습니다.";
  }
  return null;
}

export async function listScreeningKeywords(options?: {
  activeOnly?: boolean;
}): Promise<{ keywords: BidNoticeScreeningKeyword[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { keywords: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("bid_notice_screening_keywords")
      .select("*")
      .order("keyword", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return {
        keywords: [],
        error: normalizeScreeningKeywordsError(error.message),
      };
    }

    return {
      keywords: (data ?? []) as BidNoticeScreeningKeyword[],
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "자동선별 키워드 조회에 실패했습니다.";
    return { keywords: [], error: normalizeScreeningKeywordsError(message) };
  }
}

export async function getActiveScreeningKeywordTexts(): Promise<{
  keywords: string[];
  error: string | null;
}> {
  const { keywords, error } = await listScreeningKeywords({ activeOnly: true });
  if (error) {
    return { keywords: [], error };
  }
  return {
    keywords: keywords.map((row) => row.keyword),
    error: null,
  };
}

export async function createScreeningKeywordsBulk(
  keywords: string[],
): Promise<{
  created: BidNoticeScreeningKeyword[];
  skipped: string[];
  errors: string[];
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { created: [], skipped: [], errors: [], error: configError };
  }

  const created: BidNoticeScreeningKeyword[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const keyword of keywords) {
    const { keywordRow, error } = await createScreeningKeyword(keyword);
    if (keywordRow) {
      created.push(keywordRow);
      continue;
    }
    if (error?.includes("이미 등록된")) {
      skipped.push(keyword);
    } else if (error) {
      errors.push(`${keyword}: ${error}`);
    }
  }

  return { created, skipped, errors, error: null };
}

export async function createScreeningKeyword(
  keyword: string,
): Promise<{ keywordRow: BidNoticeScreeningKeyword | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { keywordRow: null, error: configError };
  }

  const trimmed = keyword.trim();
  if (!trimmed) {
    return { keywordRow: null, error: "키워드를 입력해 주세요." };
  }
  if (trimmed.length > 100) {
    return { keywordRow: null, error: "키워드는 100자 이내로 입력해 주세요." };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_screening_keywords")
      .insert({
        keyword: trimmed,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_bid_notice_screening_keywords_keyword_lower")) {
        return { keywordRow: null, error: "이미 등록된 키워드입니다." };
      }
      return {
        keywordRow: null,
        error: normalizeScreeningKeywordsError(error.message),
      };
    }

    return {
      keywordRow: data as BidNoticeScreeningKeyword,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "자동선별 키워드 등록에 실패했습니다.";
    return { keywordRow: null, error: normalizeScreeningKeywordsError(message) };
  }
}

export async function updateScreeningKeyword(
  id: string,
  input: { keyword?: string; is_active?: boolean },
): Promise<{ keywordRow: BidNoticeScreeningKeyword | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { keywordRow: null, error: configError };
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.keyword !== undefined) {
    const trimmed = input.keyword.trim();
    if (!trimmed) {
      return { keywordRow: null, error: "키워드를 입력해 주세요." };
    }
    if (trimmed.length > 100) {
      return { keywordRow: null, error: "키워드는 100자 이내로 입력해 주세요." };
    }
    payload.keyword = trimmed;
  }

  if (input.is_active !== undefined) {
    payload.is_active = input.is_active;
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_screening_keywords")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.message.includes("idx_bid_notice_screening_keywords_keyword_lower")) {
        return { keywordRow: null, error: "이미 등록된 키워드입니다." };
      }
      return {
        keywordRow: null,
        error: normalizeScreeningKeywordsError(error.message),
      };
    }

    return {
      keywordRow: data as BidNoticeScreeningKeyword,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "자동선별 키워드 수정에 실패했습니다.";
    return { keywordRow: null, error: normalizeScreeningKeywordsError(message) };
  }
}

export async function deleteScreeningKeyword(
  id: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("bid_notice_screening_keywords")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: normalizeScreeningKeywordsError(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "자동선별 키워드 삭제에 실패했습니다.";
    return { error: normalizeScreeningKeywordsError(message) };
  }
}
