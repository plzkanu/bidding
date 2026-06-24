import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "./config";
import { applySupabaseTlsBypassIfConfigured } from "./fetch";

export function createServerClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(getSupabaseConfigError() ?? "Supabase 설정이 없습니다.");
  }

  applySupabaseTlsBypassIfConfigured();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
