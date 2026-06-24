export function parseBulkKeywordInput(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of input.split(/[\n,;|]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function sanitizeKeywordForIlike(keyword: string): string {
  return keyword.replace(/[,()\\%_]/g, " ").trim();
}

export function buildKeywordMatchOrFilter(keywords: string[]): string | null {
  const parts: string[] = [];
  for (const keyword of keywords) {
    const safe = sanitizeKeywordForIlike(keyword);
    if (!safe) continue;
    const pattern = `%${safe}%`;
    parts.push(`title.ilike.${pattern}`);
    parts.push(`notice_no.ilike.${pattern}`);
    parts.push(`dept_name.ilike.${pattern}`);
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}
