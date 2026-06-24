import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatSupabaseNetworkError } from "@/lib/supabase/fetch";

export interface CrawlSite {
  id: number;
  site_code: string;
  site_name: string;
  site_url: string;
  site_category: string | null;
  org_type: string | null;
  region: string | null;
  is_active: boolean | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CrawlSiteInput {
  site_code: string;
  site_name: string;
  site_url: string;
  site_category?: string | null;
  org_type?: string | null;
  region?: string | null;
  is_active?: boolean;
  note?: string | null;
}

interface FetchResult {
  sites: CrawlSite[];
  error: string | null;
}

export async function getCrawlSites(options?: {
  activeOnly?: boolean;
}): Promise<FetchResult> {
  if (!isSupabaseConfigured()) {
    return { sites: [], error: null };
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from("crawl_sites")
      .select("*")
      .order("site_name", { ascending: true });

    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return { sites: [], error: formatSupabaseNetworkError(error.message) };
    }

    return { sites: (data ?? []) as CrawlSite[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "입찰공고 사이트 조회에 실패했습니다.";
    return { sites: [], error: formatSupabaseNetworkError(message) };
  }
}

export async function createCrawlSite(
  input: CrawlSiteInput,
): Promise<{ site: CrawlSite | null; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("crawl_sites")
    .insert({
      site_code: input.site_code.trim(),
      site_name: input.site_name.trim(),
      site_url: input.site_url.trim(),
      site_category: input.site_category?.trim() || null,
      org_type: input.org_type?.trim() || null,
      region: input.region?.trim() || null,
      is_active: input.is_active ?? true,
      note: input.note?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return { site: null, error: error.message };
  }
  return { site: data as CrawlSite, error: null };
}

export async function updateCrawlSite(
  id: number,
  input: Partial<CrawlSiteInput>,
): Promise<{ site: CrawlSite | null; error: string | null }> {
  const supabase = createServerClient();
  const payload: Record<string, unknown> = {};

  if (input.site_code !== undefined) payload.site_code = input.site_code.trim();
  if (input.site_name !== undefined) payload.site_name = input.site_name.trim();
  if (input.site_url !== undefined) payload.site_url = input.site_url.trim();
  if (input.site_category !== undefined) {
    payload.site_category = input.site_category?.trim() || null;
  }
  if (input.org_type !== undefined) {
    payload.org_type = input.org_type?.trim() || null;
  }
  if (input.region !== undefined) {
    payload.region = input.region?.trim() || null;
  }
  if (input.is_active !== undefined) payload.is_active = input.is_active;
  if (input.note !== undefined) payload.note = input.note?.trim() || null;

  const { data, error } = await supabase
    .from("crawl_sites")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { site: null, error: error.message };
  }
  return { site: data as CrawlSite, error: null };
}

export async function deleteCrawlSite(
  id: number,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from("crawl_sites").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
