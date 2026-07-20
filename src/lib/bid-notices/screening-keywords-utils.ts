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

import type { BidNoticeDataset } from "./dataset";

export function buildKeywordMatchOrFilter(
  keywords: string[],
  dataset: BidNoticeDataset = "khnp",
): string | null {
  const parts: string[] = [];
  for (const keyword of keywords) {
    const safe = sanitizeKeywordForIlike(keyword);
    if (!safe) continue;
    const pattern = `%${safe}%`;
    parts.push(`title.ilike.${pattern}`);
    parts.push(`notice_no.ilike.${pattern}`);
    if (dataset === "g2b") {
      parts.push(`agency_name.ilike.${pattern}`);
    } else if (
      dataset === "kogas" ||
      dataset === "lh" ||
      dataset === "ex" ||
      dataset === "kr"
    ) {
      parts.push(`notice_div.ilike.${pattern}`);
    } else if (dataset === "srm") {
      parts.push(`dept_name.ilike.${pattern}`);
      parts.push(`company_name.ilike.${pattern}`);
    } else {
      parts.push(`dept_name.ilike.${pattern}`);
    }
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}
