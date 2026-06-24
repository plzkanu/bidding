export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseConfigError() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length === 0) {
    return null;
  }
  return `다음 환경 변수가 필요합니다: ${missing.join(", ")}`;
}

/** 회사 VPN/방화벽에서 인증서 폐기 목록(OCSP) 검사 실패 시 Supabase 연결용 */
export function isSupabaseTlsInsecure(): boolean {
  const key = process.env.SUPABASE_SSL_VERIFY;
  if (key === undefined) return false;
  const normalized = key.trim().toLowerCase();
  return (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "off"
  );
}
